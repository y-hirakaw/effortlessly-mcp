/**
 * コードシンボル本体置換ツール
 * 関数・クラス・メソッドの実装部分のみを精密に置換
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
// import { LSPService } from '../../services/lsp/lsp-service.js';
import { Logger } from '../../services/logger.js';

import { LogManager } from '../../utils/log-manager.js';
import { promises as fs } from 'fs';

const CodeReplaceSymbolBodySchema = z.object({
  symbol_path: z.string().describe('置換対象のシンボルパス (例: "className.methodName", "functionName")'),
  new_body: z.string().describe('新しい実装コード（シグネチャは除く）'),
  intent: z.string().optional().default('シンボル置換').describe('この操作を行う理由・目的'),
  preserve_signature: z.boolean().optional().default(true).describe('シグネチャを保持するかどうか'),
  file_path: z.string().optional().describe('対象ファイルパス（指定がない場合はシンボル検索で自動検出）'),
  create_backup: z.boolean().optional().default(true).describe('変更前のバックアップを作成')
});

type CodeReplaceSymbolBodyParams = z.infer<typeof CodeReplaceSymbolBodySchema>;

interface SymbolReplaceResult {
  success: boolean;
  file_path: string;
  symbol_found: boolean;
  original_code: string;
  new_code: string;
  backup_path?: string;
  diff_summary: string;
  line_range: {
    start: number;
    end: number;
  };
}

/**
 * シンボル本体置換ツール
 */
export class CodeReplaceSymbolBodyTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'code_replace_symbol_body',
    description: 'コードシンボル（関数・クラス・メソッド）の実装部分のみを精密に置換します',
    parameters: {
      symbol_path: {
        type: 'string',
        description: '置換対象のシンボルパス (例: "MyClass.myMethod", "myFunction")',
        required: true
      },
      new_body: {
        type: 'string', 
        description: '新しい実装コード（シグネチャは除く本体のみ）',
        required: true
      },
      intent: {
        type: 'string',
        description: 'この操作を行う理由・目的',
        required: false
      },
      preserve_signature: {
        type: 'boolean',
        description: 'シグネチャを保持するかどうか（デフォルト: true）',
        required: false
      },
      file_path: {
        type: 'string',
        description: '対象ファイルパス（省略時は自動検索）',  
        required: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        required: false
      }
    }
  };

  protected readonly schema = CodeReplaceSymbolBodySchema;

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as CodeReplaceSymbolBodyParams;

    try {
      // 1. シンボルの場所を特定
      const symbolLocation = await this.findSymbolLocation(params.symbol_path, params.file_path);
      
      if (!symbolLocation) {
        return this.createErrorResult(`シンボル "${params.symbol_path}" が見つかりませんでした`);
      }

      // 2. 現在のファイル内容を取得
      const currentContent = await fs.readFile(symbolLocation.file_path, 'utf-8');
      
      // 3. シンボルの本体部分を抽出
      const symbolBody = await this.extractSymbolBody(
        currentContent, 
        symbolLocation,
        params.preserve_signature
      );

      if (!symbolBody) {
        return this.createErrorResult('シンボルの本体を正しく抽出できませんでした');
      }

      // 4. バックアップ作成
      let backupPath: string | undefined;
      if (params.create_backup) {
        backupPath = await this.createBackup(symbolLocation.file_path, currentContent);
      }

      // 5. 新しいコードを構築
      const newSymbolCode = this.buildNewSymbolCode(
        symbolBody,
        params.new_body,
        params.preserve_signature
      );

      // 6. ファイル更新
      const updatedContent = this.replaceSymbolInContent(
        currentContent,
        symbolBody,
        newSymbolCode
      );

      await fs.writeFile(symbolLocation.file_path, updatedContent, 'utf-8');

      // 7. 結果をまとめる
      const result: SymbolReplaceResult = {
        success: true,
        file_path: symbolLocation.file_path,
        symbol_found: true,
        original_code: symbolBody.full_code,
        new_code: newSymbolCode,
        backup_path: backupPath,
        diff_summary: this.generateDiffSummary(symbolBody.full_code, newSymbolCode),
        line_range: {
          start: symbolBody.start_line,
          end: symbolBody.end_line
        }
      };

      Logger.getInstance().info('Symbol body replaced successfully', {
        symbol_path: params.symbol_path,
        file_path: symbolLocation.file_path,
        backup_created: !!backupPath
      });

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logOperation(
        'CODE_REPLACE_SYMBOL',
        symbolLocation.file_path,
        `Symbol "${params.symbol_path}" body replaced | Lines: ${symbolBody.start_line}-${symbolBody.end_line} | Backup: ${!!backupPath}`,
        this.metadata
      );

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.getInstance().error('Failed to replace symbol body', error instanceof Error ? error : new Error(errorMessage));
      return this.createErrorResult(`シンボル置換エラー: ${errorMessage}`);
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
      // ファイル内でのシンプルな文字列検索による近似
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

  private async extractSymbolBody(
    content: string, 
    location: { file_path: string; line: number; column: number },
    _preserveSignature: boolean
  ): Promise<{
    full_code: string;
    signature: string;
    body: string;
    start_line: number;
    end_line: number;
  } | null> {
    
    const lines = content.split('\n');
    const startLine = location.line;
    
    // シンボルの開始を検出
    let symbolStart = startLine;
    let braceLevel = 0;
    let inFunction = false;
    let symbolEnd = startLine;

    // 関数/メソッド/クラスの開始を検出
    for (let i = symbolStart; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('{')) {
        braceLevel += (line.match(/\{/g) || []).length;
        inFunction = true;
      }
      
      if (line.includes('}')) {
        braceLevel -= (line.match(/\}/g) || []).length;
      }
      
      if (inFunction && braceLevel === 0) {
        symbolEnd = i;
        break;
      }
    }

    if (!inFunction) {
      return null;
    }

    const symbolLines = lines.slice(symbolStart, symbolEnd + 1);
    const fullCode = symbolLines.join('\n');

    // シグネチャと本体を分離
    const firstBraceIndex = fullCode.indexOf('{');
    const lastBraceIndex = fullCode.lastIndexOf('}');
    
    if (firstBraceIndex === -1 || lastBraceIndex === -1) {
      return null;
    }

    const signature = fullCode.substring(0, firstBraceIndex + 1);
    const body = fullCode.substring(firstBraceIndex + 1, lastBraceIndex);

    return {
      full_code: fullCode,
      signature: signature.trim(),
      body: body.trim(),
      start_line: symbolStart,
      end_line: symbolEnd
    };
  }

  private buildNewSymbolCode(
    originalSymbol: { signature: string; body: string; full_code: string },
    newBody: string,
    preserveSignature: boolean
  ): string {
    if (preserveSignature) {
      // シグネチャを保持して本体のみ置換
      return `${originalSymbol.signature}\n${newBody}\n}`;
    } else {
      // 全体を置換
      return newBody;
    }
  }

  private replaceSymbolInContent(
    content: string, 
    originalSymbol: { full_code: string },
    newCode: string
  ): string {
    return content.replace(originalSymbol.full_code, newCode);
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

  private generateDiffSummary(originalCode: string, newCode: string): string {
    const originalLines = originalCode.split('\n').length;
    const newLines = newCode.split('\n').length;
    const lineDiff = newLines - originalLines;
    
    return `行数変更: ${originalLines} → ${newLines} (${lineDiff >= 0 ? '+' : ''}${lineDiff})`;
  }
}