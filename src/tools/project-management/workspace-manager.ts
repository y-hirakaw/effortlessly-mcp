import * as path from 'path';
import * as os from 'os';
import { Logger } from '../../services/logger.js';
import { FileSystemService } from '../../services/FileSystemService.js';
import { ConfigManager } from '../../services/ConfigManager.js';
import { LSPServerManager } from '../../services/LSPServerManager.js';
import { IndexService } from '../../services/IndexService.js';
import { ValidationError, FileSystemError } from '../../types/errors.js';
import { 
  WorkspaceConfig, 
  WorkspaceInfo, 
  WorkspaceListItem, 
  WorkspaceActivationResult,
  WorkspaceCreateOptions 
} from './types.js';
import { WorkspaceConfigValidator } from './workspace-config.js';

/**
 * ワークスペース管理システム
 */
export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private readonly logger = Logger.getInstance();
  private readonly workspaceBaseDir: string;
  private currentWorkspace: WorkspaceInfo | null = null;
  private configManager: ConfigManager;
  private static lspServerManager: LSPServerManager;
  private indexService: IndexService;

  private constructor() {
    // ワークスペースのベースディレクトリを.claude/workspace/effortlessly/に設定
    this.workspaceBaseDir = path.join(os.homedir(), '.claude', 'workspace', 'effortlessly');
    this.configManager = new ConfigManager();
    if (!WorkspaceManager.lspServerManager) {
      WorkspaceManager.lspServerManager = new LSPServerManager();
    }
    this.indexService = new IndexService();
  }

  static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * ワークスペースのベースディレクトリを取得
   */
  getWorkspaceBaseDir(): string {
    return this.workspaceBaseDir;
  }



  /**
   * ワークスペースディレクトリを初期化
   */
  private async ensureWorkspaceStructure(): Promise<void> {
    const directories = [
      this.workspaceBaseDir,
      path.join(this.workspaceBaseDir, 'index'),
      path.join(this.workspaceBaseDir, 'logs', 'audit'),
      path.join(this.workspaceBaseDir, 'logs', 'error'),
      path.join(this.workspaceBaseDir, 'logs', 'debug'),
      path.join(this.workspaceBaseDir, 'temp'),
      path.join(this.workspaceBaseDir, 'backups'),
    ];

    const fsService = FileSystemService.getInstance();
    for (const dir of directories) {
      try {
        await fsService.mkdir(dir, { recursive: true });
      } catch (error) {
        this.logger.error(`Failed to create directory: ${dir}`, { error_message: error instanceof Error ? error.message : String(error) } as any);
        throw new FileSystemError(`ディレクトリの作成に失敗しました: ${dir}`);
      }
    }
  }

  /**
   * ワークスペースを活性化
   */
  async activateWorkspace(
    workspacePath: string,
    options: WorkspaceCreateOptions = {}
  ): Promise<WorkspaceActivationResult> {
    try {
      // パスバリデーション
      const validatedPath = WorkspaceConfigValidator.validateRootPath(workspacePath);
      
      // ディレクトリの存在確認
      const fsService = FileSystemService.getInstance();
      try {
        const stats = await fsService.stat(validatedPath);
        if (!stats.isDirectory()) {
          throw new ValidationError('指定されたパスはディレクトリではありません');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new ValidationError('指定されたディレクトリが存在しません');
        }
        throw error;
      }

      // ワークスペース構造の初期化
      await this.ensureWorkspaceStructure();

      // ワークスペース名の決定
      const workspaceName = options.name || this.generateWorkspaceName(validatedPath);
      const validatedName = WorkspaceConfigValidator.validateWorkspaceName(workspaceName);

      // 設定の生成
      const settings = WorkspaceConfigValidator.mergeWithDefaults(options.settings || {});
      
      const now = new Date().toISOString();
      const config: WorkspaceConfig = {
        name: validatedName,
        root_path: validatedPath,
        created_at: now,
        last_accessed: now,
        settings,
      };

      // 統合設定への保存
      await this.configManager.setWorkspaceConfig(validatedName, config);

      // LSP サーバーの自動起動（バックグラウンド）
      const lspConfig = await this.configManager.getLSPServerConfig();
      if (lspConfig?.proxy_server?.auto_start && lspConfig.proxy_server.enabled) {
        this.logger.info('Starting LSP proxy server in background');
        WorkspaceManager.lspServerManager.startLSPProxy(validatedPath).catch(error => {
          this.logger.warn('Failed to auto-start LSP proxy server', { error });
        });
      }

      // インデックス作成の自動実行
      const indexConfig = await this.configManager.getIndexingConfig();
      if (indexConfig?.enabled) {
        try {
          this.logger.info('Initializing IndexService and starting workspace indexing');
          await this.indexService.initialize();
          
          // バックグラウンドでインデックス作成を実行（非同期）
          this.indexService.indexWorkspace(validatedPath).catch(error => {
            this.logger.warn('Background indexing failed', { error });
          });
        } catch (error) {
          this.logger.warn('Failed to initialize IndexService', { error });
          // インデックス初期化失敗は非致命的エラーとして継続
        }
      }

      // 現在のワークスペースを先にセット（loadWorkspaceInfoでstatusが正しく決定されるため）
      this.currentWorkspace = {
        name: validatedName,
        root_path: validatedPath,
        created_at: config.created_at,
        last_accessed: config.last_accessed,
        settings: config.settings,
        status: 'active',
        file_count: undefined,
        total_size: undefined,
      };

      // ワークスペース情報の生成（統計情報を含む完全版）
      const workspaceInfo = await this.loadWorkspaceInfo(validatedName);
      this.currentWorkspace = workspaceInfo;

      this.logger.info(`Workspace activated: ${validatedName}`, {
        path: validatedPath,
        settings: settings,
      });

      return {
        success: true,
        workspace: workspaceInfo,
        message: `ワークスペース "${validatedName}" を活性化しました`,
      };
    } catch (error) {
      this.logger.error('Failed to activate workspace', { error_message: error instanceof Error ? error.message : String(error), workspacePath } as any);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new FileSystemError(`ワークスペースの活性化に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 現在のワークスペース情報を取得
   */
  async getCurrentWorkspace(): Promise<WorkspaceInfo | null> {
    if (this.currentWorkspace) {
      // アクセス時刻を更新
      const updated = {
        ...this.currentWorkspace,
        last_accessed: new Date().toISOString(),
      };
      
      // 統合設定を更新
      await this.configManager.setWorkspaceConfig(updated.name, updated);
      this.currentWorkspace = updated;
    }
    
    return this.currentWorkspace;
  }

  /**
   * 登録済みワークスペース一覧を取得
   */
  async listWorkspaces(): Promise<WorkspaceListItem[]> {
    try {
      await this.ensureWorkspaceStructure();
      
      // 統合設定からワークスペース一覧を取得
      const config = await this.configManager.loadConfig();
      const workspaces: WorkspaceListItem[] = [];
      
      for (const [workspaceName] of Object.entries(config.workspaces.configurations)) {
        try {
          const info = await this.loadWorkspaceInfo(workspaceName);
          workspaces.push({
            name: info.name,
            root_path: info.root_path,
            status: info.status,
            last_accessed: info.last_accessed,
            file_count: info.file_count,
          });
        } catch (error) {
          this.logger.warn(`Failed to load workspace: ${workspaceName}`, { error });
        }
      }
      
      // 最終アクセス時刻でソート
      workspaces.sort((a, b) => 
        new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime()
      );
      
      return workspaces;
    } catch (error) {
      this.logger.error('Failed to list workspaces', { error_message: error instanceof Error ? error.message : String(error) } as any);
      throw new FileSystemError(`ワークスペース一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  }



  /**
   * ワークスペース情報を読み込み
   */
  private async loadWorkspaceInfo(workspaceName: string): Promise<WorkspaceInfo> {
    try {
      // 統合設定からワークスペース設定を取得
      const config = await this.configManager.getWorkspaceConfig(workspaceName);
      if (!config) {
        throw new Error(`Workspace configuration not found: ${workspaceName}`);
      }
      
      // ディレクトリの存在確認とファイル数の取得
      let fileCount: number | undefined;
      let totalSize: number | undefined;
      
      try {
        const stats = await this.getDirectoryStats(config.root_path);
        fileCount = stats.fileCount;
        totalSize = stats.totalSize;
      } catch (error) {
        this.logger.warn(`Failed to get directory stats for workspace: ${workspaceName}`, { error });
      }
      
      const status = this.currentWorkspace?.name === workspaceName ? 'active' : 'inactive' as const;
      
      return {
        ...config,
        status,
        file_count: fileCount,
        total_size: totalSize,
      };
    } catch (error) {
      this.logger.error(`Failed to load workspace: ${workspaceName}`, { error_message: error instanceof Error ? error.message : String(error) } as any);
      throw new FileSystemError(`ワークスペース設定の読み込みに失敗しました: ${workspaceName}`);
    }
  }

  /**
   * ディレクトリの統計情報を取得
   */
  private async getDirectoryStats(dirPath: string): Promise<{ fileCount: number; totalSize: number }> {
    let fileCount = 0;
    let totalSize = 0;
    
    const processDirectory = async (currentPath: string): Promise<void> => {
      try {
        const fsService = FileSystemService.getInstance();
        const entries = await fsService.readdir(currentPath, { withFileTypes: true }) as import('fs').Dirent[];
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isFile()) {
            fileCount++;
            try {
              const stats = await fsService.stat(fullPath);
              totalSize += stats.size;
            } catch {
              // ファイル統計取得に失敗した場合はスキップ
            }
          } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            // 隠しディレクトリを除外して再帰処理
            await processDirectory(fullPath);
          }
        }
      } catch {
        // ディレクトリ読み込みに失敗した場合はスキップ
      }
    };
    
    await processDirectory(dirPath);
    
    return { fileCount, totalSize };
  }

  /**
   * パスからワークスペース名を生成
   */
  private generateWorkspaceName(workspacePath: string): string {
    const basename = path.basename(workspacePath);
    // 特殊文字を除去してワークスペース名として使用可能な形に変換
    return basename.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }
}