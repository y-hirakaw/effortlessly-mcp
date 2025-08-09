/**
 * DiffLogger - 差分ログ出力の共通ユーティリティ
 * smart-edit-file と smart-insert-text で共通利用
 * 新しいLogManagerシステムに統合
 */

import { Logger } from '../services/logger.js';
import { LogManager } from './log-manager.js';
import { highQualityDiff } from './high-quality-diff.js';

export class DiffLogger {
  private static instance: DiffLogger;
  
  private constructor() {}
  
  public static getInstance(): DiffLogger {
    if (!DiffLogger.instance) {
      DiffLogger.instance = new DiffLogger();
    }
    return DiffLogger.instance;
  }

  /**
   * 精密なdiffログ出力（編集・挿入操作共通）
   */
  public async logPreciseDiff(
    originalContent: string, 
    newContent: string, 
    filePath: string, 
    operation: string
  ): Promise<void> {
    try {
      const logManager = LogManager.getInstance();
      
      // 精密なdiff生成：詳細コンテキスト表示
      const diff = highQualityDiff.generateDiff(originalContent, newContent, filePath, {
        contextLines: 3,  // デフォルトコンテキスト
        useColors: true
      });
      
      if (diff.trim() === '') {
        return; // 変更なし
      }
      
      // LogManagerを使用してdiffログに出力
      await logManager.logDiff(originalContent, newContent, filePath, operation, diff);
    } catch (error) {
      // ログ出力エラーは無視（主要操作を妨げない）
      Logger.getInstance().error('Failed to log precise diff:', error as Error);
    }
  }

  /**
   * Insert操作専用の詳細diffログ出力
   */
  public async logInsertDiff(
    originalContent: string,
    insertedText: string,
    insertPosition: { line_number: number; column: number },
    filePath: string,
    positionType: string,
    referenceText?: string
  ): Promise<void> {
    try {
      const logManager = LogManager.getInstance();
      
      // Insert専用の詳細diff生成
      const diff = this.generateInsertSpecificDiff(
        originalContent,
        insertedText,
        insertPosition,
        filePath,
        positionType,
        referenceText
      );
      
      if (diff.trim() === '') {
        return;
      }
      
      // 一時的にnewContentを生成（LogManagerの引数として必要）
      const lines = originalContent.split('\n');
      const insertedLines = insertedText.split('\n');
      lines.splice(insertPosition.line_number - 1, 0, ...insertedLines);
      const newContent = lines.join('\n');
      
      // LogManagerを使用してdiffログに出力
      await logManager.logDiff(originalContent, newContent, filePath, 'Smart Insert', diff);
    } catch (error) {
      Logger.getInstance().error('Failed to log insert diff:', error as Error);
    }
  }

  /**
   * Insert専用diff生成ロジック
   */
  private generateInsertSpecificDiff(
    originalContent: string,
    insertedText: string,
    insertPosition: { line_number: number; column: number },
    filePath: string,
    positionType: string,
    referenceText?: string
  ): string {
    const colors = {
      RED: '\x1b[31m',
      GREEN: '\x1b[32m',
      CYAN: '\x1b[36m',
      YELLOW: '\x1b[33m',
      RESET: '\x1b[0m'
    };
    
    const originalLines = originalContent.split('\n');
    const insertedLines = insertedText.split('\n');
    const targetLine = insertPosition.line_number;
    
    // コンテキスト行数（前後2行）
    const contextLines = 2;
    const startLine = Math.max(1, targetLine - contextLines);
    const endLine = Math.min(originalLines.length, targetLine + contextLines);
    
    let result = `${colors.CYAN}--- ${filePath}${colors.RESET}\n`;
    result += `${colors.CYAN}+++ ${filePath}${colors.RESET}\n`;
    
    // 位置情報ヘッダー
    const insertInfo = positionType === 'line_number' 
      ? `at line ${targetLine}`
      : referenceText 
        ? `${positionType} "${referenceText.substring(0, 30)}${referenceText.length > 30 ? '...' : ''}"`
        : `${positionType} operation`;
        
    result += `${colors.YELLOW}@@ Insert: +${insertedLines.length} lines ${insertInfo} @@${colors.RESET}\n`;
    
    // 挿入前のコンテキスト
    for (let i = startLine; i < targetLine; i++) {
      if (originalLines[i - 1] !== undefined) {
        result += ` ${originalLines[i - 1]}\n`;
      }
    }
    
    // 挿入されたコンテンツ（緑色）
    insertedLines.forEach(line => {
      result += `${colors.GREEN}+${line}${colors.RESET}\n`;
    });
    
    // 挿入後のコンテキスト
    for (let i = targetLine; i <= endLine; i++) {
      if (originalLines[i - 1] !== undefined) {
        result += ` ${originalLines[i - 1]}\n`;
      }
    }
    
    return result;
  }

  /**
   * 新規ファイル作成時のログ出力
   */
  public logNewFileCreation(filePath: string, content: string, operation: string): void {
    Logger.getInstance().info(
      `=== ${new Date().toISOString()} ===\n` +
      `File: ${filePath} (${operation} - New File)\n` +
      `[NEW FILE CREATED]\n` +
      `Content:\n${content}\n` +
      `========================`
    );
  }
}