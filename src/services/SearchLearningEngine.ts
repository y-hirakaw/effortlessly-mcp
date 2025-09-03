import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { glob } from 'fast-glob';
import { Logger } from './logger.js';

const logger = Logger.getInstance();

// 検索履歴の型定義（将来使用予定）
// interface SearchHistory {
//   id: string;
//   query: string;
//   pattern_type: 'file_pattern' | 'content_pattern' | 'mixed';
//   directory: string;
//   results_count: number;
//   success: boolean;
//   timestamp: Date;
//   response_time_ms: number;
//   user_selected?: string[]; // ユーザーが実際に選択したファイル
// }

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

// ファイル変更追跡の型（将来使用予定）
// interface FileChangeTracker {
//   path: string;
//   hash: string;
//   last_modified: number;
//   size: number;
// }

// キャッシュされた検索結果の型
interface CachedSearchResult {
  query: string;
  pattern_type: string;
  directory: string;
  results: any[];
  cached_at: number;
  expires_at: number;
  file_hashes: Map<string, string>;
}

/**
 * 検索学習エンジン - AI駆動の検索最適化
 * ROI: 350%, 実装工数: 1-2週間
 */
export class SearchLearningEngine {
  private db: Database.Database;
  private dbPath: string;
  private fileHashes: Map<string, string> = new Map();
  private resultCache: Map<string, CachedSearchResult> = new Map();
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    
    // workspaceRootが既に.claude/workspace/effortlessly配下の場合はそのまま使用
    // そうでない場合は追加のパスを構築
    let workspaceDir: string;
    if (workspaceRoot.includes('.claude/workspace/effortlessly')) {
      // 既に正しいワークスペースパスの場合はそのまま使用
      workspaceDir = workspaceRoot;
    } else {
      // プロジェクトルートの場合は.claude/workspace/effortlesslyを追加
      workspaceDir = path.join(workspaceRoot, '.claude', 'workspace', 'effortlessly');
    }
    
