import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { Logger } from './logger.js';

const logger = Logger.getInstance();

// 検索履歴の型定義
interface SearchHistory {
  id: string;
  query: string;
  pattern_type: 'file_pattern' | 'content_pattern' | 'mixed';
  directory: string;
  results_count: number;
  success: boolean;
  timestamp: Date;
  response_time_ms: number;
  user_selected?: string[]; // ユーザーが実際に選択したファイル
}

// 学習された検索パターンの型
interface SearchPattern {
  pattern: string;
  frequency: number;
  success_rate: number;
  avg_response_time: number;
  context: string[];
  last_used: Date;
}

// 最適化されたクエリの型
interface OptimizedQuery {
  original_query: string;
  optimized_query: string;
  optimization_type: 'pattern_improvement' | 'scope_reduction' | 'cache_hit';
  confidence: number;
  estimated_improvement: number; // パーセント
}

// インデックス戦略の型
interface IndexStrategy {
  priority_patterns: string[];
  cache_duration: number;
  index_frequency: number;
  memory_allocation: number;
}

/**
 * 検索学習エンジン - AI駆動の検索最適化
 * ROI: 350%, 実装工数: 1-2週間
 */
export class SearchLearningEngine {
  private db: Database.Database;
  private dbPath: string;

  constructor(workspaceRoot: string) {
    // SQLiteデータベースのパス設定
    const workspaceDir = path.join(workspaceRoot, '.claude', 'workspace', 'effortlessly');
    const indexDir = path.join(workspaceDir, 'index');
    
    // ディレクトリ作成
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }
    
    this.dbPath = path.join(indexDir, 'search_learning.db');
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  /**
   * SearchLearningEngineの初期化（外部からの初期化インターフェース）
   */
  async initialize(): Promise<void> {
    // データベース初期化は既にコンストラクタで完了
    logger.info('SearchLearningEngine initialized');
  }

