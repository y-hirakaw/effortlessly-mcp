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
        description: '新規ファイル作成を許可（デフォルト: false）',
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
          if (!params.create_new_file) {
            return this.createErrorResult(`ファイルが見つかりません: ${params.file_path}. 新規作成を行う場合は create_new_file=true を指定してください。`);
          }
          
          // 新規ファイル作成の場合
          isNewFile = true;
          originalContent = '';
          
          // ディレクトリの存在確認と作成
          const dir = path.dirname(params.file_path);
          await fs.mkdir(dir, { recursive: true });
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

      // 7. バックアップ作成（既存ファイルのみ）
      let backupPath: string | undefined;
      if (params.create_backup && !isNewFile) {
        backupPath = await this.createBackup(params.file_path, originalContent);
      }

      // 8. ファイル更新
      await fs.writeFile(params.file_path, editResult.newContent, 'utf-8');

      // 9. 結果をまとめる
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
    }>;
  } {
    const matches: any[] = [];
    let newContent = content;

    // 検索用の文字列を準備
    const searchText = caseSensitive ? oldText : oldText.toLowerCase();
    const searchContent = caseSensitive ? content : content.toLowerCase();

    // マッチ箇所を特定
    let searchIndex = 0;

    while (true) {
      const matchIndex = searchContent.indexOf(searchText, searchIndex);
      if (matchIndex === -1) break;

      // 行番号を計算
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
        match_end: matchIndex - lineStartIndex + oldText.length
      });

      searchIndex = matchIndex + oldText.length;

      // replace_allがfalseの場合は最初の1件のみ
      if (!replaceAll) break;
    }

    // 実際の置換実行（後ろから置換してインデックスずれを防ぐ）
    if (matches.length > 0) {
      // マッチを後ろから処理
      const sortedMatches = [...matches].reverse();
      newContent = content;

      for (const match of sortedMatches) {
        const startIndex = content.lastIndexOf(match.line_content);
        const matchStart = startIndex + match.match_start;
        const matchEnd = matchStart + oldText.length;
        
        newContent = newContent.substring(0, matchStart) + 
                    newText + 
                    newContent.substring(matchEnd);
      }
    }

    return { newContent, matches };
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