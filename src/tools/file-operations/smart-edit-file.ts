/**
 * スマートファイル編集ツール（改良版）
 * 標準Editツールの改良版 - プレビュー、バックアップ、エラーハンドリング、新規ファイル作成対応
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { FileSystemService } from '../../services/FileSystemService.js';
import { DiffLogger } from '../../utils/diff-logger.js';
import { LogManager } from '../../utils/log-manager.js';
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
    absolute_position?: number;
  }>;
  preview_content?: string;
  is_new_file?: boolean;
  diff_output?: string;
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

    // パラメータの事前検証とサニタイズ
    if (typeof params.new_text === 'undefined') {
      Logger.getInstance().error('Critical parameter error in smart_edit_file', new Error('new_text parameter is undefined'), { 
        toolName: this.metadata.name,
        allParams: params,
        parameterTypes: Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, typeof value])
        ),
        stringifiedParams: JSON.stringify(params, null, 2),
        possibleCause: 'Claude Code parameter transmission issue'
      });
      
      return this.createErrorResult(
        '🚨 smart_edit_fileツールのパラメータエラーが発生しました\n\n' +
        '原因: new_text パラメータが未定義です\n' +
        '推定要因: Claude Code側でのパラメータ送信エラー\n' +
        '対処法: 以下の代替手段をお試しください\n' +
        '  1. 標準のEditツールを使用\n' +
        '  2. MultiEditツールで複数箇所を一度に編集\n' +
        '  3. テキストを短く分割して再実行\n\n' +
        `デバッグ情報:\n` +
        `- ファイルパス: ${params.file_path || 'undefined'}\n` +
        `- old_text長: ${typeof params.old_text === 'string' ? params.old_text.length : 'undefined'}文字\n` +
        `- new_text型: ${typeof params.new_text}\n` +
        `- 特殊文字含有: ${typeof params.old_text === 'string' && /[`"'\\]/.test(params.old_text) ? 'あり' : 'なし'}`
      );
    }

    // 追加の整合性チェック
    if (typeof params.old_text === 'undefined') {
      Logger.getInstance().error('old_text parameter is undefined in smart_edit_file', new Error('old_text parameter is undefined'), { params });
      return this.createErrorResult(
        'old_text パラメータが未定義です。Claude Code側でのパラメータ送信エラーの可能性があります。'
      );
    }

    if (typeof params.file_path === 'undefined' || params.file_path === '') {
      Logger.getInstance().error('file_path parameter is invalid in smart_edit_file', new Error('file_path parameter is invalid'), { params });
      return this.createErrorResult(
        'file_path パラメータが無効です。正しいファイルパスを指定してください。'
      );
    }

    // パフォーマンス向上のため、詳細ログを条件付きで出力
    if (process.env.MCP_DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      Logger.getInstance().debug('smart_edit_file execution started', {
        file_path: params.file_path,
        old_text_length: params.old_text.length,
        new_text_length: params.new_text.length,
        preview_mode: params.preview_mode
      });
    }

    try {
      // FileSystemServiceのインスタンスを取得
      const fsService = FileSystemService.getInstance();
      
      // 1. ファイル存在確認と新規作成対応
      let fileStats;
      let originalContent = '';
      let isNewFile = false;

      try {
        fileStats = await fsService.stat(params.file_path);
        
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
        // プレビュー用diff生成
        const { highQualityDiff } = await import('../../utils/high-quality-diff.js');
        const previewDiff = highQualityDiff.generateDiff(originalContent, editResult.newContent, params.file_path, {
          contextLines: 3,
          useColors: false
        });

        const result: EditResult = {
          success: true,
          file_path: params.file_path,
          preview_mode: true,
          changes_made: true,
          replacement_count: editResult.matches.length,
          file_size: fileStats?.size || 0,
          matches_found: editResult.matches,
          preview_content: editResult.newContent,
          is_new_file: isNewFile,
          diff_output: previewDiff
        };

        // プレビューdiff表示を含む結果出力
        let previewOutput = JSON.stringify(result, null, 2);
        if (previewDiff && previewDiff.trim()) {
          previewOutput += `\n\n${previewDiff}`;
        }
        
        return this.createTextResult(previewOutput);
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

      // 9. diff生成（コンソール出力用）
      const { highQualityDiff } = await import('../../utils/high-quality-diff.js');
      const diffOutput = highQualityDiff.generateDiff(originalContent, editResult.newContent, params.file_path, {
        contextLines: 3,
        useColors: false
      });

      // 10. 精密なdiffログ出力（実際の変更箇所のみ）
      const diffLogger = DiffLogger.getInstance();
      await diffLogger.logPreciseDiff(originalContent, editResult.newContent, params.file_path, 'Smart Edit');

      // 10.5. 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logFileOperation(
        'SMART_EDIT',
        params.file_path,
        `${editResult.matches.length} replacements made | Lines: ${editResult.newContent.split('\n').length}`
      );

      // 11. ファイル更新
      await fsService.writeFile(params.file_path, editResult.newContent, { encoding: 'utf-8' });

      // 12. 結果をまとめる
      const result: EditResult = {
        success: true,
        file_path: params.file_path,
        preview_mode: false,
        changes_made: true,
        replacement_count: editResult.matches.length,
        backup_path: backupPath,
        file_size: Buffer.byteLength(editResult.newContent, 'utf-8'),
        matches_found: editResult.matches,
        is_new_file: isNewFile,
        diff_output: diffOutput
      };

      // 成功時のログも条件付きで出力
      if (process.env.MCP_DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        Logger.getInstance().debug('Smart edit completed', {
          file_path: params.file_path,
          replacement_count: editResult.matches.length,
          is_new_file: isNewFile
        });
      }

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error: any) {
      // 詳細なエラー情報をログ記録
      Logger.getInstance().error('Failed to perform smart edit', error, {
        toolName: this.metadata.name,
        parameters: {
          file_path: params.file_path,
          old_text_length: typeof params.old_text === 'string' ? params.old_text.length : 'undefined',
          new_text_length: typeof params.new_text === 'string' ? params.new_text.length : 'undefined',
          preview_mode: params.preview_mode
        },
        errorType: error.constructor.name,
        possibleCause: this.analyzePossibleCause(error, params)
      });

      // ユーザー向けの詳細なエラーメッセージ
      const userErrorMessage = this.createDetailedErrorMessage(error, params);
      return this.createErrorResult(userErrorMessage);
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

        // コンテキスト境界の安全性チェック
        if (!this.validateContextBoundary(newContent, absoluteStart, absoluteEnd, oldText, newText)) {
          Logger.getInstance().warn('Context boundary validation failed, skipping replacement', {
            position: absoluteStart,
            line: match.line_number,
            oldText: oldText.substring(0, 50) + (oldText.length > 50 ? '...' : ''),
            surroundingContext: this.getSurroundingContext(newContent, absoluteStart, absoluteEnd)
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
   * 置換結果の整合性チェック（拡張版）
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

    // 最小限の構文チェックのみ
    const basicPatterns = [
      { name: 'export statements', pattern: /export\s+/g },
      { name: 'import statements', pattern: /import\s+/g }
    ];
    
    for (const { name, pattern } of basicPatterns) {
      const originalMatches = (original.match(pattern) || []).length;
      const resultMatches = (result.match(pattern) || []).length;
      
      // 大幅な減少のみチェック
      if (originalMatches > 0 && resultMatches === 0) {
        Logger.getInstance().warn(`All ${name} removed during replacement`, {
          original: originalMatches,
          result: resultMatches
        });
        return false;
      }
    }
    
    return true;
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

  /**
   * コンテキスト境界の安全性を検証（最小限）
   */
  private validateContextBoundary(
    content: string, 
    startPos: number, 
    endPos: number, 
    oldText: string, 
    newText: string
  ): boolean {
    // 基本的な範囲チェックのみ
    if (startPos < 0 || endPos > content.length || startPos >= endPos) {
      return false;
    }
    
    // 非常に大きな置換は注意
    if (oldText.length > 10000 || newText.length > 10000) {
      Logger.getInstance().warn('Large text replacement detected', {
        oldTextLength: oldText.length,
        newTextLength: newText.length
      });
    }
    
    return true;
  }

  /**
   * 周囲のコンテキストを取得（デバッグ用）
   */
  private getSurroundingContext(content: string, startPos: number, endPos: number): string {
    const contextStart = Math.max(0, startPos - 100);
    const contextEnd = Math.min(content.length, endPos + 100);
    const context = content.substring(contextStart, contextEnd);
    
    // 置換位置をマークして返す
    const relativeStart = startPos - contextStart;
    const relativeEnd = endPos - contextStart;
    
    return context.substring(0, relativeStart) + 
           '【REPLACE_START】' + 
           context.substring(relativeStart, relativeEnd) + 
           '【REPLACE_END】' + 
           context.substring(relativeEnd);
  }



  /**
   * エラーの可能性のある原因を分析
   */
  private analyzePossibleCause(error: any, params: SmartEditFileParams): string {
    const errorMessage = error.message || '';
    
    // ファイルシステムエラー
    if (error.code === 'ENOENT') return 'ファイルまたはディレクトリが見つからない';
    if (error.code === 'EACCES') return 'ファイルアクセス権限不足';
    if (error.code === 'EMFILE' || error.code === 'ENFILE') return 'システムファイル制限';
    
    // メモリ・サイズ関連
    if (errorMessage.includes('Maximum call stack') || errorMessage.includes('out of memory')) {
      return 'メモリ不足（大きなファイルまたは長いテキスト）';
    }
    
    // 文字エンコーディング
    if (errorMessage.includes('invalid character') || errorMessage.includes('encoding')) {
      return '文字エンコーディングの問題';
    }
    
    // パラメータサイズ
    const oldTextSize = typeof params.old_text === 'string' ? params.old_text.length : 0;
    const newTextSize = typeof params.new_text === 'string' ? params.new_text.length : 0;
    if (oldTextSize > 100000 || newTextSize > 100000) {
      return '大きなテキストサイズ（100KB以上）';
    }
    
    // 特殊文字
    const hasSpecialChars = typeof params.old_text === 'string' && typeof params.new_text === 'string' && 
      (/[`"'\\]/.test(params.old_text) || /[`"'\\]/.test(params.new_text));
    if (hasSpecialChars) {
      return '特殊文字（バッククォート、引用符、バックスラッシュ）の処理問題';
    }
    
    return '不明なエラー';
  }

  /**
   * ユーザー向けの詳細なエラーメッセージを作成
   */
  private createDetailedErrorMessage(error: any, params: SmartEditFileParams): string {
    const cause = this.analyzePossibleCause(error, params);
    const oldTextSize = typeof params.old_text === 'string' ? params.old_text.length : 0;
    const newTextSize = typeof params.new_text === 'string' ? params.new_text.length : 0;
    
    let message = `🚨 smart_edit_fileツールでエラーが発生しました\n\n`;
    message += `エラー内容: ${error.message}\n`;
    message += `推定原因: ${cause}\n\n`;
    
    message += `📊 パラメータ情報:\n`;
    message += `- ファイル: ${params.file_path}\n`;
    message += `- 置換前テキスト: ${oldTextSize}文字\n`;
    message += `- 置換後テキスト: ${newTextSize}文字\n`;
    message += `- プレビューモード: ${params.preview_mode ? 'はい' : 'いいえ'}\n\n`;
    
    message += `🔧 推奨対処法:\n`;
    
    if (cause.includes('大きな')) {
      message += `1. テキストを小さく分割して複数回に分けて実行\n`;
      message += `2. 標準のEditツールまたはMultiEditツールを使用\n`;
    } else if (cause.includes('特殊文字')) {
      message += `1. 特殊文字をエスケープまたは回避\n`;
      message += `2. 標準のEditツールでより単純な置換を実行\n`;
    } else if (cause.includes('メモリ')) {
      message += `1. ファイルサイズを確認し、必要に応じて分割処理\n`;
      message += `2. 他のアプリケーションを終了してメモリを確保\n`;
    } else {
      message += `1. 標準のEditツールを試してください\n`;
      message += `2. ファイルパスと内容を確認してください\n`;
    }
    
    message += `3. 問題が続く場合は、このエラー情報をGitHubのIssueで報告してください\n`;
    
    return message;
  }
}