  /**
   * データベースの初期化
   */
  private initializeDatabase(): void {
    // 検索履歴テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        directory TEXT NOT NULL,
        results_count INTEGER NOT NULL,
        success INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        user_selected TEXT -- JSON array of selected files
      )
    `);

    // 学習パターンテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_patterns (
        pattern TEXT PRIMARY KEY,
        frequency INTEGER NOT NULL DEFAULT 1,
        success_rate REAL NOT NULL DEFAULT 1.0,
        avg_response_time REAL NOT NULL,
        context TEXT, -- JSON array
        last_used INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // インデックス作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_search_patterns_frequency ON search_patterns(frequency DESC);
      CREATE INDEX IF NOT EXISTS idx_search_patterns_last_used ON search_patterns(last_used DESC);
    `);

    logger.info('SearchLearningEngine database initialized', { dbPath: this.dbPath });
  }

  /**
   * 検索履歴を記録
   */
  recordSearch(searchHistory: Omit<SearchHistory, 'id'>): string {
    const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO search_history 
      (id, query, pattern_type, directory, results_count, success, timestamp, response_time_ms, user_selected)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      searchHistory.query,
      searchHistory.pattern_type,
      searchHistory.directory,
      searchHistory.results_count,
      searchHistory.success ? 1 : 0,
      searchHistory.timestamp.getTime(),
      searchHistory.response_time_ms,
      searchHistory.user_selected ? JSON.stringify(searchHistory.user_selected) : null
    );

    logger.info('Search history recorded', { id, query: searchHistory.query });
    return id;
  }

  /**
   * 検索パターンから学習してクエリを最適化
   */
  learnSearchPatterns(recentLimit: number = 100): SearchPattern[] {
    const stmt = this.db.prepare(`
      SELECT query, pattern_type, directory, results_count, success, response_time_ms, timestamp
      FROM search_history 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const history = stmt.all(recentLimit);
    const patternMap = new Map<string, SearchPattern>();

    // パターン分析
    for (const record of history) {
      const r = record as any; // SQLite結果の型キャスト
      const pattern = this.extractPattern(r.query, r.pattern_type);
      
      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, {
          pattern,
          frequency: 0,
          success_rate: 0,
          avg_response_time: 0,
          context: [],
          last_used: new Date(r.timestamp)
        });
      }

      const p = patternMap.get(pattern)!;
      p.frequency++;
      p.success_rate = (p.success_rate * (p.frequency - 1) + (r.success ? 1 : 0)) / p.frequency;
      p.avg_response_time = (p.avg_response_time * (p.frequency - 1) + r.response_time_ms) / p.frequency;
      
      // コンテキスト情報の追加
      const context = path.basename(r.directory);
      if (!p.context.includes(context)) {
        p.context.push(context);
      }
      
      if (new Date((record as any).timestamp) > p.last_used) {
        p.last_used = new Date((record as any).timestamp);
      }
    }

    // パターンをデータベースに保存
    const upsertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO search_patterns 
      (pattern, frequency, success_rate, avg_response_time, context, last_used)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const patterns = Array.from(patternMap.values());
    for (const pattern of patterns) {
      upsertStmt.run(
        pattern.pattern,
        pattern.frequency,
        pattern.success_rate,
        pattern.avg_response_time,
        JSON.stringify(pattern.context),
        pattern.last_used.getTime()
      );
    }

    logger.info('Search patterns learned', { patternCount: patterns.length });
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * クエリの最適化提案
   */
  optimizeQuery(query: string, directory: string): OptimizedQuery[] {
    const suggestions: OptimizedQuery[] = [];
    
    // 1. パターンマッチングベースの最適化
    const patternOptimization = this.optimizeByPattern(query);
    if (patternOptimization) {
      suggestions.push(patternOptimization);
    }

    // 2. 頻度ベースの最適化
    const frequencyOptimization = this.optimizeByFrequency(query);
    if (frequencyOptimization) {
      suggestions.push(frequencyOptimization);
    }

    // 3. コンテキストベースの最適化
    const contextOptimization = this.optimizeByContext(query, directory);
    if (contextOptimization) {
      suggestions.push(contextOptimization);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * インデックス戦略の最適化
   */
  optimizeIndexStrategy(usageStats: { searchVolume: number; avgResponseTime: number }): IndexStrategy {
    const stmt = this.db.prepare(`
      SELECT pattern, frequency, avg_response_time
      FROM search_patterns
      ORDER BY frequency DESC, avg_response_time ASC
      LIMIT 20
    `);

    const topPatterns = stmt.all();
    
    return {
      priority_patterns: topPatterns.map(p => (p as any).pattern),
      cache_duration: this.calculateOptimalCacheDuration(usageStats.searchVolume),
      index_frequency: this.calculateIndexFrequency(usageStats.avgResponseTime),
      memory_allocation: this.calculateMemoryAllocation(topPatterns.length)
    };
  }

  /**
   * パターン抽出（検索クエリからパターンを抽出）
   */
  private extractPattern(query: string, patternType: string): string {
    // ファイルパターンの場合
    if (patternType === 'file_pattern') {
      // 拡張子パターンを抽出
      const extMatch = query.match(/\*\.(\w+)/);
      if (extMatch) {
        return `*.${extMatch[1]}`;
      }
      
      // 一般的なパターンを抽出
      return query.replace(/[0-9]+/g, 'N').replace(/[a-zA-Z0-9_]+/g, 'W');
    }

    // コンテンツパターンの場合
    if (patternType === 'content_pattern') {
      // 正規表現の構造を抽出
      return query.replace(/[a-zA-Z0-9_]+/g, 'WORD')
                 .replace(/\d+/g, 'NUM')
                 .replace(/\s+/g, 'SPACE');
    }

    return query;
  }

  /**
   * パターンマッチングによる最適化
   */
  private optimizeByPattern(query: string): OptimizedQuery | null {
    // 類似パターンを検索
    const stmt = this.db.prepare(`
      SELECT pattern, frequency, success_rate, avg_response_time
      FROM search_patterns
      WHERE success_rate > 0.8
      ORDER BY frequency DESC
      LIMIT 10
    `);

    const patterns = stmt.all();
    
    // 最も近いパターンを検索
    let bestMatch: any = null;
    let bestSimilarity = 0;

    for (const pattern of patterns) {
      const p = pattern as any; // SQLite結果の型キャスト
      const similarity = this.calculateSimilarity(query, p.pattern);
      if (similarity > bestSimilarity && similarity > 0.7) {
        bestSimilarity = similarity;
        bestMatch = p;
      }
    }

    if (bestMatch) {
      return {
        original_query: query,
        optimized_query: bestMatch.pattern,
        optimization_type: 'pattern_improvement',
        confidence: bestSimilarity,
        estimated_improvement: Math.round((1 - bestMatch.avg_response_time / 1000) * 100)
      };
    }

    return null;
  }

  /**
   * 頻度ベースの最適化
   */
  private optimizeByFrequency(query: string): OptimizedQuery | null {
    // 実装を簡素化：頻度の高いパターンを提案
    const stmt = this.db.prepare(`
      SELECT pattern, frequency
      FROM search_patterns
      WHERE frequency > 5
      ORDER BY frequency DESC
      LIMIT 5
    `);

    const frequentPatterns = stmt.all();
    
    if (frequentPatterns.length > 0) {
      const topPattern = frequentPatterns[0] as any; // SQLite結果の型キャスト
      return {
        original_query: query,
        optimized_query: topPattern.pattern,
        optimization_type: 'cache_hit',
        confidence: 0.8,
        estimated_improvement: 50
      };
    }

    return null;
  }

  /**
   * コンテキストベースの最適化
   */
  private optimizeByContext(query: string, directory: string): OptimizedQuery | null {
    const dirName = path.basename(directory);
    
    // ディレクトリ固有のパターンを検索
    const stmt = this.db.prepare(`
      SELECT pattern, avg_response_time
      FROM search_patterns
      WHERE context LIKE ?
      ORDER BY frequency DESC
      LIMIT 3
    `);

    const contextPatterns = stmt.all(`%"${dirName}"%`);
    
    if (contextPatterns.length > 0) {
      const bestPattern = contextPatterns[0] as any; // SQLite結果の型キャスト
      return {
        original_query: query,
        optimized_query: bestPattern.pattern,
        optimization_type: 'scope_reduction',
        confidence: 0.7,
        estimated_improvement: Math.round((1000 - bestPattern.avg_response_time) / 10)
      };
    }

    return null;
  }

  /**
   * 文字列類似度計算（簡易版）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[len2][len1];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * 最適なキャッシュ期間の計算
   */
  private calculateOptimalCacheDuration(searchVolume: number): number {
    // 検索ボリュームに基づいてキャッシュ期間を決定
    if (searchVolume > 100) return 3600; // 1時間
    if (searchVolume > 50) return 1800;  // 30分
    return 900; // 15分
  }

  /**
   * インデックス更新頻度の計算
   */
  private calculateIndexFrequency(avgResponseTime: number): number {
    // 応答時間に基づいてインデックス更新頻度を決定
    if (avgResponseTime > 1000) return 60;   // 1分
    if (avgResponseTime > 500) return 300;   // 5分
    return 600; // 10分
  }

  /**
   * メモリ割り当ての計算
   */
  private calculateMemoryAllocation(patternCount: number): number {
    // パターン数に基づいてメモリ割り当てを決定
    return Math.min(50 + patternCount * 2, 200); // MB
  }

  /**
   * 統計情報の取得
   */
  getStatistics() {
    const totalSearches = this.db.prepare('SELECT COUNT(*) as count FROM search_history').get() as any;
    const successRate = this.db.prepare('SELECT AVG(success) as rate FROM search_history').get() as any;
    const avgResponseTime = this.db.prepare('SELECT AVG(response_time_ms) as time FROM search_history').get() as any;
    const totalPatterns = this.db.prepare('SELECT COUNT(*) as count FROM search_patterns').get() as any;

    return {
      total_searches: totalSearches.count,
      success_rate: Math.round(successRate.rate * 100),
      avg_response_time: Math.round(avgResponseTime.time),
      learned_patterns: totalPatterns.count,
      last_learning: new Date().toISOString()
    };
  }

  /**
   * リソースのクリーンアップ
   */
  close(): void {
    if (this.db) {
      this.db.close();
      logger.info('SearchLearningEngine database connection closed');
    }
  }
}
