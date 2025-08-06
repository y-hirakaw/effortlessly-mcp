/**
 * スマートファイル編集ツール（改良版）
 * 標準Editツールの改良版 - プレビュー、バックアップ、エラーハンドリング、新規ファイル作成対応
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { promises as fs } from 'fs';
import * as path from 'path';

const SmartEditFileSchema = z.object({
  file_path: z.string().describe('編集対象ファイルパス'),
  old_text: z.string().describe('置換対象の文字列（新規ファイル作成時は空文字列可）'),
  new_text: z.string().describe('置換後の文字列'),
  preview_mode: z.boolean().optional().default(false).describe('プレビューモード（実際の変更は行わない）'),
  create_backup: z.boolean().optional().default(true).describe('バックアップファイルを作成'),
  case_sensitive: z.boolean().optional().default(true).describe('大文字小文字を区別'),
  replace_all: z.boolean().optional().default(false).describe('すべての出現箇所を置換（falseの場合は最初の1箇所のみ）'),
  max_file_size: z.number().optional().default(1024 * 1024).describe('最大ファイルサイズ（バイト）'),
  create_new_file: z.boolean().optional().default(false).describe('新規ファイル作成を許可')
});

type SmartEditFileParams = z.infer<typeof SmartEditFileSchema>;

interface EditResult {
  success: boolean;
  file_path: string;
  preview_mode: boolean;
  changes_made: boolean;
  replacement_count: number;
  backup_path?: string;
  file_size: number;
  matches_found: Array<{
    line_number: number;
    line_content: string;
    match_start: number;
    match_end: number;
  }>;
  preview_content?: string;
  is_new_file?: boolean;
}

/**
 * スマートファイル編集ツール
 */
