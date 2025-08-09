/**
 * スマートテキスト挿入ツール（改良版）
 * 行番号指定、相対位置、インデント自動調整、新規ファイル作成機能付き
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import { FileSystemService } from '../../services/FileSystemService.js';
import * as path from 'path';
import { DiffLogger } from '../../utils/diff-logger.js';

const SmartInsertTextSchema = z.object({
  file_path: z.string().describe('編集対象ファイルパス'),
  text: z.string().describe('挿入するテキスト'),
  position_type: z.enum(['line_number', 'after_text', 'before_text', 'start', 'end']).describe('挿入位置の指定方法'),
  line_number: z.number().optional().describe('行番号（1から開始、position_type="line_number"の場合）'),
  reference_text: z.string().optional().describe('参照テキスト（after_text/before_textの場合）'),
  auto_indent: z.boolean().optional().default(true).describe('自動インデント調整'),
  preserve_empty_lines: z.boolean().optional().default(true).describe('空行を保持'),
  preview_mode: z.boolean().optional().default(false).describe('プレビューモード（実際の挿入は行わない）'),
  create_backup: z.boolean().optional().default(true).describe('バックアップファイルを作成'),
  max_file_size: z.number().optional().default(1024 * 1024).describe('最大ファイルサイズ（バイト）'),
  create_new_file: z.boolean().optional().default(false).describe('新規ファイル作成を許可')
});

type SmartInsertTextParams = z.infer<typeof SmartInsertTextSchema>;

interface InsertResult {
  success: boolean;
  file_path: string;
  preview_mode: boolean;
  text_inserted: boolean;
  insert_position: {
    line_number: number;
    column: number;
  };
  backup_path?: string;
  original_line_count: number;
  new_line_count: number;
  preview_content?: string;
  is_new_file?: boolean;
}

/**
 * スマートテキスト挿入ツール
 */
