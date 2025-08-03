/**
 * LSPサービス統合
 * 各LSPサービスとインデックスを統合して管理
 */

export { LSPClientBase } from './lsp-client.js';
export { TypeScriptLSP } from './typescript-lsp.js';
export { SymbolIndexer } from './symbol-indexer.js';
export type * from './types.js';

// クラス内で使用するため、明示的にインポート
import { LSPClientBase } from './lsp-client.js';
import { SymbolIndexer } from './symbol-indexer.js';

// LSPサービス管理クラスのエクスポート（将来の拡張用）
export class LSPManager {
  private static instance?: LSPManager;
  private clients = new Map<string, LSPClientBase>();
  private indexers = new Map<string, SymbolIndexer>();

  static getInstance(): LSPManager {
    if (!LSPManager.instance) {
      LSPManager.instance = new LSPManager();
    }
    return LSPManager.instance;
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
    const promises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(() => {}) // エラーは無視
    );
    await Promise.all(promises);
    this.clients.clear();
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