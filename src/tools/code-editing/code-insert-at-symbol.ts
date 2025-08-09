/**
 * シンボル位置コード挿入ツール
 * 指定シンボルの前後への精密なコード挿入
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
// import { LSPService } from '../../services/lsp/lsp-service.js';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import { promises as fs } from 'fs';

const CodeInsertAtSymbolSchema = z.object({
  target_symbol: z.string().describe('挿入位置の基準となるシンボルパス'),
  position: z.enum(['before', 'after']).describe('挿入位置: シンボルの前(before)または後(after)'),
  content: z.string().describe('挿入するコード内容'),
  file_path: z.string().optional().describe('対象ファイルパス（省略時は自動検索）'),
  auto_indent: z.boolean().optional().default(true).describe('自動インデント調整'),
  preserve_spacing: z.boolean().optional().default(true).describe('既存のスペーシングを保持'),
  create_backup: z.boolean().optional().default(true).describe('変更前のバックアップを作成')
});

type CodeInsertAtSymbolParams = z.infer<typeof CodeInsertAtSymbolSchema>;

interface InsertResult {
  success: boolean;
  file_path: string;
  symbol_found: boolean;
  inserted_content: string;
  insertion_line: number;
  backup_path?: string;
  indentation_applied: string;
  lines_added: number;
}

/**
 * シンボル位置コード挿入ツール
 */
export class CodeInsertAtSymbolTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'code_insert_at_symbol',
    description: '指定されたシンボルの前後に精密にコードを挿入します',
    parameters: {
      target_symbol: {
        type: 'string',
        description: '挿入位置の基準となるシンボルパス (例: "MyClass.myMethod", "myFunction")',
        required: true
      },
      position: {
        type: 'string',
        description: '挿入位置: "before"（シンボルの前）または "after"（シンボルの後）',
        required: true
      },
      content: {
        type: 'string',
        description: '挿入するコード内容',
        required: true
      },
      file_path: {
        type: 'string',
        description: '対象ファイルパス（省略時は自動検索）',
        required: false
      },
      auto_indent: {
        type: 'boolean',
        description: '自動インデント調整（デフォルト: true）',
        required: false
      },
      preserve_spacing: {
        type: 'boolean',
        description: '既存のスペーシングを保持（デフォルト: true）',
        required: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        required: false
      }
    }
  };

  protected readonly schema = CodeInsertAtSymbolSchema;

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as CodeInsertAtSymbolParams;

    try {
      // 1. シンボルの場所を特定
      const symbolLocation = await this.findSymbolLocation(params.target_symbol, params.file_path);
      
      if (!symbolLocation) {
        return this.createErrorResult(`シンボル "${params.target_symbol}" が見つかりませんでした`);
      }

      // 2. 現在のファイル内容を取得
      const currentContent = await fs.readFile(symbolLocation.file_path, 'utf-8');
      const lines = currentContent.split('\n');

      // 3. シンボルの範囲を特定
      const symbolRange = await this.getSymbolRange(currentContent, symbolLocation);
      
      if (!symbolRange) {
        return this.createErrorResult('シンボルの範囲を特定できませんでした');
      }

      // 4. バックアップ作成
      let backupPath: string | undefined;
      if (params.create_backup) {
        backupPath = await this.createBackup(symbolLocation.file_path, currentContent);
      }

      // 5. 挿入位置を決定
      const insertionLine = this.determineInsertionLine(symbolRange, params.position);

      // 6. インデント調整
      const indentedContent = this.adjustIndentation(
        params.content,
        lines,
        insertionLine,
        params.auto_indent
      );

      // 7. コンテンツ挿入
      const updatedLines = [...lines];
      const insertLines = indentedContent.split('\n');
      
      // スペーシング調整
      if (params.preserve_spacing) {
        if (params.position === 'before' && insertionLine > 0) {
          insertLines.push(''); // 後にスペース追加
        }
        if (params.position === 'after' && insertionLine < lines.length - 1) {
          insertLines.unshift(''); // 前にスペース追加
        }
      }

      updatedLines.splice(insertionLine, 0, ...insertLines);

      // 8. ファイル更新
      const updatedContent = updatedLines.join('\n');
      await fs.writeFile(symbolLocation.file_path, updatedContent, 'utf-8');

      // 9. 結果をまとめる
      const result: InsertResult = {
        success: true,
        file_path: symbolLocation.file_path,
        symbol_found: true,
        inserted_content: indentedContent,
        insertion_line: insertionLine,
        backup_path: backupPath,
        indentation_applied: this.getIndentationInfo(lines, insertionLine),
        lines_added: insertLines.length
      };

      Logger.getInstance().info('Code inserted at symbol successfully', {
        target_symbol: params.target_symbol,
        file_path: symbolLocation.file_path,
        position: params.position,
        lines_added: insertLines.length
      });

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logFileOperation(
        'INSERT_AT_SYMBOL',
        symbolLocation.file_path,
        `Inserted ${insertLines.length} lines ${params.position} symbol "${params.target_symbol}"`
      );

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error: any) {
      Logger.getInstance().error('Failed to insert code at symbol', error.message);
      return this.createErrorResult(`コード挿入エラー: ${error.message}`);
    }
  }

  private async findSymbolLocation(symbolPath: string, filePath?: string): Promise<{
    file_path: string;
    line: number;
    column: number;
  } | null> {
    // 簡易実装: ファイルパスが指定されている場合はそれを使用
    // 実際のLSP統合は後で実装
    if (filePath) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(symbolPath)) {
            return {
              file_path: filePath,
              line: i,
              column: line.indexOf(symbolPath)
            };
          }
        }
      } catch (error) {
        Logger.getInstance().warn('Failed to read file for symbol search');
      }
    }
    
    return null;
  }

  private async getSymbolRange(
    content: string, 
    location: { line: number; column: number }
  ): Promise<{ start_line: number; end_line: number } | null> {
    
    const lines = content.split('\n');
    const startLine = location.line;
    
    // シンボルの終了位置を検出
    let braceLevel = 0;
    let symbolEnd = startLine;
    let foundStart = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('{')) {
        braceLevel += (line.match(/\{/g) || []).length;
        foundStart = true;
      }
      
      if (line.includes('}')) {
        braceLevel -= (line.match(/\}/g) || []).length;
      }
      
      if (foundStart && braceLevel === 0) {
        symbolEnd = i;
        break;
      }
      
      // 単行の宣言やexpression（セミコロンで終わる）
      if (!foundStart && line.trim().endsWith(';')) {
        symbolEnd = i;
        break;
      }
    }

    return {
      start_line: startLine,
      end_line: symbolEnd
    };
  }

  private determineInsertionLine(
    symbolRange: { start_line: number; end_line: number },
    position: 'before' | 'after'
  ): number {
    if (position === 'before') {
      return symbolRange.start_line;
    } else {
      return symbolRange.end_line + 1;
    }
  }

  private adjustIndentation(
    content: string,
    existingLines: string[],
    insertionLine: number,
    autoIndent: boolean
  ): string {
    if (!autoIndent) {
      return content;
    }

    // 周辺行のインデントレベルを検出
    const referenceLineIndex = Math.max(0, insertionLine - 1);
    const referenceLine = existingLines[referenceLineIndex] || '';
    const baseIndent = this.detectIndentation(referenceLine);

    // 挿入するコンテンツの各行にインデントを適用
    const contentLines = content.split('\n');
    const indentedLines = contentLines.map((line, index) => {
      if (line.trim() === '') return line; // 空行はそのまま
      
      // 最初の行は基準インデント、それ以降は相対的にインデント
      const additionalIndent = index > 0 ? this.detectIndentation(line) : '';
      return baseIndent + additionalIndent + line.trim();
    });

    return indentedLines.join('\n');
  }

  private detectIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  private getIndentationInfo(lines: string[], insertionLine: number): string {
    const referenceLineIndex = Math.max(0, insertionLine - 1);
    const referenceLine = lines[referenceLineIndex] || '';
    const indent = this.detectIndentation(referenceLine);
    
    if (indent.includes('\t')) {
      return `タブ文字 × ${indent.length}`;
    } else {
      return `スペース × ${indent.length}`;
    }
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