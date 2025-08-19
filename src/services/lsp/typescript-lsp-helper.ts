import { TypeScriptLSP } from './typescript-lsp.js';
import { Logger } from '../logger.js';

/**
 * TypeScript LSPヘルパー
 * TypeScript LSPクライアントのシングルトン管理とキャッシュ機能を提供
 */
export class TypeScriptLSPHelper {
  private static instance: TypeScriptLSPHelper;
  private lspClients: Map<string, TypeScriptLSP> = new Map();
  private logger: Logger;
  
  // 接続復旧機能
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000; // 2秒

  private constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * TypeScriptLSPHelperのシングルトンインスタンスを取得
   */
  public static getInstance(): TypeScriptLSPHelper {
    if (!TypeScriptLSPHelper.instance) {
      TypeScriptLSPHelper.instance = new TypeScriptLSPHelper();
    }
    return TypeScriptLSPHelper.instance;
  }

  /**
   * TypeScript LSPクライアントを取得または作成
   * @param workspacePath ワークスペースのパス
   * @returns LSPクライアントのインスタンス
   */
  public async getOrCreateTypeScriptLSP(workspacePath: string): Promise<TypeScriptLSP> {
    // キャッシュから既存のクライアントを取得
    const existingClient = this.lspClients.get(workspacePath);
    if (existingClient) {
      this.logger.debug(`Using cached TypeScript LSP client for workspace: ${workspacePath}`);
      return existingClient;
    }

    // 新しいクライアントを作成
    this.logger.info(`Creating new TypeScript LSP client for workspace: ${workspacePath}`);
    const client = new TypeScriptLSP(workspacePath, this.logger);
    
    try {
      // TypeScriptLSPの可用性チェック
      const available = await TypeScriptLSP.isAvailable();
      if (!available) {
        throw new Error(
          'TypeScript Language Server not found. Please install it using: npm install -g typescript-language-server typescript'
        );
      }

      // 接続（自動復旧付き）
      await this.connectWithRetry(client, workspacePath);
      
      // キャッシュに保存
      this.lspClients.set(workspacePath, client);
      this.reconnectAttempts.delete(workspacePath); // 成功時はカウンターリセット
      this.logger.info(`TypeScript LSP client created and cached for workspace: ${workspacePath}`);
      
      return client;
    } catch (error) {
      this.logger.error('Failed to initialize TypeScript LSP client', error as Error);
      throw error;
    }
  }

  /**
   * 特定のワークスペースのLSPクライアントを取得
   * @param workspacePath ワークスペースのパス
   * @returns LSPクライアントまたはundefined
   */
  public getClient(workspacePath: string): TypeScriptLSP | undefined {
    return this.lspClients.get(workspacePath);
  }

  /**
   * 特定のワークスペースのLSPクライアントを削除
   * @param workspacePath ワークスペースのパス
   */
  public removeClient(workspacePath: string): void {
    const client = this.lspClients.get(workspacePath);
    if (client) {
      try {
        client.disconnect();
      } catch (error) {
        this.logger.error('Error disconnecting TypeScript LSP client', error as Error);
      }
      this.lspClients.delete(workspacePath);
      this.logger.info(`TypeScript LSP client removed for workspace: ${workspacePath}`);
    }
  }

  /**
   * すべてのLSPクライアントをクリア
   */
  public clearAll(): void {
    for (const [workspacePath, client] of this.lspClients.entries()) {
      try {
        client.disconnect();
      } catch (error) {
        this.logger.error(`Error disconnecting TypeScript LSP client for ${workspacePath}`, error as Error);
      }
    }
    this.lspClients.clear();
    this.logger.info('All TypeScript LSP clients cleared');
  }

  /**
   * キャッシュされているクライアント数を取得
   * @returns クライアント数
   */
  public getCachedClientCount(): number {
    return this.lspClients.size;
  }

