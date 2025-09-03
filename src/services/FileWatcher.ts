import * as chokidar from 'chokidar';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from './logger.js';

const logger = Logger.getInstance();

/**
 * ファイル変更イベントの型定義
 */
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  hash?: string;
  stats?: fs.Stats;
  timestamp: number;
}

/**
 * ファイル監視設定の型定義
 */
export interface FileWatcherOptions {
  ignored?: string[];
  depth?: number;
  usePolling?: boolean;
  interval?: number;
  binaryInterval?: number;
  awaitWriteFinish?: boolean;
  ignorePermissionErrors?: boolean;
  atomic?: boolean;
}

/**
 * ファイル情報のキャッシュ
 */
interface FileInfo {
  path: string;
  hash: string;
  size: number;
  modified: number;
  lastChecked: number;
}

/**
 * 高性能ファイル監視システム
 * chokidarを使用してリアルタイムでファイル変更を検知
 */
export class FileWatcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher;
  private fileCache: Map<string, FileInfo> = new Map();
  private watchedPaths: Set<string> = new Set();
  private isWatching: boolean = false;
  private changeBuffer: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceMs: number = 100;

  /**
   * デフォルトの無視パターン
   */
  private static readonly DEFAULT_IGNORED = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/dist/**',
    '**/build/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.log',
    '**/tmp/**',
    '**/.tmp/**',
    '**/.cache/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.swp',
    '**/*.swo',
    '**/*~'
  ];

  constructor(private options: FileWatcherOptions = {}) {
    super();
    this.setupOptions();
  }

  /**
   * オプションの設定
   */
  private setupOptions(): void {
    this.options = {
      ignored: [
        ...FileWatcher.DEFAULT_IGNORED,
        ...(this.options.ignored || [])
      ],
      depth: this.options.depth || undefined,
      usePolling: this.options.usePolling || false,
      interval: this.options.interval || 100,
      binaryInterval: this.options.binaryInterval || 300,
      awaitWriteFinish: this.options.awaitWriteFinish !== false,
      ignorePermissionErrors: this.options.ignorePermissionErrors !== false,
      atomic: this.options.atomic !== false,
      ...this.options
    };
  }

  /**
   * ディレクトリの監視を開始
   */
  async watch(paths: string | string[]): Promise<void> {
    const watchPaths = Array.isArray(paths) ? paths : [paths];
    
    try {
      // 既存のウォッチャーがあれば新しいパスを追加
      if (this.watcher && this.isWatching) {
        this.watcher.add(watchPaths);
        watchPaths.forEach(p => this.watchedPaths.add(p));
        logger.info('Added paths to existing watcher', { paths: watchPaths });
        return;
      }

      // 新しいウォッチャーを作成
      this.watcher = chokidar.watch(watchPaths, {
        ignored: this.options.ignored,
        persistent: true,
        ignoreInitial: false,
        followSymlinks: false,
        usePolling: this.options.usePolling,
        interval: this.options.interval,
        binaryInterval: this.options.binaryInterval,
        awaitWriteFinish: this.options.awaitWriteFinish ? {
          stabilityThreshold: 2000,
          pollInterval: 100
        } : false,
        ignorePermissionErrors: this.options.ignorePermissionErrors,
        atomic: this.options.atomic,
        depth: this.options.depth
      });

      // イベントリスナーの設定
      this.setupEventListeners();
      
      // 初期スキャンの完了を待つ
      await new Promise<void>((resolve) => {
        this.watcher!.once('ready', () => {
          this.isWatching = true;
          watchPaths.forEach(p => this.watchedPaths.add(p));
          logger.info('File watcher ready', { 
            paths: watchPaths,
            fileCount: this.fileCache.size 
          });
          resolve();
        });
      });

    } catch (error) {
      logger.error('Failed to start file watcher', error as Error);
      throw error;
    }
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    if (!this.watcher) return;

    // ファイル追加イベント
    this.watcher.on('add', (filePath: string, stats?: fs.Stats) => {
      this.handleFileEvent('add', filePath, stats);
    });

    // ファイル変更イベント
    this.watcher.on('change', (filePath: string, stats?: fs.Stats) => {
      this.handleFileEvent('change', filePath, stats);
    });

    // ファイル削除イベント
    this.watcher.on('unlink', (filePath: string) => {
      this.handleFileEvent('unlink', filePath);
    });

    // エラーイベント
    this.watcher.on('error', (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('File watcher error', error);
      this.emit('error', error);
    });
  }

  /**
   * ファイルイベントの処理（デバウンス機能付き）
   */
  private handleFileEvent(type: 'add' | 'change' | 'unlink', filePath: string, stats?: fs.Stats): void {
    // デバウンス処理
    const existingTimeout = this.changeBuffer.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      this.changeBuffer.delete(filePath);
      
      try {
        let hash: string | undefined;
        
        if (type !== 'unlink' && stats) {
          // ファイルハッシュの計算
          hash = await this.calculateFileHash(filePath);
          
          // キャッシュの更新
          if (hash) {
            const fileInfo: FileInfo = {
              path: filePath,
              hash,
              size: stats.size,
              modified: stats.mtimeMs,
              lastChecked: Date.now()
            };
            
            // 変更検知（既存ファイルの場合）
            const cached = this.fileCache.get(filePath);
            if (type === 'change' && cached && cached.hash === hash) {
              // ハッシュが同じなら実質的な変更なし
              return;
            }
            
            this.fileCache.set(filePath, fileInfo);
          }
        } else if (type === 'unlink') {
          // キャッシュから削除
          this.fileCache.delete(filePath);
        }

        // イベントの発火
        const event: FileChangeEvent = {
          type,
          path: filePath,
          hash,
          stats,
          timestamp: Date.now()
        };
        
        this.emit('change', event);
        this.emit(type, event);
        
        logger.debug(`File ${type}: ${filePath}`, { hash });
        
      } catch (error) {
        logger.error(`Failed to process file event: ${filePath}`, error as Error);
      }
    }, this.debounceMs);

    this.changeBuffer.set(filePath, timeout);
  }

  /**
   * ファイルのハッシュ値を計算
   */
  private async calculateFileHash(filePath: string): Promise<string | undefined> {
    try {
      if (!fs.existsSync(filePath)) return undefined;
      
      const stats = fs.statSync(filePath);
      
      // 大きなファイルは部分的なハッシュ計算
      if (stats.size > 50 * 1024 * 1024) { // 50MB以上
        return this.calculatePartialHash(filePath, stats.size);
      }
      
      // 通常のハッシュ計算
      const content = await fs.promises.readFile(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
      
    } catch (error) {
      logger.error(`Failed to calculate hash for ${filePath}`, error as Error);
      return undefined;
    }
  }

  /**
   * 大きなファイルの部分的なハッシュ計算
   */
  private async calculatePartialHash(filePath: string, fileSize: number): Promise<string> {
    const chunkSize = 1024 * 1024; // 1MB
    const chunks: Buffer[] = [];
    
    const stream = fs.createReadStream(filePath, {
      start: 0,
      end: chunkSize - 1
    });
    
    // 最初の1MB
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    
    // 最後の1MB（ファイルが2MB以上の場合）
    if (fileSize > chunkSize * 2) {
      const endStream = fs.createReadStream(filePath, {
        start: fileSize - chunkSize,
        end: fileSize - 1
      });
      
      for await (const chunk of endStream) {
        chunks.push(chunk as Buffer);
      }
    }
    
    // ファイルサイズとタイムスタンプも含める
    const stats = fs.statSync(filePath);
    const metadata = Buffer.from(`${fileSize}-${stats.mtimeMs}`);
    chunks.push(metadata);
    
    return crypto.createHash('md5').update(Buffer.concat(chunks)).digest('hex');
  }

  /**
   * 監視中のファイル情報を取得
   */
  getFileInfo(filePath: string): FileInfo | undefined {
    return this.fileCache.get(filePath);
  }

  /**
   * すべての監視中ファイルの情報を取得
   */
  getAllFileInfo(): Map<string, FileInfo> {
    return new Map(this.fileCache);
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.fileCache.clear();
    logger.info('File cache cleared');
  }

  /**
   * 特定のパスの監視を停止
   */
  unwatch(paths: string | string[]): void {
    if (!this.watcher) return;
    
    const unwatchPaths = Array.isArray(paths) ? paths : [paths];
    this.watcher.unwatch(unwatchPaths);
    unwatchPaths.forEach(p => this.watchedPaths.delete(p));
    
    logger.info('Unwatched paths', { paths: unwatchPaths });
  }

  /**
   * ファイル監視を停止
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      // デバウンス中のタイマーをクリア
      for (const timeout of this.changeBuffer.values()) {
        clearTimeout(timeout);
      }
      this.changeBuffer.clear();
      
      await this.watcher.close();
      this.watcher = undefined;
      this.isWatching = false;
      this.watchedPaths.clear();
      
      logger.info('File watcher stopped');
    }
  }

  /**
   * 監視状態を取得
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * 監視中のパスを取得
   */
  getWatchedPaths(): string[] {
    return Array.from(this.watchedPaths);
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    isWatching: boolean;
    watchedPaths: number;
    cachedFiles: number;
    pendingChanges: number;
  } {
    return {
      isWatching: this.isWatching,
      watchedPaths: this.watchedPaths.size,
      cachedFiles: this.fileCache.size,
      pendingChanges: this.changeBuffer.size
    };
  }
}