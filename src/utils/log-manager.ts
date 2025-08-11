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

// ツール系統の定義
export enum ToolCategory {
  FILE_OPERATIONS = 'file-operations',
  CODE_ANALYSIS = 'code-analysis',
  CODE_EDITING = 'code-editing',
  PROJECT_MANAGEMENT = 'project-management',
  WORKSPACE = 'workspace',
  SEARCH = 'search',
  LSP = 'lsp',
  GENERAL = 'general'
}

// ANSIカラーコード - IDE風の落ち着いた色合い
export const ANSI_COLORS = {
  // ツール系統別の色定義（IDEライクな落ち着いた色）
  FILE_OPERATIONS: '\x1b[38;5;34m',    // 落ち着いた緑 (ファイル操作)
  CODE_ANALYSIS: '\x1b[38;5;75m',      // 落ち着いた青 (コード解析)  
  CODE_EDITING: '\x1b[38;5;172m',      // 落ち着いたオレンジ (コード編集)
  PROJECT_MANAGEMENT: '\x1b[38;5;141m', // 落ち着いたマゼンタ (プロジェクト管理)
  WORKSPACE: '\x1b[38;5;73m',          // 落ち着いたシアン (ワークスペース)
  SEARCH: '\x1b[38;5;249m',            // 明るいグレー (検索)
  LSP: '\x1b[38;5;167m',               // 落ち着いた赤 (LSP操作)
  GENERAL: '\x1b[38;5;244m',           // ダークグレー (一般)
  
  // 状態別の色（IDEライク）
  SUCCESS: '\x1b[38;5;46m',            // 明るい緑
  ERROR: '\x1b[38;5;196m',             // 鮮やかな赤
  WARNING: '\x1b[38;5;214m',           // 温かいオレンジ
  INFO: '\x1b[38;5;117m',              // ソフトブルー
  
  // リセット
  RESET: '\x1b[0m',
  
  // スタイル
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m'
} as const;

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
    metadata?: Record<string, any>,
    intent?: string
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
      
      // 意図行＋操作行の2行形式
      let logEntry = '';
      if (intent) {
        // 意図行（色付きタイムスタンプ + 白い意図）
        logEntry += `${ANSI_COLORS.DIM}${timestamp}${ANSI_COLORS.RESET} ${ANSI_COLORS.BOLD}意図${ANSI_COLORS.RESET}: ${intent}\n`;
      }
      
      // 操作行（色付き操作名）
      const baseOperationEntry = `${timestamp} [${operation.toUpperCase()}]${fileInfo} | ${details}${metadataStr}\n`;
      const colorizedOperationEntry = this.colorizeLogEntry(operation.toUpperCase(), baseOperationEntry);
      logEntry += colorizedOperationEntry;

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
   * 操作名を基にツール系統を分類
   */
  private categorizeOperation(operation: string): ToolCategory {
    const op = operation.toUpperCase();
    
    // 具体的なパターンから優先的にマッチ（より具体的なものを先に）
    
    // プロジェクト管理系（PROJECT_MEMORY_WRITEなど、WRITEを含むが特殊なもの）
    if (op.includes('PROJECT') || op.includes('MEMORY') || op.includes('WORKFLOW')) {
      return ToolCategory.PROJECT_MANAGEMENT;
    }
    
    // ワークスペース系
    if (op.includes('WORKSPACE')) {
      return ToolCategory.WORKSPACE;
    }
    
    // コード解析系
    if (op.includes('CODE_GET') || op.includes('CODE_ANALYZE') || 
        op.includes('SYMBOLS') || op.includes('HIERARCHY') || op.includes('DEPENDENCIES')) {
      return ToolCategory.CODE_ANALYSIS;
    }
    
    // コード編集系
    if (op.includes('CODE_REPLACE') || op.includes('CODE_INSERT') || 
        op.includes('REGEX') || op.includes('SYMBOL_BODY')) {
      return ToolCategory.CODE_EDITING;
    }
    
    // LSP系
    if (op.includes('FIND_SYMBOL') || op.includes('FIND_REFERENCES') || 
        op.includes('LSP') || op.includes('REFERENCING')) {
      return ToolCategory.LSP;
    }
    
    // 検索系
    if (op.includes('SEARCH') || op.includes('PATTERN')) {
      return ToolCategory.SEARCH;
    }
    
    // ファイル操作系（汎用的なキーワードなので最後の方）
    if (op.includes('READ') || op.includes('WRITE') || op.includes('LIST') || 
        op.includes('FILE') || op.includes('DIRECTORY') || op.includes('METADATA') ||
        op.includes('INSERT_TEXT') || op.includes('SMART_EDIT')) {
      return ToolCategory.FILE_OPERATIONS;
    }
    
    // デフォルトは一般
    return ToolCategory.GENERAL;
  }

  /**
   * ログエントリをANSIカラーで装飾
   */
  private colorizeLogEntry(operation: string, logEntry: string): string {
    // テスト環境では色付けを無効化
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return logEntry;
    }

    const category = this.categorizeOperation(operation);
    
    let color: string;
    switch (category) {
      case ToolCategory.FILE_OPERATIONS:
        color = ANSI_COLORS.FILE_OPERATIONS;
        break;
      case ToolCategory.CODE_ANALYSIS:
        color = ANSI_COLORS.CODE_ANALYSIS;
        break;
      case ToolCategory.CODE_EDITING:
        color = ANSI_COLORS.CODE_EDITING;
        break;
      case ToolCategory.PROJECT_MANAGEMENT:
        color = ANSI_COLORS.PROJECT_MANAGEMENT;
        break;
      case ToolCategory.WORKSPACE:
        color = ANSI_COLORS.WORKSPACE;
        break;
      case ToolCategory.SEARCH:
        color = ANSI_COLORS.SEARCH;
        break;
      case ToolCategory.LSP:
        color = ANSI_COLORS.LSP;
        break;
      case ToolCategory.GENERAL:
      default:
        color = ANSI_COLORS.GENERAL;
        break;
    }
    
    // 操作名部分（[OPERATION]）に色を適用
    const colorizedEntry = logEntry.replace(
      /\[([^\]]+)\]/,
      `${color}[$1]${ANSI_COLORS.RESET}`
    );
    
    return colorizedEntry;
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