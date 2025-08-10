/**
 * LSPサービス統合
 * 各LSPサービスとインデックスを統合して管理
 */

export { LSPClientBase } from './lsp-client.js';
export { TypeScriptLSP } from './typescript-lsp.js';
export { SwiftLSP } from './swift-lsp.js';
export { JavaLSP } from './java-lsp.js';
export { SymbolIndexer } from './symbol-indexer.js';
export { LSPAutoLauncher } from './lsp-auto-launcher.js';
export { LSPDependencyManager } from './lsp-dependency-manager.js';
export type * from './types.js';

// クラス内で使用するため、明示的にインポート
import { LSPClientBase } from './lsp-client.js';
import { SymbolIndexer } from './symbol-indexer.js';
import { LSPAutoLauncher } from './lsp-auto-launcher.js';
import { LSPDependencyManager } from './lsp-dependency-manager.js';
import { Logger } from '../logger.js';
import type { ExtendedLSPServerConfig } from './types.js';

// LSPサービス管理クラスのエクスポート（将来の拡張用）
export class LSPManager {
  private static instance?: LSPManager;
  private clients = new Map<string, LSPClientBase>();
  private indexers = new Map<string, SymbolIndexer>();
  private autoLauncher?: LSPAutoLauncher;
  private dependencyManager?: LSPDependencyManager;
  private logger: Logger;


  constructor() {
    this.logger = Logger.getInstance();
  }

  static getInstance(): LSPManager {
    if (!LSPManager.instance) {
      LSPManager.instance = new LSPManager();
    }
    return LSPManager.instance;
  }

  /**
   * ワークスペースを設定して自動起動システムを初期化
   */
  async initialize(workspaceRoot: string): Promise<void> {
    // workspaceRootは以降の処理で使用
    
    // 自動起動システムの初期化
    this.autoLauncher = new LSPAutoLauncher(workspaceRoot);
    this.dependencyManager = new LSPDependencyManager(`${workspaceRoot}/.claude/lsp-servers`);
    
    // 依存関係管理システムの初期化
    await this.dependencyManager.initialize();
    
    this.logger.info('🚀 LSP Manager initialized with auto-launcher support');
  }

  /**
   * 言語サポートを自動起動で追加
   */
  async enableLanguageSupport(
    language: string, 
    config?: Partial<ExtendedLSPServerConfig>
  ): Promise<boolean> {
    if (!this.autoLauncher) {
      this.logger.error('❌ LSPManager not initialized. Call initialize() first.');
      return false;
    }

    try {
      this.logger.info(`🔄 Enabling ${language} language support...`);
      
      const client = await this.autoLauncher.detectAndStartServer(language, config);
      if (client) {
        this.clients.set(language, client);
        this.logger.info(`✅ ${language} language support enabled`);
        return true;
      } else {
        this.logger.warn(`⚠️  Failed to enable ${language} language support`);
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ Error enabling ${language} support:`);
      return false;
    }
  }

  /**
   * 複数言語の一括有効化
   */
  async enableMultipleLanguages(languages: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // 並列実行で効率化
    const promises = languages.map(async (language) => {
      const success = await this.enableLanguageSupport(language);
      return [language, success] as [string, boolean];
    });

    const parallelResults = await Promise.all(promises);
    for (const [language, success] of parallelResults) {
      results.set(language, success);
    }

    const successful = Array.from(results.values()).filter(Boolean).length;
    this.logger.info(`📊 Language support summary: ${successful}/${languages.length} successful`);
    
    return results;
  }

  /**
   * 依存関係状態レポート
   */
  getDependencyReport() {
    return this.dependencyManager?.getInstallationReport();
  }

  /**
   * LSPクライアントを登録
   */
  registerClient(name: string, client: LSPClientBase): void {
    this.clients.set(name, client);
  }

  /**
   * LSPクライアントを取得
   */
  getClient(name: string): LSPClientBase | undefined {
    return this.clients.get(name);
  }

  /**
   * インデックスを登録
   */
  registerIndexer(name: string, indexer: SymbolIndexer): void {
    this.indexers.set(name, indexer);
  }

  /**
   * インデックスを取得
   */
  getIndexer(name: string): SymbolIndexer | undefined {
    return this.indexers.get(name);
  }

  /**
   * 全てのLSPクライアントを切断
   */
  async disconnectAll(): Promise<void> {
    this.logger.info('🔄 Disconnecting all LSP clients...');
    
    const promises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(() => {}) // エラーは無視
    );
    await Promise.all(promises);
    this.clients.clear();

    // 自動起動システムのシャットダウン
    if (this.autoLauncher) {
      await this.autoLauncher.shutdown();
    }

    this.logger.info('✅ All LSP clients disconnected');
  }

  /**
   * 全てのインデックスを閉じる
   */
  closeAllIndexers(): void {
    for (const indexer of this.indexers.values()) {
      indexer.close();
    }
    this.indexers.clear();
  }
}