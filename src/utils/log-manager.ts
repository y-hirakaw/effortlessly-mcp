/**
 * LogManager - 統一されたログ管理システム
 * - diff.log: ファイル変更差分のログ
 * - operations.log: MCPツール操作の履歴
 * - 日付ベースのローテーション機能
 */

// import * as fs from 'fs'; // FileSystemService使用のため不要
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FileSystemService } from '../services/FileSystemService.js';
import { Logger } from '../services/logger.js';

export enum LogType {
  DIFF = 'diff',
  OPERATIONS = 'operations'
}

interface LogConfig {
  operations?: {
    enabled?: boolean;
  };
  diff?: {
    enabled?: boolean;
  };
}

// interface LogEntry { // 現在未使用のインターフェース
//   timestamp: string;
//   type: string;
//   details: string;
//   filePath?: string;
//   operation?: string;
// }

export class LogManager {
  private static instance: LogManager;
  private baseLogDir: string;
  private currentDate: string;
  private config: LogConfig | null = null;
  private configLoadTime: number = 0;
  private readonly CONFIG_CACHE_DURATION = 60000; // 1分間キャッシュ

  private constructor() {
    this.baseLogDir = path.resolve('.claude/workspace/effortlessly/logs');
    this.currentDate = this.getCurrentDateString();
  }

  public static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  /**
   * 現在の日付文字列を取得 (YYYY-MM-DD)
   */
  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 設定ファイルを読み込み
   */
  private loadConfig(): LogConfig {
    const now = Date.now();
    
    // キャッシュが有効な場合はキャッシュを返す
    if (this.config && (now - this.configLoadTime) < this.CONFIG_CACHE_DURATION) {
      return this.config;
    }

    // デフォルト設定
    const defaultConfig: LogConfig = {
      operations: { enabled: true },
      diff: { enabled: true }
    };

    try {
      const configPath = path.resolve('.claude/workspace/effortlessly/config.yaml');
      const fsService = FileSystemService.getInstance();
      
      if (fsService.existsSync(configPath)) {
        const configFile = fsService.readFileSync(configPath, 'utf-8');
        const fullConfig = yaml.load(configFile) as any;
        const userConfig = fullConfig?.logging as LogConfig;
        
        // デフォルト設定とユーザー設定をマージ
        this.config = {
          operations: {
            enabled: userConfig?.operations?.enabled ?? defaultConfig.operations?.enabled
          },
          diff: {
            enabled: userConfig?.diff?.enabled ?? defaultConfig.diff?.enabled
          }
        };
      } else {
        // 設定ファイルが存在しない場合はデフォルト設定を使用
        this.config = defaultConfig;
      }
    } catch (error) {
      // 設定ファイル読み込みに失敗した場合はデフォルト設定を使用
      Logger.getInstance().warn('Failed to load log config, using defaults', { error });
      this.config = defaultConfig;
    }

    this.configLoadTime = now;
    return this.config;
  }

  /**
   * 日付チェック＆ローテーション
   */
  private async checkAndRotate(logType: LogType): Promise<void> {
    const today = this.getCurrentDateString();
    
    if (this.currentDate !== today) {
      // 日付が変わった場合、昨日のログをローテーション
      await this.rotateLog(logType, this.currentDate);
      this.currentDate = today;
    }
  }

  /**
   * ログファイルのローテーション
   */
  private async rotateLog(logType: LogType, oldDate: string): Promise<void> {
    try {
      const fsService = FileSystemService.getInstance();
      const logDir = path.join(this.baseLogDir, logType);
      const currentLogFile = path.join(logDir, `${logType}.log`);
      const rotatedLogFile = path.join(logDir, `${oldDate}-${logType}.log`);

      // 現在のログファイルが存在し、空でない場合のみローテーション
      try {
        await fsService.access(currentLogFile);
        const stats = await fsService.stat(currentLogFile);
        if (stats.size > 0) {
          // ローテーション実行
          await fsService.rename(currentLogFile, rotatedLogFile);
          Logger.getInstance().info(`Log rotated: ${currentLogFile} → ${rotatedLogFile}`);
        }
      } catch (fileError) {
        // ファイルが存在しない場合は何もしない
      }
    } catch (error) {
      Logger.getInstance().error('Failed to rotate log', error as Error);
    }
  }

  /**
   * ログディレクトリの初期化
   */
  private async ensureLogDirectory(logType: LogType): Promise<void> {
    const fsService = FileSystemService.getInstance();
    const logDir = path.join(this.baseLogDir, logType);
    await fsService.mkdir(logDir, { recursive: true });
  }

