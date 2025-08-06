/**
 * Swift LSP Performance Metrics System
 * LSP操作のパフォーマンスメトリクスを追跡
 */

/**
 * SwiftLSP用性能監視クラス
 * LSP操作のパフォーマンスメトリクスを追跡
 */
export class SwiftLSPMetrics {
  private metrics = {
    lspSearchAttempts: 0,
    lspSearchSuccesses: 0,
    fallbackSearchUsage: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    totalSearches: 0
  };
  
  private responseTimes: number[] = [];
  
  /**
   * LSP検索試行を記録
   */
  recordLSPAttempt(): void {
    this.metrics.lspSearchAttempts++;
    this.metrics.totalSearches++;
  }
  
  /**
   * LSP検索成功を記録
   */
  recordLSPSuccess(): void {
    this.metrics.lspSearchSuccesses++;
  }
  
  /**
   * フォールバック検索使用を記録
   */
  recordFallbackUsage(): void {
    this.metrics.fallbackSearchUsage++;
  }
  
  /**
   * レスポンス時間を記録
   */
  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    // 最新100件のみ保持
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    this.updateAverageResponseTime();
  }
  
  /**
   * 平均レスポンス時間を更新
   */
  private updateAverageResponseTime(): void {
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageResponseTime = sum / this.responseTimes.length;
    }
  }
  
  /**
   * キャッシュヒット率を更新
   */
  updateCacheHitRate(hitRate: number): void {
    this.metrics.cacheHitRate = hitRate;
  }
  
  /**
   * メトリクス取得
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
  
  /**
   * メトリクスリセット
   */
  reset(): void {
    this.metrics = {
      lspSearchAttempts: 0,
      lspSearchSuccesses: 0,
      fallbackSearchUsage: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      totalSearches: 0
    };
    this.responseTimes = [];
  }
}
