import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { Logger } from './logger.js';
import { FileSystemService } from './FileSystemService.js';
import { SemanticRangeEnhancer } from './SemanticRangeEnhancer.js';

const logger = Logger.getInstance();

// 最適化された範囲の型
export interface OptimalRange {
  start: number;      // 開始行番号（1-indexed）
  end: number;        // 終了行番号（1-indexed）
  label: string;      // 範囲のラベル（例: "クラス定義", "メソッド実装"）
  relevance: number;  // 関連性スコア（0.0-1.0）
  reason?: string;    // 選択理由
}

// 意図の型
export type Intent = 
  | 'bug_investigation'    // バグ調査
  | 'code_review'          // コードレビュー
  | 'feature_addition'     // 機能追加
  | 'refactoring'          // リファクタリング
  | 'documentation'        // ドキュメント作成
  | 'testing'              // テスト作成
  | 'general';             // 一般的な読み込み

// パターンマッチングのルール
interface PatternRule {
  pattern: RegExp;
  label: string;
  intentRelevance: Record<Intent, number>;
}

/**
 * SmartRangeOptimizer - AIによる最適読み込み範囲提案サービス
 * v2.1: パフォーマンス最適化 - 3.357s → <500ms目標
 */
export class SmartRangeOptimizer {
  private static instance: SmartRangeOptimizer;
  private db: Database.Database | null = null;
  private fsService: FileSystemService;
  private semanticEnhancer: SemanticRangeEnhancer;
  private rangeCache: Map<string, OptimalRange[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private fileHashCache: Map<string, string> = new Map(); // ファイルハッシュキャッシュ
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分キャッシュ
  
  // パターンマッチングルール
  private readonly patternRules: PatternRule[] = [
    // クラス定義
    {
      pattern: /^(export\s+)?(abstract\s+)?class\s+\w+/m,
      label: 'クラス定義',
      intentRelevance: {
        bug_investigation: 0.9,
        code_review: 0.95,
        feature_addition: 0.8,
        refactoring: 0.95,
        documentation: 0.9,
        testing: 0.7,
        general: 0.8
      }
    },
    // 関数/メソッド定義
    {
      pattern: /^(export\s+)?(async\s+)?function\s+\w+|^\s*(public|private|protected)?\s*(async\s+)?\w+\s*\([^)]*\)\s*{/m,
      label: 'メソッド実装',
      intentRelevance: {
        bug_investigation: 0.95,
        code_review: 0.9,
        feature_addition: 0.85,
        refactoring: 0.9,
        documentation: 0.8,
        testing: 0.85,
        general: 0.75
      }
    },
    // インポート文
    {
      pattern: /^import\s+.+from\s+['"]/m,
      label: 'インポート',
      intentRelevance: {
        bug_investigation: 0.6,
        code_review: 0.7,
        feature_addition: 0.8,
        refactoring: 0.7,
        documentation: 0.5,
        testing: 0.5,
        general: 0.6
      }
    },
    // エラーハンドリング
    {
      pattern: /try\s*{|catch\s*\(|throw\s+new\s+\w+Error/,
      label: 'エラーハンドリング',
      intentRelevance: {
        bug_investigation: 0.95,
        code_review: 0.85,
        feature_addition: 0.6,
        refactoring: 0.8,
        documentation: 0.6,
        testing: 0.9,
        general: 0.7
      }
    },
    // テストコード - 修正版
    {
      pattern: /describe\s*\(|it\s*\(|test\s*\(|expect\s*\(/,
      label: 'テストコード',
      intentRelevance: {
        bug_investigation: 0.85,
        code_review: 0.8,
        feature_addition: 0.7,
        refactoring: 0.7,
        documentation: 0.6,
        testing: 1.0,
        general: 0.7
      }
    },
    // コメント/ドキュメント - 修正版
    {
      pattern: /\/\*\*[\s\S]*?\*\/|\/\/.*TODO|\/\/.*FIXME|\/\/.*NOTE/,
      label: 'ドキュメント/コメント',
      intentRelevance: {
        bug_investigation: 0.8,
        code_review: 0.85,
        feature_addition: 0.7,
        refactoring: 0.75,
        documentation: 0.95,
        testing: 0.6,
        general: 0.7
      }
    }
  ];

  private constructor() {
    this.fsService = FileSystemService.getInstance();
    this.semanticEnhancer = new SemanticRangeEnhancer();
    this.initializeDatabase();
    this.initializeSemanticEnhancer();
  }

  static getInstance(): SmartRangeOptimizer {
    if (!SmartRangeOptimizer.instance) {
      SmartRangeOptimizer.instance = new SmartRangeOptimizer();
    }
    return SmartRangeOptimizer.instance;
  }

  private initializeDatabase(): void {
    try {
      const dbPath = path.join('.claude', 'workspace', 'effortlessly', 'smart_range_optimizer.db');
      
      // ディレクトリが存在することを確認
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(dbPath);
      
      // テーブル作成
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS range_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL,
          intent TEXT NOT NULL,
          ranges TEXT NOT NULL,
          success_score REAL DEFAULT 0,
          timestamp INTEGER NOT NULL,
          file_extension TEXT
        )
      `);
      
      // インデックス作成
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_range_history_file_path ON range_history(file_path);
        CREATE INDEX IF NOT EXISTS idx_range_history_intent ON range_history(intent);
      `);
      
      logger.info('SmartRangeOptimizer database initialized');
    } catch (error) {
      logger.error('Failed to initialize SmartRangeOptimizer database', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async initializeSemanticEnhancer(): Promise<void> {
    try {
      await this.semanticEnhancer.initialize();
      logger.info('Semantic enhancement available');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Semantic enhancement initialization failed, continuing with pattern-only mode: ${errorMessage}`);
    }
  }

  /**
   * ファイル内容から最適な読み込み範囲を提案
   */
  async suggestOptimalRanges(
    filePath: string, 
    intent: Intent = 'general',
    maxRanges: number = 5,
    semanticQueries: string[] = []
  ): Promise<OptimalRange[]> {
    try {
      const resolvedPath = path.resolve(filePath);
      
      // ファイル読み込み
      const content = await this.fsService.readFile(resolvedPath, { encoding: 'utf-8' }) as string;
      
      // ファイルハッシュ計算（変更検知用）
      const fileHash = crypto.createHash('md5').update(content).digest('hex');
      const cacheKey = `${resolvedPath}:${intent}:${maxRanges}:${semanticQueries.join(',')}`;
      const now = Date.now();
      
      // キャッシュチェック（ファイル変更検知付き）
      if (this.rangeCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey) || 0;
        const cachedHash = this.fileHashCache.get(cacheKey);
        
        if (now < expiry && cachedHash === fileHash) {
          logger.info('Serving from cache (file unchanged)', { filePath, intent, fileHash: fileHash.slice(0, 8) });
          return this.rangeCache.get(cacheKey)!;
        } else {
          // 期限切れまたはファイル変更によるキャッシュ無効化
          const reason = now >= expiry ? 'expired' : 'file_changed';
          logger.info('Cache invalidated', { filePath, reason, oldHash: cachedHash?.slice(0, 8), newHash: fileHash.slice(0, 8) });
          this.rangeCache.delete(cacheKey);
          this.cacheExpiry.delete(cacheKey);
          this.fileHashCache.delete(cacheKey);
        }
      }
      const lines = content.split('\n');
      
      // ファイル拡張子を取得
      const ext = path.extname(filePath).toLowerCase();
      
      // パターンマッチングによる範囲検出
      const detectedRanges = this.detectRanges(lines, intent, ext);
      
      // 履歴データから学習した範囲を追加
      const historicalRanges = await this.getHistoricalRanges(filePath, intent);
      
      // セマンティック検索による範囲検出（v2.1: 並列処理最適化）
      const semanticRanges = semanticQueries.length > 0 
        ? await this.semanticEnhancer.detectSemanticRanges(
            lines, 
            intent, 
            semanticQueries, 
            Math.ceil(maxRanges / 2)
          )
        : []; // クエリなしの場合はスキップ
      
      // 範囲を統合して最適化
      const optimizedRanges = this.optimizeRanges(
        [...detectedRanges, ...historicalRanges, ...semanticRanges],
        lines.length,
        maxRanges
      );
      
      // 履歴に記録
      await this.recordRangeHistory(filePath, intent, optimizedRanges);
      
      // 結果をキャッシュに保存（ファイルハッシュと共に）
      this.rangeCache.set(cacheKey, optimizedRanges);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
      this.fileHashCache.set(cacheKey, fileHash);
      
      logger.info('Optimal ranges suggested', {
        filePath,
        intent,
        rangeCount: optimizedRanges.length,
        totalLines: lines.length,
        cached: true
      });
      
      return optimizedRanges;
      
    } catch (error) {
      logger.error('Failed to suggest optimal ranges', error instanceof Error ? error : new Error(String(error)));
      // エラー時はファイル全体を返す
      return [{
        start: 1,
        end: -1, // -1は最終行を意味する
        label: 'ファイル全体',
        relevance: 0.5,
        reason: 'パターン検出に失敗したため、ファイル全体を提案'
      }];
    }
  }

  /**
   * パターンマッチングによる範囲検出
   */
  private detectRanges(lines: string[], intent: Intent, fileExt: string): OptimalRange[] {
    const ranges: OptimalRange[] = [];
    const contentBlocks: Map<string, { start: number; end: number; matches: number }> = new Map();
    
    // 各行をスキャンしてパターンを検出
    lines.forEach((line, index) => {
      this.patternRules.forEach(rule => {
        if (rule.pattern.test(line)) {
          const relevance = rule.intentRelevance[intent] || 0.5;
          
          // 関連性が閾値以上の場合のみ追加
          if (relevance >= 0.6) {
            // ブロックの範囲を推定（前後の文脈を含む）
            const blockStart = Math.max(0, index - 2);
            const blockEnd = Math.min(lines.length - 1, index + 20);
            
            const key = `${rule.label}_${blockStart}`;
            const existing = contentBlocks.get(key);
            
            if (existing) {
              // 既存のブロックを拡張
              existing.end = Math.max(existing.end, blockEnd);
              existing.matches++;
            } else {
              contentBlocks.set(key, {
                start: blockStart,
                end: blockEnd,
                matches: 1
              });
              
              ranges.push({
                start: blockStart + 1, // 1-indexed
                end: blockEnd + 1,     // 1-indexed
                label: rule.label,
                relevance: relevance,
                reason: `${intent}に関連する${rule.label}を検出`
              });
            }
          }
        }
      });
    });
    
    // TypeScript/JavaScriptファイルの場合、追加の最適化
    if (['.ts', '.tsx', '.js', '.jsx'].includes(fileExt)) {
      ranges.push(...this.detectTypeScriptRanges(lines, intent));
    }
    
    return ranges;
  }

  /**
   * TypeScript/JavaScript固有の範囲検出
   */
  private detectTypeScriptRanges(lines: string[], intent: Intent): OptimalRange[] {
    const ranges: OptimalRange[] = [];
    
    // クラスやインターフェースの境界を検出
    let inClass = false;
    let classStart = -1;
    let braceCount = 0;
    
    lines.forEach((line, index) => {
      // クラス開始
      if (/^(export\s+)?(abstract\s+)?class\s+\w+/.test(line)) {
        inClass = true;
        classStart = index;
        braceCount = 0;
      }
      
      if (inClass) {
        // 中括弧のカウント
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        
        // クラス終了
        if (braceCount === 0 && classStart !== index) {
          inClass = false;
          
          const relevance = intent === 'refactoring' ? 0.95 : 
                           intent === 'code_review' ? 0.9 : 0.75;
          
          ranges.push({
            start: classStart + 1,
            end: index + 1,
            label: 'クラス全体',
            relevance: relevance,
            reason: 'クラス定義の完全なコンテキスト'
          });
        }
      }
    });
    
    return ranges;
  }

  /**
   * 履歴データから学習した範囲を取得
   */
  private async getHistoricalRanges(filePath: string, intent: Intent): Promise<OptimalRange[]> {
    if (!this.db) return [];
    
    try {
      const stmt = this.db.prepare(`
        SELECT ranges, success_score
        FROM range_history
        WHERE file_path = ? AND intent = ?
        ORDER BY timestamp DESC, success_score DESC
        LIMIT 3
      `);
      
      const rows = stmt.all(filePath, intent) as Array<{
        ranges: string;
        success_score: number;
      }>;
      
      const historicalRanges: OptimalRange[] = [];
      
      rows.forEach(row => {
        try {
          const ranges = JSON.parse(row.ranges) as OptimalRange[];
          // 成功スコアに基づいて関連性を調整
          ranges.forEach(range => {
            range.relevance = range.relevance * (0.7 + row.success_score * 0.3);
            range.reason = `${range.reason || ''} (履歴データから学習)`;
            historicalRanges.push(range);
          });
        } catch {
          logger.warn('Failed to parse historical ranges');
        }
      });
      
      return historicalRanges;
      
    } catch (error) {
      logger.error('Failed to get historical ranges', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * 範囲の最適化と統合
   */
  private optimizeRanges(
    ranges: OptimalRange[], 
    totalLines: number,
    maxRanges: number
  ): OptimalRange[] {
    if (ranges.length === 0) {
      return [{
        start: 1,
        end: Math.min(100, totalLines),
        label: 'ファイル先頭',
        relevance: 0.7,
        reason: 'デフォルトの読み込み範囲'
      }];
    }
    
    // 関連性でソート
    ranges.sort((a, b) => b.relevance - a.relevance);
    
    // 重複する範囲をマージ
    const mergedRanges: OptimalRange[] = [];
    
    ranges.forEach(range => {
      const overlapping = mergedRanges.find(
        mr => (range.start <= mr.end && range.end >= mr.start)
      );
      
      if (overlapping) {
        // 範囲をマージ
        overlapping.start = Math.min(overlapping.start, range.start);
        overlapping.end = Math.max(overlapping.end, range.end);
        overlapping.relevance = Math.max(overlapping.relevance, range.relevance);
        overlapping.label = `${overlapping.label} + ${range.label}`;
      } else {
        mergedRanges.push({ ...range });
      }
    });
    
    // 上位N個を返す
    return mergedRanges
      .slice(0, maxRanges)
      .sort((a, b) => a.start - b.start); // 行番号順にソート
  }

  /**
   * 範囲の使用履歴を記録
   */
  private async recordRangeHistory(
    filePath: string, 
    intent: Intent, 
    ranges: OptimalRange[]
  ): Promise<void> {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO range_history (file_path, intent, ranges, timestamp, file_extension)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        filePath,
        intent,
        JSON.stringify(ranges),
        Date.now(),
        path.extname(filePath)
      );
      
    } catch {
      logger.warn('Failed to record range history');
    }
  }

  /**
   * 使用フィードバックを記録（成功スコアの更新）
   */
  async recordFeedback(
    filePath: string, 
    intent: Intent, 
    successScore: number
  ): Promise<void> {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare(`
        UPDATE range_history
        SET success_score = ?
        WHERE file_path = ? AND intent = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      
      stmt.run(successScore, filePath, intent);
      logger.info('Feedback recorded', { filePath, intent, successScore });
      
    } catch (error) {
      logger.error('Failed to record feedback', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 統計情報の取得
   */
  async getStatistics(): Promise<{
    totalSuggestions: number;
    averageSuccessScore: number;
    popularIntents: Array<{ intent: string; count: number }>;
  }> {
    if (!this.db) {
      return {
        totalSuggestions: 0,
        averageSuccessScore: 0,
        popularIntents: []
      };
    }
    
    try {
      const total = this.db.prepare('SELECT COUNT(*) as count FROM range_history').get() as { count: number };
      const avgScore = this.db.prepare('SELECT AVG(success_score) as score FROM range_history').get() as { score: number };
      const intents = this.db.prepare(`
        SELECT intent, COUNT(*) as count
        FROM range_history
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 5
      `).all() as Array<{ intent: string; count: number }>;
      
      return {
        totalSuggestions: total.count || 0,
        averageSuccessScore: avgScore.score || 0,
        popularIntents: intents
      };
      
    } catch (error) {
      logger.error('Failed to get statistics', error instanceof Error ? error : new Error(String(error)));
      return {
        totalSuggestions: 0,
        averageSuccessScore: 0,
        popularIntents: []
      };
    }
  }

  /**
   * データベースのクローズ
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}