  /**
   * 差分ログの出力
   */
  public async logDiff(
    _originalContent: string, // 現在は未使用だがAPIの互換性のため保持
    _newContent: string,      // 現在は未使用だがAPIの互換性のため保持
    filePath: string,
    operation: string,
    diffContent: string
  ): Promise<void> {
    try {
      await this.checkAndRotate(LogType.DIFF);
      await this.ensureLogDirectory(LogType.DIFF);

      // diff出力が空の場合はスキップ
      if (!diffContent || diffContent.trim() === '') {
        return;
      }

      const fsService = FileSystemService.getInstance();
      const logFile = path.join(this.baseLogDir, LogType.DIFF, `${LogType.DIFF}.log`);
      
      const timestamp = new Date().toISOString();
      const logEntry = `
=== ${timestamp} ===
File: ${filePath} (${operation})
${diffContent}
========================

`;

      await fsService.appendFile(logFile, logEntry, { encoding: 'utf8' });
    } catch (error) {
      Logger.getInstance().error('Failed to log diff', error as Error);
    }
  }

  /**
   * 操作ログの出力
   */
  public async logOperation(
    operation: string,
    filePath: string | null,
    details: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // 設定チェック - operationsログが無効化されている場合は処理をスキップ
    const config = this.loadConfig();
    if (config.operations?.enabled === false) {
      return;
    }

    try {
      await this.checkAndRotate(LogType.OPERATIONS);
      await this.ensureLogDirectory(LogType.OPERATIONS);

      const fsService = FileSystemService.getInstance();
      const logFile = path.join(this.baseLogDir, LogType.OPERATIONS, `${LogType.OPERATIONS}.log`);
      
      const timestamp = new Date().toISOString();
      const fileInfo = filePath ? ` | File: ${filePath}` : '';
      const metadataStr = metadata ? ` | Metadata: ${JSON.stringify(metadata)}` : '';
      
      const logEntry = `${timestamp} [${operation.toUpperCase()}]${fileInfo} | ${details}${metadataStr}\n`;

      await fsService.appendFile(logFile, logEntry, { encoding: 'utf8' });
    } catch (error) {
      Logger.getInstance().error('Failed to log operation', error as Error);
    }
  }

  /**
   * 操作ログ（簡易版）- ファイル操作用
   */
  public async logFileOperation(
    operation: string,
    filePath: string,
    details: string
  ): Promise<void> {
    await this.logOperation(operation, filePath, details);
  }

  /**
   * 操作ログ（検索系）- 検索操作用
   */
  public async logSearchOperation(
    operation: string,
    searchPattern: string,
    resultCount: number,
    directory?: string
  ): Promise<void> {
    const details = directory 
      ? `Pattern: "${searchPattern}" in ${directory} → ${resultCount} results`
      : `Pattern: "${searchPattern}" → ${resultCount} results`;
    
    await this.logOperation(operation, null, details);
  }

  /**
   * 操作ログ（LSP系）- LSP操作用
   */
  public async logLSPOperation(
    operation: string,
    symbol: string,
    filePath?: string,
    resultCount?: number
  ): Promise<void> {
    const details = resultCount !== undefined 
      ? `Symbol: "${symbol}" → ${resultCount} results`
      : `Symbol: "${symbol}"`;
    
    await this.logOperation(operation, filePath || null, details);
  }

  /**
   * 手動ローテーション（テスト用）
   */
  public async forceRotate(logType: LogType): Promise<void> {
    await this.rotateLog(logType, this.currentDate);
  }

  /**
   * 古いログファイルのクリーンアップ（指定日数以前のファイルを削除）
   */
  public async cleanupOldLogs(logType: LogType, retentionDays: number = 30): Promise<void> {
    try {
      const fsService = FileSystemService.getInstance();
      const logDir = path.join(this.baseLogDir, logType);
      
      try {
        await fsService.access(logDir);
      } catch {
        return;
      }

      const files = await fsService.readdir(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      for (const file of files) {
        // ファイル名を文字列として取得
        const fileName = typeof file === 'string' ? file : file.name;
        
        // 日付付きファイル名のパターン: YYYY-MM-DD-{type}.log
        const match = fileName.match(/^(\d{4}-\d{2}-\d{2})-/);
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < cutoffDate) {
            const filePath = path.join(logDir, fileName);
            await fsService.unlink(filePath);
            Logger.getInstance().info(`Cleaned up old log: ${filePath}`);
          }
        }
      }
    } catch (error) {
      Logger.getInstance().error('Failed to cleanup old logs', error as Error);
    }
  }
}