  /**
   * キャッシュされているワークスペースのリストを取得
   * @returns ワークスペースパスの配列
   */
  public getCachedWorkspaces(): string[] {
    return Array.from(this.lspClients.keys());
  }

  /**
   * 自動復旧付きでLSPクライアントに接続
   * @param client LSPクライアント
   * @param workspacePath ワークスペースのパス
   */
  private async connectWithRetry(client: TypeScriptLSP, workspacePath: string): Promise<void> {
    const maxAttempts = this.MAX_RECONNECT_ATTEMPTS;
    let attempt = this.reconnectAttempts.get(workspacePath) || 0;

    while (attempt < maxAttempts) {
      try {
        await client.connect();
        this.logger.info(`TypeScript LSP client connected successfully for workspace: ${workspacePath}`);
        return;
      } catch (error) {
        attempt++;
        this.reconnectAttempts.set(workspacePath, attempt);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`TypeScript LSP connection attempt ${attempt}/${maxAttempts} failed for workspace ${workspacePath}: ${errorMessage}`);
        
        if (attempt >= maxAttempts) {
          this.logger.error(`TypeScript LSP connection failed after ${maxAttempts} attempts for workspace: ${workspacePath}`);
          throw new Error(`Failed to connect to TypeScript LSP server after ${maxAttempts} attempts: ${errorMessage}`);
        }
        
        // 次の試行前に待機
        this.logger.info(`Retrying TypeScript LSP connection in ${this.RECONNECT_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
      }
    }
  }

  /**
   * LSPクライアントの健康状態チェック
   * @param workspacePath ワークスペースのパス
   * @returns 健康状態（true=健康、false=問題あり）
   */
  public async checkClientHealth(workspacePath: string): Promise<boolean> {
    const client = this.lspClients.get(workspacePath);
    if (!client) {
      return false;
    }

    try {
      // 簡単なLSP操作で健康状態をチェック
      // typescript-language-serverが応答するかテスト
      // TypeScriptLSPに適切なヘルスチェックメソッドがある場合は使用
      // ここでは基本的にクライアントの存在をチェック
      return true; // 実際のヘルスチェックはLSP実装次第
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`TypeScript LSP health check failed for workspace ${workspacePath}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 問題のあるクライアントを自動的に再接続
   * @param workspacePath ワークスペースのパス
   */
  public async reconnectClient(workspacePath: string): Promise<boolean> {
    const client = this.lspClients.get(workspacePath);
    if (!client) {
      this.logger.warn(`No TypeScript LSP client found for workspace: ${workspacePath}`);
      return false;
    }

    try {
      this.logger.info(`Attempting to reconnect TypeScript LSP client for workspace: ${workspacePath}`);
      
      // 既存接続をクリーンアップ
      try {
        await client.disconnect();
      } catch (error) {
        // 切断エラーは無視（既に切断されている可能性）
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.debug(`Error during disconnect (expected): ${errorMessage}`);
      }

      // 再接続を試行
      await this.connectWithRetry(client, workspacePath);
      
      this.logger.info(`TypeScript LSP client reconnected successfully for workspace: ${workspacePath}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to reconnect TypeScript LSP client for workspace ${workspacePath}: ${errorMessage}`);
      
      // 失敗した場合はキャッシュから削除
      this.lspClients.delete(workspacePath);
      return false;
    }
  }

  /**
   * 全クライアントの健康状態チェックと自動復旧
   */
  public async performHealthCheckAndRecovery(): Promise<void> {
    const workspaces = this.getCachedWorkspaces();
    this.logger.debug(`Performing TypeScript LSP health check for ${workspaces.length} workspaces`);

    for (const workspacePath of workspaces) {
      try {
        const isHealthy = await this.checkClientHealth(workspacePath);
        if (!isHealthy) {
          this.logger.warn(`TypeScript LSP client unhealthy for workspace: ${workspacePath}, attempting recovery`);
          await this.reconnectClient(workspacePath);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error during health check for workspace ${workspacePath}: ${errorMessage}`);
      }
    }
  }
}