export class SmartEditFileTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'smart_edit_file',
    description: '標準的なファイル編集を安全に実行（プレビュー、バックアップ、エラーハンドリング、新規ファイル作成対応）',
    parameters: {
      file_path: {
        type: 'string',
        description: '編集対象ファイルパス',
        required: true
      },
      old_text: {
        type: 'string',
        description: '置換対象の文字列（新規ファイル作成時は空文字列可）',
        required: true
      },
      new_text: {
        type: 'string',
        description: '置換後の文字列',
        required: true
      },
      preview_mode: {
        type: 'boolean',
        description: 'プレビューモード（実際の変更は行わない）',
        required: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        required: false
      },
      case_sensitive: {
        type: 'boolean',
        description: '大文字小文字を区別（デフォルト: true）',
        required: false
      },
      replace_all: {
        type: 'boolean',
        description: 'すべての出現箇所を置換（デフォルト: false）',
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

  protected readonly schema = SmartEditFileSchema;

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as SmartEditFileParams;

    try {
      // 1. ファイル存在確認と新規作成対応
      let fileStats;
      let originalContent = '';
      let isNewFile = false;

      try {
        fileStats = await fs.stat(params.file_path);
        
        // 2. ファイルサイズチェック
        if (fileStats.size > params.max_file_size) {
          return this.createErrorResult(
            `ファイルサイズが制限を超えています: ${fileStats.size} > ${params.max_file_size} bytes`
          );
        }

        // 3. ディレクトリではないことを確認
        if (fileStats.isDirectory()) {
          return this.createErrorResult(`指定されたパスはディレクトリです: ${params.file_path}`);
        }

        // 4. ファイル内容読み取り
        originalContent = await fs.readFile(params.file_path, 'utf-8');
      } catch (error: any) {
        // ファイルが存在しない場合
        if (error.code === 'ENOENT') {
          // 親ディレクトリが存在するかチェック
          const dir = path.dirname(params.file_path);
          try {
            await fs.access(dir);
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
              await fs.mkdir(dir, { recursive: true });
              Logger.getInstance().info(`Creating new file with directories: ${params.file_path}`);
            } else {
              return this.createErrorResult(
                `ファイルまたは親ディレクトリが存在しません: ${params.file_path}. ` +
                `ディレクトリも作成する場合は create_new_file=true を指定してください。`
              );
            }
          }
        } else {
          return this.createErrorResult(`ファイルアクセスエラー: ${error.message}`);
        }
      }

      // 5. 検索・置換実行（新規ファイルの場合は特別処理）
      let editResult;
      
      if (isNewFile) {
        // 新規ファイルの場合: old_textが空文字列の場合は直接new_textを内容とする
        if (params.old_text === '') {
          editResult = {
            newContent: params.new_text,
            matches: [{
              line_number: 1,
              line_content: 'New file',
              match_start: 0,
              match_end: 0
            }]
          };
        } else {
          // new_fileでもold_textが指定されている場合は通常の置換処理
          editResult = this.performEdit(
            originalContent,
            params.old_text,
            params.new_text,
            params.case_sensitive,
            params.replace_all
          );
        }
      } else {
        // 既存ファイルの場合: 通常の置換処理
        editResult = this.performEdit(
          originalContent,
          params.old_text,
          params.new_text,
          params.case_sensitive,
          params.replace_all
        );
        
        if (editResult.matches.length === 0) {
          return this.createTextResult(JSON.stringify({
            success: true,
            file_path: params.file_path,
            preview_mode: params.preview_mode,
            changes_made: false,
            replacement_count: 0,
            file_size: fileStats?.size || 0,
            matches_found: [],
            message: '置換対象の文字列が見つかりませんでした'
          }, null, 2));
        }
      }

      // 6. プレビューモードの場合
      if (params.preview_mode) {
        const result: EditResult = {
          success: true,
          file_path: params.file_path,
          preview_mode: true,
          changes_made: true,
          replacement_count: editResult.matches.length,
          file_size: fileStats?.size || 0,
          matches_found: editResult.matches,
          preview_content: editResult.newContent,
          is_new_file: isNewFile
        };

        return this.createTextResult(JSON.stringify(result, null, 2));
      }

      // 7. 置換結果の整合性チェック（既存ファイルのみ）
      if (!isNewFile && !this.validateReplacement(originalContent, editResult.newContent, editResult.matches.length)) {
        return this.createErrorResult(
          `置換処理でファイルの整合性が損なわれる可能性があります。操作を中止しました。` +
          `バックアップから復旧してください。`
        );
      }

      // 8. バックアップ作成（既存ファイルのみ）
      let backupPath: string | undefined;
      if (params.create_backup && !isNewFile) {
        backupPath = await this.createBackup(params.file_path, originalContent);
      }

      // 10. ファイル更新
      await fs.writeFile(params.file_path, editResult.newContent, 'utf-8');

      // 11. 結果をまとめる
      const result: EditResult = {
        success: true,
        file_path: params.file_path,
        preview_mode: false,
        changes_made: true,
        replacement_count: editResult.matches.length,
        backup_path: backupPath,
        file_size: Buffer.byteLength(editResult.newContent, 'utf-8'),
        matches_found: editResult.matches,
        is_new_file: isNewFile
      };

      Logger.getInstance().info('Smart edit completed', {
        file_path: params.file_path,
        replacement_count: editResult.matches.length,
        backup_created: !!backupPath,
        is_new_file: isNewFile
      });

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error: any) {
      Logger.getInstance().error('Failed to perform smart edit', error.message);
      return this.createErrorResult(`ファイル編集エラー: ${error.message}`);
    }
  }

  private performEdit(
    content: string,
    oldText: string,
    newText: string,
    caseSensitive: boolean,
    replaceAll: boolean
  ): {
    newContent: string;
    matches: Array<{
      line_number: number;
      line_content: string;
      match_start: number;
      match_end: number;
      absolute_position?: number;
    }>;
  } {
    const matches: any[] = [];

    // 検索用の文字列を準備
    const searchText = caseSensitive ? oldText : oldText.toLowerCase();
    const searchContent = caseSensitive ? content : content.toLowerCase();

    // 全てのマッチ箇所を特定（絶対位置ベース）
    let searchIndex = 0;

    while (true) {
      const matchIndex = searchContent.indexOf(searchText, searchIndex);
      if (matchIndex === -1) break;

      // 行番号と行内位置を計算
      const beforeMatch = content.substring(0, matchIndex);
      const lineNumber = beforeMatch.split('\n').length;
      const lineStartIndex = beforeMatch.lastIndexOf('\n') + 1;
      const lineEndIndex = content.indexOf('\n', matchIndex);
      const lineContent = content.substring(
        lineStartIndex, 
        lineEndIndex === -1 ? content.length : lineEndIndex
      );

      matches.push({
        line_number: lineNumber,
        line_content: lineContent,
        match_start: matchIndex - lineStartIndex,
        match_end: matchIndex - lineStartIndex + oldText.length,
        absolute_position: matchIndex
      });

      searchIndex = matchIndex + oldText.length;

      // replace_allがfalseの場合は最初の1件のみ
      if (!replaceAll) break;
    }

    // 実際の置換実行（直接的な絶対位置ベース置換）
    let newContent = content;
    
    if (matches.length > 0) {
      // マッチを後ろから処理してインデックスずれを防ぐ
      const sortedMatches = [...matches].sort((a, b) => b.absolute_position! - a.absolute_position!);

      for (const match of sortedMatches) {
        const absoluteStart = match.absolute_position!;
        const absoluteEnd = absoluteStart + oldText.length;
        
        // 置換前に対象テキストを再検証（安全性確保）
        const targetText = newContent.substring(absoluteStart, absoluteEnd);
        const expectedText = caseSensitive ? oldText : oldText.toLowerCase();
        const actualText = caseSensitive ? targetText : targetText.toLowerCase();
        
        if (actualText !== expectedText) {
          // 置換対象が一致しない場合はスキップ（詳細ログ出力）
          Logger.getInstance().warn('Replacement target mismatch, skipping', {
            expected: oldText,
            actual: targetText,
            position: absoluteStart,
            line: match.line_number
          });
          continue;
        }
        
        // 安全な置換実行
        newContent = newContent.substring(0, absoluteStart) + 
                    newText + 
                    newContent.substring(absoluteEnd);
      }
    }

    return { newContent, matches };
  }


  /**
   * 置換結果の整合性チェック
   */
  private validateReplacement(original: string, result: string, expectedChanges: number): boolean {
    // 基本的な整合性チェック
    if (result.length === 0 && original.length > 0 && expectedChanges > 0) {
      return false; // 内容が完全に消失
    }
    
    // 構文的な整合性チェック（TypeScript/JavaScript の場合）
    if (original.includes('export class') && !result.includes('export class')) {
      return false; // クラス定義の破損
    }
    
    if (original.includes('import ') && result.includes('import ') === false && original.includes('import ')) {
      // インポート文の不整合チェック（完全消失の場合のみエラー）
      const originalImports = (original.match(/import /g) || []).length;
      const resultImports = (result.match(/import /g) || []).length;
      if (originalImports > 0 && resultImports === 0) {
        return false;
      }
    }
    
    return true;
  }

  private async createBackup(filePath: string, content: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = '.claude/workspace/effortlessly/backups';
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
    
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return backupPath;
  }
}