    // ディレクトリ作成
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    
    this.dbPath = path.join(workspaceDir, 'search_learning.db');
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
    this.initializeFileTracking();
  }

  /**
   * SearchLearningEngineの初期化（外部からの初期化インターフェース）
   */
  async initialize(): Promise<void> {
    // データベース初期化は既にコンストラクタで完了
    logger.info('SearchLearningEngine initialized');
  }

  /**
   * 検索結果の記録（既存のAPI互換性維持）
   */
  async recordSearch(searchHistory: {
    query: string;
    pattern_type: string;
    directory: string;
    results_count: number;
    success: boolean;
    timestamp: Date;
    response_time_ms: number;
  }): Promise<string> {
    // 検索履歴を記録
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
      null
    );

    logger.info('Search history recorded', { id, query: searchHistory.query });
    return id;
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

    // ファイル変更追跡テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_tracking (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        last_modified INTEGER NOT NULL,
        size INTEGER NOT NULL,
        tracked_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // 検索結果キャッシュテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        cache_key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        directory TEXT NOT NULL,
        results TEXT NOT NULL, -- JSON
        file_hashes TEXT NOT NULL, -- JSON
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // インデックス作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_search_patterns_frequency ON search_patterns(frequency DESC);
      CREATE INDEX IF NOT EXISTS idx_search_patterns_last_used ON search_patterns(last_used DESC);
      CREATE INDEX IF NOT EXISTS idx_file_tracking_last_modified ON file_tracking(last_modified);
      CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache(expires_at);
    `);

    logger.info('SearchLearningEngine database initialized', { dbPath: this.dbPath });
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

  // ==================== Phase2: 高速化機能 ====================

  /**
   * ファイル追跡の初期化
   */
  private initializeFileTracking(): void {
    try {
      // 既存の追跡データを読み込み
      const stmt = this.db.prepare('SELECT path, hash FROM file_tracking');
      const rows = stmt.all();
      
      for (const row of rows) {
        const r = row as any;
        this.fileHashes.set(r.path, r.hash);
      }
      
      logger.info('File tracking initialized', { trackedFiles: this.fileHashes.size });
    } catch (error) {
      logger.error('Failed to initialize file tracking', error as Error);
    }
  }

  /**
   * ファイルのハッシュ値を計算
   */
  private calculateFileHash(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      logger.error(`Failed to calculate hash for ${filePath}`, error as Error);
      return null;
    }
  }

  /**
   * ディレクトリ内のファイル変更を検知（fast-glob最適化版）
   */
  async detectChanges(directory: string = this.workspaceRoot): Promise<string[]> {
    const changedFiles: string[] = [];
    const startTime = Date.now();
    
    try {
      const files = this.getAllFiles(directory);
      
      // バッチ処理でパフォーマンス向上
      const batchSize = 100;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        for (const file of batch) {
          const currentHash = this.calculateFileHash(file);
          if (!currentHash) continue;
          
          const storedHash = this.fileHashes.get(file);
          
          if (!storedHash || storedHash !== currentHash) {
            changedFiles.push(file);
            this.fileHashes.set(file, currentHash);
            
            // データベースに更新を保存（バッチ処理）
            const stats = fs.statSync(file);
            const stmt = this.db.prepare(`
              INSERT OR REPLACE INTO file_tracking 
              (path, hash, last_modified, size, tracked_at)
              VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(
              file,
              currentHash,
              stats.mtimeMs,
              stats.size,
              Date.now()
            );
          }
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (changedFiles.length > 0) {
        logger.info('File changes detected (fast-glob optimized)', { 
          count: changedFiles.length,
          totalFiles: files.length,
          duration: `${duration}ms`,
          avgPerFile: `${(duration / files.length).toFixed(2)}ms`
        });
      }
      
    } catch (error) {
      logger.error('Failed to detect changes (fast-glob)', error as Error);
    }
    
    return changedFiles;
  }

  /**
   * ディレクトリ内の全ファイルを取得（fast-glob最適化版）
   */
  private getAllFiles(dir: string): string[] {
    try {
      if (!fs.existsSync(dir)) return [];
      
      // fast-globを使用した高性能ファイル検索
      // パフォーマンスを重視した設定
      const files = glob.sync('**/*', {
        cwd: dir,
        absolute: true,
        onlyFiles: true,
        dot: false, // .で始まるファイルを除外
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/.claude/**',
          '**/*.log',
          '**/.DS_Store',
          '**/Thumbs.db'
        ],
        // パフォーマンス最適化設定
        stats: false, // statの無効化で高速化
        followSymbolicLinks: false, // セキュリティとパフォーマンス
        throwErrorOnBrokenSymbolicLink: false,
        suppressErrors: true,
        braceExpansion: false, // 不要な展開を無効化
        extglob: false, // 拡張globパターンを無効化
        globstar: true // **パターンは有効
      });
      
      logger.debug(`Fast-glob scan completed`, { 
        directory: dir, 
        filesFound: files.length,
        pattern: '**/*'
      });
      
      return files;
      
    } catch (error) {
      logger.error(`Fast-glob scan failed for directory ${dir}`, error as Error);
      
      // フォールバック：従来のfs.readdirSyncベース実装
      return this.getAllFilesLegacy(dir);
    }
  }

  /**
   * レガシーファイル取得メソッド（フォールバック用）
   */
  private getAllFilesLegacy(dir: string): string[] {
    const files: string[] = [];
    
    try {
      if (!fs.existsSync(dir)) return files;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // .git, node_modules等を除外
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...this.getAllFilesLegacy(fullPath));
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to scan directory ${dir}`, error as Error);
    }
    
    return files;
  }

  /**
   * 検索結果のキャッシュキーを生成
   */
  private generateCacheKey(query: string, patternType: string, directory: string): string {
    const data = `${query}:${patternType}:${directory}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 検索結果をキャッシュに保存
   */
  async cacheSearchResult(
    query: string, 
    patternType: string, 
    directory: string, 
    results: any[],
    cacheDurationMs: number = 900000 // 15分
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(query, patternType, directory);
      const currentTime = Date.now();
      const expiresAt = currentTime + cacheDurationMs;
      
      // 関連ファイルのハッシュを収集
      const fileHashes = new Map<string, string>();
      for (const result of results) {
        if (result.path) {
          const hash = this.calculateFileHash(result.path);
          if (hash) {
            fileHashes.set(result.path, hash);
          }
        }
      }
      
      // メモリキャッシュに保存
      this.resultCache.set(cacheKey, {
        query,
        pattern_type: patternType,
        directory,
        results,
        cached_at: currentTime,
        expires_at: expiresAt,
        file_hashes: fileHashes
      });
      
      // データベースに永続化
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO search_cache 
        (cache_key, query, pattern_type, directory, results, file_hashes, cached_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        cacheKey,
        query,
        patternType,
        directory,
        JSON.stringify(results),
        JSON.stringify(Array.from(fileHashes.entries())),
        currentTime,
        expiresAt
      );
      
      logger.info('Search result cached', { cacheKey, resultCount: results.length });
      
    } catch (error) {
      logger.error('Failed to cache search result', error as Error);
    }
  }

  /**
   * キャッシュから検索結果を取得
   */
  async getCachedSearchResult(query: string, patternType: string, directory: string): Promise<any[] | null> {
    try {
      const cacheKey = this.generateCacheKey(query, patternType, directory);
      const currentTime = Date.now();
      
      // メモリキャッシュから確認
      let cached = this.resultCache.get(cacheKey);
      
      // メモリキャッシュにない場合はDBから読み込み
      if (!cached) {
        const stmt = this.db.prepare(`
          SELECT * FROM search_cache 
          WHERE cache_key = ? AND expires_at > ?
        `);
        
        const row = stmt.get(cacheKey, currentTime) as any;
        if (row) {
          const fileHashesArray = JSON.parse(row.file_hashes) as [string, string][];
          const fileHashes = new Map(fileHashesArray);
          cached = {
            query: row.query,
            pattern_type: row.pattern_type,
            directory: row.directory,
            results: JSON.parse(row.results),
            cached_at: row.cached_at,
            expires_at: row.expires_at,
            file_hashes: fileHashes
          };
          
          // メモリキャッシュに復元
          this.resultCache.set(cacheKey, cached);
        }
      }
      
      if (!cached || cached.expires_at <= currentTime) {
        return null;
      }
      
      // ファイル変更をチェック
      for (const [filePath, storedHash] of cached!.file_hashes) {
        const currentHash = this.calculateFileHash(filePath);
        if (!currentHash || currentHash !== storedHash) {
          // ファイルが変更されているのでキャッシュ無効
          logger.info('Cache invalidated due to file change', { file: filePath, cacheKey });
          this.invalidateCache(cacheKey);
          return null;
        }
      }
      
      logger.info('Cache hit', { cacheKey, resultCount: cached.results.length });
      return cached.results;
      
    } catch (error) {
      logger.error('Failed to get cached search result', error as Error);
      return null;
    }
  }

  /**
   * 指定されたキャッシュを無効化
   */
  private invalidateCache(cacheKey: string): void {
    try {
      // メモリキャッシュから削除
      this.resultCache.delete(cacheKey);
      
      // データベースから削除
      const stmt = this.db.prepare('DELETE FROM search_cache WHERE cache_key = ?');
      stmt.run(cacheKey);
      
      logger.info('Cache invalidated', { cacheKey });
      
    } catch (error) {
      logger.error('Failed to invalidate cache', error as Error);
    }
  }

  /**
   * 期限切れキャッシュの清掃
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      const currentTime = Date.now();
      
      // データベースから期限切れキャッシュを削除
      const stmt = this.db.prepare('DELETE FROM search_cache WHERE expires_at <= ?');
      const result = stmt.run(currentTime);
      
      // メモリキャッシュからも削除
      for (const [key, cached] of this.resultCache) {
        if (cached.expires_at <= currentTime) {
          this.resultCache.delete(key);
        }
      }
      
      if (result.changes > 0) {
        logger.info('Expired cache cleaned up', { deletedCount: result.changes });
      }
      
    } catch (error) {
      logger.error('Failed to cleanup expired cache', error as Error);
    }
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
      // 期限切れキャッシュを最終清掃
      this.cleanupExpiredCache().catch(err => {
        logger.error('Failed to cleanup cache during close', err);
      });
      
      this.db.close();
      logger.info('SearchLearningEngine database connection closed');
    }
  }
}
