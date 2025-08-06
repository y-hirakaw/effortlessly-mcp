/**
 * Swift LSP Cache Management System
 * シンボル情報とフォールバック検索結果のキャッシュを管理
 */

import type { SymbolInformation } from 'vscode-languageserver-protocol';
import type { SymbolSearchResult } from './types.js';

/**
 * SwiftLSP用キャッシュ管理クラス
 * シンボル情報とフォールバック検索結果のキャッシュを管理
 */
export class SwiftLSPCache {
  private symbolCache = new Map<string, SymbolInformation[]>();
  private cacheTimestamp = new Map<string, number>();
  private fallbackSearchCache = new Map<string, SymbolSearchResult[]>();
  private fallbackCacheTimestamp = new Map<string, number>();
  
  private static readonly CACHE_TTL = 30000; // 30秒
  private static readonly FALLBACK_CACHE_TTL = 60000; // 1分間キャッシュ
  
  /**
   * シンボルキャッシュからデータを取得
   */
  getSymbolCache(key: string): SymbolInformation[] | null {
    if (!this.symbolCache.has(key)) return null;
    
    const timestamp = this.cacheTimestamp.get(key);
    if (!timestamp || Date.now() - timestamp > SwiftLSPCache.CACHE_TTL) {
      this.symbolCache.delete(key);
      this.cacheTimestamp.delete(key);
      return null;
    }
    
    return this.symbolCache.get(key) || null;
  }
  
  /**
   * シンボルキャッシュにデータを保存
   */
  setSymbolCache(key: string, symbols: SymbolInformation[]): void {
    this.symbolCache.set(key, symbols);
    this.cacheTimestamp.set(key, Date.now());
    
    // メモリリーク防止: 古いエントリを削除
    this.cleanupOldEntries();
  }
  
  /**
   * フォールバックキャッシュからデータを取得
   */
  getFallbackCache(key: string): SymbolSearchResult[] | null {
    if (!this.fallbackSearchCache.has(key)) return null;
    
    const timestamp = this.fallbackCacheTimestamp.get(key);
    if (!timestamp || Date.now() - timestamp > SwiftLSPCache.FALLBACK_CACHE_TTL) {
      this.fallbackSearchCache.delete(key);
      this.fallbackCacheTimestamp.delete(key);
      return null;
    }
    
    return this.fallbackSearchCache.get(key) || null;
  }
  
  /**
   * フォールバックキャッシュにデータを保存
   */
  setFallbackCache(key: string, results: SymbolSearchResult[]): void {
    this.fallbackSearchCache.set(key, results);
    this.fallbackCacheTimestamp.set(key, Date.now());
  }
  
  /**
   * 古いキャッシュエントリを削除
   */
  private cleanupOldEntries(): void {
    // 100エントリを超えたら最古のものから削除
    if (this.symbolCache.size > 100) {
      const oldestKey = this.getOldestCacheEntry();
      if (oldestKey) {
        this.symbolCache.delete(oldestKey);
        this.cacheTimestamp.delete(oldestKey);
      }
    }
  }
  
  /**
   * 最古のキャッシュエントリキーを取得
   */
  private getOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamp) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  /**
   * キャッシュ統計を取得
   */
  getStats(): { totalEntries: number; symbolCacheSize: number; fallbackCacheSize: number } {
    return {
      totalEntries: this.symbolCache.size + this.fallbackSearchCache.size,
      symbolCacheSize: this.symbolCache.size,
      fallbackCacheSize: this.fallbackSearchCache.size
    };
  }
}
