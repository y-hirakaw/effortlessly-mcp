/**
 * Swift LSP統合実装
 * SourceKit-LSPとの統合を提供
 */

import path from 'path';
import fs from 'fs/promises';
import type { 
  SymbolInformation, 
  Position, 
  SymbolKind
} from 'vscode-languageserver-protocol';
import { LSPClientBase } from './lsp-client.js';
import type { SwiftLSPConfig, SymbolSearchResult, ReferenceSearchResult } from './types.js';
import { Logger } from '../logger.js';

/**
 * Swift専用LSPクライアント（SourceKit-LSP）
 */
export class SwiftLSP extends LSPClientBase {
  private symbolCache = new Map<string, SymbolInformation[]>();
  private cacheTimestamp = new Map<string, number>();
  private static readonly CACHE_TTL = 30000; // 30秒

  constructor(workspaceRoot: string, logger?: Logger) {
    const config: SwiftLSPConfig = {
      name: 'sourcekit-lsp',
      command: 'sourcekit-lsp',
      args: [],
      fileExtensions: ['.swift'],
      workspaceRoot,
      swiftVersion: undefined, // 自動検出
      packageSwiftSupported: true
    };

    super(config, logger);
  }

  /**
   * SourceKit-LSPサーバーの利用可能性を確認
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      
      // まずxcrunでSourceKit-LSPを試す（macOS）
      const xcrunProcess = spawn('xcrun', ['--find', 'sourcekit-lsp'], { stdio: 'pipe' });
      
      const xcrunAvailable = await new Promise<boolean>((resolve) => {
        xcrunProcess.on('error', () => resolve(false));
        xcrunProcess.on('exit', (code) => resolve(code === 0));
        setTimeout(() => {
          xcrunProcess.kill();
          resolve(false);
        }, 3000);
      });

      if (xcrunAvailable) {
        return true;
      }

      // 直接sourcekit-lspコマンドを試す
      const directProcess = spawn('sourcekit-lsp', ['--version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        directProcess.on('error', () => resolve(false));
        directProcess.on('exit', (code) => resolve(code === 0));
        setTimeout(() => {
          directProcess.kill();
          resolve(false);
        }, 3000);
      });
    } catch {
      return false;
    }
  }

  /**
   * SourceKit-LSPサーバーを起動し接続を確立（オーバーライド）
   */
  async connect(): Promise<void> {
    try {
      this.logger.info(`Swift LSP: Starting SourceKit-LSP server`);
      
      // SourceKit-LSPの実行可能パスを決定
      const command = await this.getSourceKitLSPCommand();
      
      // プロセスを起動
      const { spawn } = await import('child_process');
      this.process = spawn(command, this.config.args, {
        cwd: this.config.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error('Failed to establish stdio streams');
      }

      // プロセスイベントを設定
      this.setupProcessHandlers();
      
      // 標準出力をパース
      this.setupOutputParser();

      this.state.connected = true;
      this.state.lastActivity = new Date();
      
      // 初期化実行
      await this.initialize();
      
      this.logger.info(`Swift LSP: SourceKit-LSP server connected and initialized`);
      this.emit('connected');
      
    } catch (error) {
      this.state.errorState = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Swift LSP: Failed to connect to SourceKit-LSP`, error as Error);
      throw error;
    }
  }

  /**
   * SourceKit-LSPの実行可能パスを取得
   */
  private async getSourceKitLSPCommand(): Promise<string> {
    try {
      const { spawn } = await import('child_process');
      
      // まずxcrunで試す（macOS）
      const xcrunProcess = spawn('xcrun', ['--find', 'sourcekit-lsp'], { stdio: 'pipe' });
      
      const xcrunPath = await new Promise<string | null>((resolve) => {
        let output = '';
        xcrunProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });
        xcrunProcess.on('exit', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            resolve(null);
          }
        });
        xcrunProcess.on('error', () => resolve(null));
        setTimeout(() => {
          xcrunProcess.kill();
          resolve(null);
        }, 3000);
      });

      if (xcrunPath) {
        this.logger.info(`Swift LSP: Using SourceKit-LSP from xcrun: ${xcrunPath}`);
        return xcrunPath;
      }

      // 直接sourcekit-lspコマンドを使用
      this.logger.info(`Swift LSP: Using direct sourcekit-lsp command`);
      return 'sourcekit-lsp';
    } catch (error) {
      this.logger.warn(`Swift LSP: Failed to determine SourceKit-LSP path, using default`, { error: (error as Error).message });
      return 'sourcekit-lsp';
    }
  }

  /**
   * ワークスペース内のSwiftファイルを検索
   */
  async findSwiftFiles(): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // 無視するディレクトリ
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', '.build', 'dist', 'build', '.swiftpm'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext === '.swift') {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // ディレクトリアクセスエラーは無視
      }
    }

    await scanDirectory(this.config.workspaceRoot);
    return files;
  }

  /**
   * シンボル名で検索（ファジー検索対応）
   */
  async searchSymbols(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
  }): Promise<SymbolSearchResult[]> {
    const { kind, exactMatch = false, maxResults = 100 } = options || {};
    const results: SymbolSearchResult[] = [];
    
    try {
      // ワークスペース内のSwiftファイルを取得
      const files = await this.findSwiftFiles();
      this.logger.info(`Swift LSP: Found ${files.length} Swift files in workspace`);
      
      // Package.swiftファイルが含まれているかチェック
      const packageSwiftFile = files.find(f => f.endsWith('Package.swift'));
      if (packageSwiftFile) {
        this.logger.info(`Swift LSP: Package.swift found: ${packageSwiftFile}`);
      }
      
      // 少数のファイルから開始（パフォーマンス対策）
      const targetFiles = files.slice(0, 10);
      this.logger.info(`Swift LSP: Processing ${targetFiles.length} files`);
      
      for (const file of targetFiles) {
        try {
          const symbols = await this.getFileSymbols(file);
          this.logger.info(`Swift LSP: File ${file}: found ${symbols.length} symbols`);
          
          for (const symbol of symbols) {
            // 種類フィルタ
            if (kind !== undefined && symbol.kind !== kind) {
              continue;
            }
            
            // 名前フィルタ
            const matches = exactMatch 
              ? symbol.name === query
              : symbol.name.toLowerCase().includes(query.toLowerCase());
              
            if (matches) {
              this.logger.info(`Swift LSP: Found matching symbol: ${symbol.name} (kind: ${symbol.kind})`);
              results.push({
                name: symbol.name,
                kind: symbol.kind,
                file: this.uriToPath(symbol.location.uri),
                position: symbol.location.range.start,
                range: symbol.location.range,
                detail: undefined,
                documentation: undefined
              });
              
              if (results.length >= maxResults) {
                break;
              }
            }
          }
          
          if (results.length >= maxResults) {
            break;
          }
        } catch (error) {
          this.logger.warn(`Swift LSP: Failed to get symbols for ${file}`, { error: (error as Error).message });
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Swift LSP: Failed to search symbols', error as Error);
      throw error;
    }
  }

  /**
   * 参照検索（定義元と使用箇所）
   */
  async searchReferences(
    file: string, 
    position: Position, 
    includeDeclaration = true
  ): Promise<ReferenceSearchResult[]> {
    try {
      const uri = this.pathToUri(file);
      const locations = await this.findReferences(uri, position, includeDeclaration);
      
      const results: ReferenceSearchResult[] = [];
      
      for (const location of locations) {
        const filePath = this.uriToPath(location.uri);
        const context = await this.getLineContext(filePath, location.range.start.line);
        
        results.push({
          file: filePath,
          position: location.range.start,
          range: location.range,
          kind: 'reference', // SourceKit-LSPは種類を区別しない
          context
        });
      }
      
      return results;
    } catch (error) {
      this.logger.error('Swift LSP: Failed to search references', error as Error);
      throw error;
    }
  }

  /**
   * ファイルのシンボル情報を取得（キャッシュ付き）
   */
  private async getFileSymbols(file: string): Promise<SymbolInformation[]> {
    const uri = this.pathToUri(file);
    const now = Date.now();
    
    // キャッシュチェック
    if (this.symbolCache.has(file)) {
      const timestamp = this.cacheTimestamp.get(file) || 0;
      if (now - timestamp < SwiftLSP.CACHE_TTL) {
        return this.symbolCache.get(file)!;
      }
    }
    
    try {
      // ファイルが存在することを確認
      await fs.access(file);
      
      // LSP接続状態を確認
      const state = this.getState();
      if (!state.initialized) {
        this.logger.warn(`Swift LSP: LSP not initialized for file: ${file}`, { 
          connected: state.connected, 
          initialized: state.initialized,
          errorState: state.errorState,
          lastActivity: state.lastActivity?.toISOString()
        });
        return [];
      }
      
      // ファイルを明示的に開く
      const fileContent = await fs.readFile(file, 'utf8');
      this.logger.info(`Swift LSP: Opening file: ${file} (${fileContent.length} chars)`);
      
      this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'swift',
          version: 1,
          text: fileContent
        }
      });
      this.logger.info(`Swift LSP: Sent didOpen notification for: ${uri}`);
      
      // SourceKit-LSPの処理を待つ
      await new Promise(resolve => setTimeout(resolve, 1000)); // Swiftは処理時間が長い場合がある
      this.logger.info('Swift LSP: Requesting document symbols...');
      
      const symbols = await this.getDocumentSymbols(uri);
      this.logger.info(`Swift LSP: Received ${symbols.length} symbols from SourceKit-LSP`);
      
      // ファイルを閉じる
      this.sendNotification('textDocument/didClose', {
        textDocument: { uri }
      });
      this.logger.info(`Swift LSP: Sent didClose notification for: ${uri}`);
      
      // キャッシュに保存
      this.symbolCache.set(file, symbols);
      this.cacheTimestamp.set(file, now);
      
      return symbols;
    } catch (error) {
      this.logger.warn(`Swift LSP: Failed to get symbols for file: ${file}`, { error: (error as Error).message });
      return [];
    }
  }

  /**
   * 指定行の周辺コンテキストを取得
   */
  private async getLineContext(file: string, line: number): Promise<string> {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      
      // 前後1行を含む3行を取得
      const start = Math.max(0, line - 1);
      const end = Math.min(lines.length, line + 2);
      
      return lines.slice(start, end).join('\n');
    } catch {
      return '';
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.symbolCache.clear();
    this.cacheTimestamp.clear();
    this.logger.info('Swift LSP: cache cleared');
  }

  /**
   * Swiftプロジェクト設定を検出
   */
  async detectProjectConfig(): Promise<{
    hasPackageSwift: boolean;
    packageSwiftPath?: string;
    swiftVersion?: string;
    dependencies?: string[];
  }> {
    const result = {
      hasPackageSwift: false,
      packageSwiftPath: undefined as string | undefined,
      swiftVersion: undefined as string | undefined,
      dependencies: undefined as string[] | undefined
    };

    try {
      // Package.swift検索
      const packageSwiftPath = path.join(this.config.workspaceRoot, 'Package.swift');
      try {
        await fs.access(packageSwiftPath);
        result.hasPackageSwift = true;
        result.packageSwiftPath = packageSwiftPath;

        // Package.swiftから依存関係を解析
        const packageContent = await fs.readFile(packageSwiftPath, 'utf8');
        const dependencies = this.parseSwiftPackageDependencies(packageContent);
        if (dependencies.length > 0) {
          result.dependencies = dependencies;
        }
      } catch {
        // Package.swiftが見つからない
      }

      // Swift Toolchainバージョンを取得
      try {
        const { spawn } = await import('child_process');
        const swiftProcess = spawn('swift', ['--version'], { stdio: 'pipe' });
        
        const version = await new Promise<string>((resolve) => {
          let output = '';
          swiftProcess.stdout?.on('data', (data) => {
            output += data.toString();
          });
          swiftProcess.on('exit', () => {
            const versionMatch = output.match(/Swift version (\d+\.\d+(?:\.\d+)?)/);
            resolve(versionMatch ? versionMatch[1] : 'unknown');
          });
          swiftProcess.on('error', () => resolve('unknown'));
          setTimeout(() => {
            swiftProcess.kill();
            resolve('unknown');
          }, 3000);
        });
        
        result.swiftVersion = version;
      } catch {
        // Swiftバージョン取得失敗
      }

      return result;
    } catch (error) {
      this.logger.error('Swift LSP: Failed to detect project config', error as Error);
      return result;
    }
  }

  /**
   * Package.swiftから依存関係を解析（簡易パーサー）
   */
  private parseSwiftPackageDependencies(packageContent: string): string[] {
    const dependencies: string[] = [];
    
    try {
      // 簡易的な依存関係パーサー（正規表現ベース）
      const dependencyRegex = /\.package\s*\(\s*url:\s*["']([^"']+)["']/g;
      let match;
      
      while ((match = dependencyRegex.exec(packageContent)) !== null) {
        const url = match[1];
        // GitHubリポジトリ名を抽出
        const repoMatch = url.match(/github\.com\/[^\/]+\/([^\/\.]+)/);
        if (repoMatch) {
          dependencies.push(repoMatch[1]);
        } else {
          // URLから推測
          const parts = url.split('/');
          const lastPart = parts[parts.length - 1].replace(/\.git$/, '');
          if (lastPart) {
            dependencies.push(lastPart);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Swift LSP: Failed to parse Package.swift dependencies', { error: (error as Error).message });
    }
    
    return dependencies;
  }
}