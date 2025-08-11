import { Logger } from '../../services/logger.js';
import { ValidationError } from '../../types/errors.js';
import { WorkspaceManager } from './workspace-manager.js';
import { LogManager } from '../../utils/log-manager.js';
import { WorkspaceCreateOptions, WorkspaceActivationResult } from './types.js';

/**
 * ワークスペース活性化の入力パラメータ
 */
export interface WorkspaceActivateInput {
  /** ワークスペースのルートパス */
  workspace_path: string;
  /** ワークスペース名（オプション、未指定時はパスから自動生成） */
  name?: string;
  /** この操作を行う理由・目的 */
  intent?: string;
  /** インデックス機能を有効にするか */
  index_enabled?: boolean;
  /** 使用するLSPサーバー */
  lsp_servers?: string[];
  /** ログの自動保存 */
  auto_save_logs?: boolean;
  /** ログ保持日数 */
  log_retention_days?: number;
}

/**
 * ワークスペース活性化ツール
 * 指定されたパスをワークスペースとして設定し、プロジェクト管理を開始する
 */
export const workspaceActivateTool = {
  metadata: {
    name: 'workspace_activate',
    description: 'ワークスペースを活性化し、プロジェクト管理を開始します',
    parameters: {
      workspace_path: {
        type: 'string',
        description: 'ワークスペースのルートディレクトリパス',
        required: true,
      },
      name: {
        type: 'string',
        description: 'ワークスペース名（オプション、未指定時はディレクトリ名から自動生成）',
        required: false,
      },
      index_enabled: {
        type: 'boolean',
        description: 'インデックス機能を有効にするか（デフォルト: true）',
        required: false,
      },
      lsp_servers: {
        type: 'array',
        description: '使用するLSPサーバーのリスト（デフォルト: ["typescript", "python"]）',
        required: false,
      },
      auto_save_logs: {
        type: 'boolean',
        description: 'ログの自動保存を有効にするか（デフォルト: true）',
        required: false,
      },
      log_retention_days: {
        type: 'number',
        description: 'ログの保持日数（デフォルト: 30）',
        required: false,
      },
    },
  },

  /**
   * ワークスペースを活性化
   */
  async execute(input: WorkspaceActivateInput): Promise<WorkspaceActivationResult> {
    const logger = Logger.getInstance();
    
    logger.info('Starting workspace activation', {
      workspace_path: input.workspace_path,
      name: input.name,
    });

    try {
      // 入力パラメータの検証
      if (!input.workspace_path || typeof input.workspace_path !== 'string') {
        throw new ValidationError('workspace_pathが指定されていません');
      }

      // ワークスペースマネージャーを取得
      const workspaceManager = WorkspaceManager.getInstance();

      // オプションを構築
      const options: WorkspaceCreateOptions = {
        name: input.name,
        settings: {
          index_enabled: input.index_enabled,
          lsp_servers: input.lsp_servers,
          auto_save_logs: input.auto_save_logs,
          log_retention_days: input.log_retention_days,
        },
      };

      // ワークスペースを活性化
      const result = await workspaceManager.activateWorkspace(input.workspace_path, options);

      logger.info('Workspace activation completed', {
        success: result.success,
        workspace_name: result.workspace.name,
        workspace_path: result.workspace.root_path,
      });

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logOperation(
        'WORKSPACE_ACTIVATE',
        result.workspace.root_path,
        `Workspace "${result.workspace.name}" activated | Path: ${result.workspace.root_path}`,
        // metadata is not available in this function context
        undefined,
        input.intent || 'ワークスペース活性化'
      );

      return result;
    } catch (error) {
      logger.error('Workspace activation failed', {
        error_message: error instanceof Error ? error.message : String(error),
        workspace_path: input.workspace_path,
      } as any);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new Error(`ワークスペースの活性化に失敗しました: ${(error as Error).message}`);
    }
  },
};

