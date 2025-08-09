/**
 * 正規表現コード置換ツール
 * 正規表現パターンによる柔軟なコード置換
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import { promises as fs } from 'fs';

const CodeReplaceWithRegexSchema = z.object({
  file_path: z.string().describe('対象ファイルパス'),
  pattern: z.string().describe('検索用正規表現パターン'),
  replacement: z.string().describe('置換文字列（バックリファレンス $1, $2 等使用可能）'),
  flags: z.string().optional().default('g').describe('正規表現フラグ (g: global, i: ignoreCase, m: multiline, s: dotAll)'),
  max_replacements: z.number().optional().describe('最大置換回数（安全性のため）'),
  preview_mode: z.boolean().optional().default(false).describe('プレビューモード（実際の置換は行わない）'),
  create_backup: z.boolean().optional().default(true).describe('変更前のバックアップを作成'),
  validate_syntax: z.boolean().optional().default(true).describe('置換後の構文検証を実行')
});

type CodeReplaceWithRegexParams = z.infer<typeof CodeReplaceWithRegexSchema>;

interface RegexReplaceResult {
  success: boolean;
  file_path: string;
  preview_mode: boolean;
  pattern_matched: boolean;
  replacement_count: number;
  matches_found: Array<{
    line_number: number;
    original_text: string;
    replaced_text: string;
    match_start: number;
    match_end: number;
  }>;
  backup_path?: string;
  syntax_valid: boolean;
  validation_errors?: string[];
  total_lines_affected: number;
}

/**
 * 正規表現コード置換ツール
 */
export class CodeReplaceWithRegexTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'code_replace_with_regex',
    description: '正規表現パターンを使用した柔軟なコード置換を実行します',
    parameters: {
      file_path: {
        type: 'string',
        description: '対象ファイルパス',
        required: true
      },
      pattern: {
        type: 'string',
        description: '検索用正規表現パターン',
        required: true
      },
      replacement: {
        type: 'string',
        description: '置換文字列（バックリファレンス $1, $2 等使用可能）',
        required: true
      },
      flags: {
        type: 'string',
        description: '正規表現フラグ (g, i, m, s等)',
        required: false
      },
      max_replacements: {
        type: 'number',
        description: '最大置換回数（安全性のため）',
        required: false
      },
      preview_mode: {
        type: 'boolean',
        description: 'プレビューモード（実際の置換は行わない）',
        required: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        required: false
      },
      validate_syntax: {
        type: 'boolean',
        description: '置換後の構文検証を実行（デフォルト: true）',
        required: false
      }
    }
  };

  protected readonly schema = CodeReplaceWithRegexSchema;

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as CodeReplaceWithRegexParams;

    try {
      // 1. ファイル存在確認
      try {
        await fs.access(params.file_path);
      } catch {
        return this.createErrorResult(`ファイルが見つかりません: ${params.file_path}`);
      }

      // 2. 正規表現パターンの検証
      const regexValidation = this.validateRegexPattern(params.pattern, params.flags);
      if (!regexValidation.valid) {
        return this.createErrorResult(`正規表現エラー: ${regexValidation.error}`);
      }

      // 3. ファイル内容読み取り
      const originalContent = await fs.readFile(params.file_path, 'utf-8');

      // 4. パターンマッチング実行
      const matchResult = this.performRegexMatching(
        originalContent,
        params.pattern,
        params.replacement,
        params.flags || 'g',
        params.max_replacements
      );

      if (!matchResult.matches.length) {
        return this.createTextResult(JSON.stringify({
          success: true,
          file_path: params.file_path,
          preview_mode: params.preview_mode,
          pattern_matched: false,
          replacement_count: 0,
          matches_found: [],
          message: 'パターンにマッチするテキストが見つかりませんでした'
        }, null, 2));
      }

      // 5. プレビューモードの場合はここで終了
      if (params.preview_mode) {
        const result: RegexReplaceResult = {
          success: true,
          file_path: params.file_path,
          preview_mode: true,
          pattern_matched: true,
          replacement_count: matchResult.matches.length,
          matches_found: matchResult.matches,
          syntax_valid: true, // プレビューモードでは構文検証スキップ
          total_lines_affected: this.countAffectedLines(matchResult.matches)
        };

        return this.createTextResult(JSON.stringify(result, null, 2));
      }

      // 6. バックアップ作成
      let backupPath: string | undefined;
      if (params.create_backup) {
        backupPath = await this.createBackup(params.file_path, originalContent);
      }

      // 7. 実際の置換実行
      const replacedContent = matchResult.replacedContent;

      // 8. 構文検証（オプション）
      const syntaxValidation = params.validate_syntax 
        ? await this.validateSyntax(params.file_path, replacedContent)
        : { valid: true, errors: [] };

      // 9. ファイル更新
      await fs.writeFile(params.file_path, replacedContent, 'utf-8');

      // 10. 結果をまとめる
      const result: RegexReplaceResult = {
        success: true,
        file_path: params.file_path,
        preview_mode: false,
        pattern_matched: true,
        replacement_count: matchResult.matches.length,
        matches_found: matchResult.matches,
        backup_path: backupPath,
        syntax_valid: syntaxValidation.valid,
        validation_errors: syntaxValidation.errors,
        total_lines_affected: this.countAffectedLines(matchResult.matches)
      };

      Logger.getInstance().info('Regex replacement completed', {
        file_path: params.file_path,
        pattern: params.pattern,
        replacement_count: matchResult.matches.length,
        syntax_valid: syntaxValidation.valid
      });

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logFileOperation(
        'REPLACE_WITH_REGEX',
        params.file_path,
        `Applied regex pattern "${params.pattern}" → ${matchResult.matches.length} replacements`
      );

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error: any) {
      Logger.getInstance().error('Failed to perform regex replacement', error.message);
      return this.createErrorResult(`正規表現置換エラー: ${error.message}`);
    }
  }

  private validateRegexPattern(pattern: string, flags?: string): { valid: boolean; error?: string } {
    try {
      new RegExp(pattern, flags);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  private performRegexMatching(
    content: string,
    pattern: string,
    replacement: string,
    flags: string,
    maxReplacements?: number
  ): {
    matches: Array<{
      line_number: number;
      original_text: string;
      replaced_text: string;
      match_start: number;
      match_end: number;
    }>;
    replacedContent: string;
  } {
    const regex = new RegExp(pattern, flags);
    const lines = content.split('\n');
    const matches: any[] = [];
    let replacedContent = content;
    let replacementCount = 0;

    // 行ごとに処理
    lines.forEach((line, lineIndex) => {
      let match;
      let lineOffset = 0;
      
      // 同一行での複数マッチに対応
      while ((match = regex.exec(line)) !== null) {
        if (maxReplacements && replacementCount >= maxReplacements) {
          break;
        }

        const originalText = match[0];
        const replacedText = originalText.replace(regex, replacement);

        matches.push({
          line_number: lineIndex + 1,
          original_text: originalText,
          replaced_text: replacedText,
          match_start: match.index + lineOffset,
          match_end: match.index + originalText.length + lineOffset
        });

        lineOffset += replacedText.length - originalText.length;
        replacementCount++;

        // globalフラグがない場合は一度で終了
        if (!flags.includes('g')) {
          break;
        }
      }
    });

    // 実際の置換実行
    if (maxReplacements) {
      let count = 0;
      replacedContent = content.replace(new RegExp(pattern, flags), (match, ..._args) => {
        if (count >= maxReplacements) {
          return match; // 置換せずにそのまま返す
        }
        count++;
        return replacement;
      });
    } else {
      replacedContent = content.replace(new RegExp(pattern, flags), replacement);
    }

    return { matches, replacedContent };
  }

  private countAffectedLines(matches: Array<{ line_number: number }>): number {
    const uniqueLines = new Set(matches.map(m => m.line_number));
    return uniqueLines.size;
  }

  private async validateSyntax(filePath: string, content: string): Promise<{ valid: boolean; errors: string[] }> {
    // ファイル拡張子に基づく基本的な構文検証
    const extension = filePath.split('.').pop()?.toLowerCase();
    const errors: string[] = [];

    try {
      switch (extension) {
        case 'json':
          JSON.parse(content);
          break;
        
        case 'js':
        case 'ts':
          // 基本的な括弧チェック
          if (!this.validateBrackets(content)) {
            errors.push('括弧の対応が不正です');
          }
          break;
        
        case 'py':
          // Pythonのインデント基本チェック
          if (!this.validatePythonIndentation(content)) {
            errors.push('インデントエラーの可能性があります');
          }
          break;
        
        default:
          // 汎用的な括弧チェック
          if (!this.validateBrackets(content)) {
            errors.push('括弧の対応が不正である可能性があります');
          }
      }
    } catch (error: any) {
      errors.push(`構文エラー: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateBrackets(content: string): boolean {
    const stack: string[] = [];
    const pairs: { [key: string]: string } = { '(': ')', '[': ']', '{': '}' };
    
    for (const char of content) {
      if (char in pairs) {
        stack.push(char);
      } else if (Object.values(pairs).includes(char)) {
        const last = stack.pop();
        if (!last || pairs[last] !== char) {
          return false;
        }
      }
    }
    
    return stack.length === 0;
  }

  private validatePythonIndentation(content: string): boolean {
    const lines = content.split('\n');
    let indentStack: number[] = [0];
    
    for (const line of lines) {
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue; // 空行やコメント行はスキップ
      }
      
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const lastIndent = indentStack[indentStack.length - 1];
      
      if (line.trim().endsWith(':')) {
        // コロンで終わる行（関数、クラス、制御構造）
        indentStack.push(indent);
      } else if (indent < lastIndent) {
        // インデントが減った場合
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
          indentStack.pop();
        }
        if (indentStack[indentStack.length - 1] !== indent) {
          return false; // インデントレベルが不正
        }
      }
    }
    
    return true;
  }

  private async createBackup(filePath: string, content: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = '.claude/workspace/effortlessly/backups';
    const fileName = filePath.split('/').pop() || 'unknown';
    const backupPath = `${backupDir}/${fileName}.${timestamp}.backup`;
    
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return backupPath;
  }
}