export class SmartInsertTextTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'smart_insert_text',
    description: '柔軟な位置指定によるテキスト挿入（行番号、相対位置、自動インデント、新規ファイル作成対応）',
    parameters: {
      file_path: {
        type: 'string',
        description: '編集対象ファイルパス',
        required: true
      },
      text: {
        type: 'string',
        description: '挿入するテキスト',
        required: true
      },
      position_type: {
        type: 'string',
        description: '挿入位置の指定方法（line_number, after_text, before_text, start, end）',
        required: true
      },
      line_number: {
        type: 'number',
        description: '行番号（1から開始、position_type="line_number"の場合）',
        required: false
      },
      reference_text: {
        type: 'string',
        description: '参照テキスト（after_text/before_textの場合）',
        required: false
      },
      auto_indent: {
        type: 'boolean',
        description: '自動インデント調整（デフォルト: true）',
        required: false
      },
      preserve_empty_lines: {
        type: 'boolean',
        description: '空行を保持（デフォルト: true）',
        required: false
      },
      preview_mode: {
        type: 'boolean',
        description: 'プレビューモード（実際の挿入は行わない）',
        required: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        required: false
      },
      max_file_size: {
        type: 'number',
        description: '最大ファイルサイズ（バイト、デフォルト: 1MB）',
        required: false
      },
      create_new_file: {
        type: 'boolean',
        description: '新規ディレクトリも含めて作成を許可（デフォルト: false）。ファイルのみの場合は自動作成されます',
        required: false
      }
    }
  };

  protected readonly schema = SmartInsertTextSchema;

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as SmartInsertTextParams;

    try {
      // 1. パラメータ検証
      const validationError = this.validateSmartInsertParameters(params);
      if (validationError) {
        const errorResult = {
          success: false,
          error: validationError,
          file_path: params.file_path
        };
        return this.createTextResult(JSON.stringify(errorResult, null, 2));
      }

      // FileSystemServiceのインスタンスを取得
      const fsService = FileSystemService.getInstance();
      
      // 2. ファイル存在確認と新規作成対応
      let fileStats;
      let originalContent = '';
      let isNewFile = false;

      try {
        fileStats = await fsService.stat(params.file_path);
        
        // 3. ファイルサイズチェック
        if (fileStats.size > params.max_file_size) {
          const errorResult = {
            success: false,
            error: `ファイルサイズが制限を超えています: ${fileStats.size} > ${params.max_file_size} bytes`,
            file_path: params.file_path
          };
          return this.createTextResult(JSON.stringify(errorResult, null, 2));
        }

        // 4. ディレクトリではないことを確認
        if (fileStats.isDirectory()) {
          const errorResult = {
            success: false,
            error: `指定されたパスはディレクトリです: ${params.file_path}`,
            file_path: params.file_path
          };
          return this.createTextResult(JSON.stringify(errorResult, null, 2));
        }

        // 5. ファイル内容読み取り
        originalContent = await fsService.readFile(params.file_path, { encoding: 'utf-8' }) as string;
      } catch (error: any) {
        // ファイルが存在しない場合
        if (error.code === 'ENOENT') {
          // 親ディレクトリが存在するかチェック
          const dir = path.dirname(params.file_path);
          try {
            await fsService.access(dir);
            // 親ディレクトリが存在すれば自動的に新規ファイル作成
            isNewFile = true;
            originalContent = '';
            Logger.getInstance().info(`File not found, creating new file automatically: ${params.file_path}`);
          } catch {
            // 親ディレクトリが存在しない場合
            if (params.create_new_file) {
              // create_new_fileフラグがtrueの場合のみディレクトリも作成
              isNewFile = true;
              originalContent = '';
              await fsService.mkdir(dir, { recursive: true });
              Logger.getInstance().info(`Creating new file with directories: ${params.file_path}`);
            } else {
              const errorResult = {
                success: false,
                error: `ファイルまたは親ディレクトリが存在しません: ${params.file_path}. ` +
                      `ディレクトリも作成する場合は create_new_file=true を指定してください。`,
                file_path: params.file_path
              };
              return this.createTextResult(JSON.stringify(errorResult, null, 2));
            }
          }
        } else {
          const errorResult = {
            success: false,
            error: `ファイルアクセスエラー: ${error.message}`,
            file_path: params.file_path
          };
          return this.createTextResult(JSON.stringify(errorResult, null, 2));
        }
      }

      const lines = originalContent.split('\n');

      // 6. 挿入位置の計算
      const insertPosition = this.calculateInsertPosition(lines, params);
      if (!insertPosition.success) {
        const errorResult = {
          success: false,
          error: insertPosition.error!,
          file_path: params.file_path
        };
        return this.createTextResult(JSON.stringify(errorResult, null, 2));
      }

      // 7. テキスト挿入の実行
      const insertResult = this.performInsert(
        lines,
        params.text,
        insertPosition.lineIndex!,
        insertPosition.column!,
        params.auto_indent
      );

      const newContent = insertResult.lines.join('\n');

      // 8. プレビューモードの場合
      if (params.preview_mode) {
        const result: InsertResult = {
          success: true,
          file_path: params.file_path,
          preview_mode: true,
          text_inserted: false,  // プレビューモードでは実際にはテキストが挿入されない
          insert_position: {
            line_number: insertPosition.lineIndex! + 1,
            column: insertPosition.column!
          },
          original_line_count: lines.length,
          new_line_count: insertResult.lines.length,
          preview_content: newContent,
          is_new_file: isNewFile
        };

        return this.createTextResult(JSON.stringify(result, null, 2));
      }

      // 9. バックアップ作成（既存ファイルのみ）
      let backupPath: string | undefined;
      if (params.create_backup && !isNewFile) {
        backupPath = await this.createBackup(params.file_path, originalContent);
      }

      // 10. ファイル更新とdiff出力
      await fsService.writeFile(params.file_path, newContent, { encoding: 'utf-8' });
      
      // 挿入操作のdiff表示
      const diffLogger = DiffLogger.getInstance();
      if (!isNewFile) {
        // Insert特化のdiffログを使用
        await diffLogger.logInsertDiff(
          originalContent,
          params.text,
          {
            line_number: insertPosition.lineIndex! + 1,
            column: insertPosition.column!
          },
          params.file_path,
          params.position_type,
          params.reference_text
        );
      } else {
        diffLogger.logNewFileCreation(params.file_path, newContent, 'Smart Insert');
      }

      // 11. 結果をまとめる
      const result: InsertResult = {
        success: true,
        file_path: params.file_path,
        preview_mode: false,
        text_inserted: true,
        insert_position: {
          line_number: insertPosition.lineIndex! + 1,
          column: insertPosition.column!
        },
        backup_path: backupPath,
        original_line_count: lines.length,
        new_line_count: insertResult.lines.length,
        is_new_file: isNewFile
      };

      Logger.getInstance().info('Smart insert completed', {
        file_path: params.file_path,
        position_type: params.position_type,
        insert_position: result.insert_position,
        backup_created: !!backupPath,
        is_new_file: isNewFile
      });

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logFileOperation(
        'SMART_INSERT_TEXT',
        params.file_path,
        `Inserted text at ${params.position_type} position (${lines.length} → ${insertResult.lines.length} lines)${isNewFile ? ' [NEW FILE]' : ''}`
      );

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error: any) {
      Logger.getInstance().error('Failed to perform smart insert', error.message);
      const errorResult = {
        success: false,
        error: `テキスト挿入エラー: ${error.message}`,
        file_path: params.file_path || 'unknown'
      };
      return this.createTextResult(JSON.stringify(errorResult, null, 2));
    }
  }

  private validateSmartInsertParameters(params: SmartInsertTextParams): string | null {
    switch (params.position_type) {
      case 'line_number':
        if (params.line_number === undefined) {
          return 'position_type="line_number"の場合、line_numberパラメータが必要です';
        }
        if (params.line_number < 1) {
          return 'line_numberは1以上である必要があります';
        }
        break;
      
      case 'after_text':
      case 'before_text':
        if (!params.reference_text) {
          return `position_type="${params.position_type}"の場合、reference_textパラメータが必要です`;
        }
        break;
      
      case 'start':
      case 'end':
        // 特別な検証は不要
        break;
      
      default:
        return `未知のposition_type: ${params.position_type}`;
    }

    return null;
  }

  private calculateInsertPosition(
    lines: string[],
    params: SmartInsertTextParams
  ): { success: boolean; lineIndex?: number; column?: number; error?: string } {
    switch (params.position_type) {
      case 'line_number': {
        const lineIndex = params.line_number! - 1;
        if (lineIndex > lines.length) {
          return { success: false, error: `Line number ${params.line_number} is beyond file length` };
        }
        return { success: true, lineIndex, column: 0 };
      }

      case 'start':
        return { success: true, lineIndex: 0, column: 0 };

      case 'end':
        return { success: true, lineIndex: lines.length, column: 0 };

      case 'after_text':
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(params.reference_text!)) {
            return { success: true, lineIndex: i + 1, column: 0 };
          }
        }
        return { success: false, error: `Reference text not found` };

      case 'before_text':
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(params.reference_text!)) {
            return { success: true, lineIndex: i, column: 0 };
          }
        }
        return { success: false, error: `Reference text not found` };

      default:
        return { success: false, error: `未知のposition_type: ${params.position_type}` };
    }
  }

  private performInsert(
    lines: string[],
    text: string,
    lineIndex: number,
    _column: number,
    autoIndent: boolean
  ): { lines: string[] } {
    const insertLines = text.split('\n');
    const newLines = [...lines];

    // 自動インデント処理
    if (autoIndent && lineIndex > 0 && lineIndex < lines.length) {
      const referenceIndent = this.detectIndent(lines[lineIndex - 1] || '');
      for (let i = 0; i < insertLines.length; i++) {
        if (insertLines[i].trim() !== '') {
          const currentIndent = this.detectIndent(insertLines[i]);
          // 挿入テキストが既にインデントを持っている場合は追加しない
          if (currentIndent.length === 0) {
            insertLines[i] = referenceIndent + insertLines[i];
          }
        }
      }
    }

    // テキストの挿入
    if (lineIndex >= newLines.length) {
      // ファイル末尾への追加
      newLines.push(...insertLines);
    } else {
      // 指定位置への挿入
      newLines.splice(lineIndex, 0, ...insertLines);
    }

    return { lines: newLines };
  }

  private detectIndent(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  private async createBackup(filePath: string, content: string): Promise<string> {
    const fsService = FileSystemService.getInstance();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = '.claude/workspace/effortlessly/backups';
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
    
    await fsService.mkdir(backupDir, { recursive: true });
    await fsService.writeFile(backupPath, content, { encoding: 'utf-8' });
    
    return backupPath;
  }


}