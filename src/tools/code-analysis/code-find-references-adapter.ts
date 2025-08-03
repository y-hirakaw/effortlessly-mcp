/**
 * code_find_references ツールアダプター
 * ITool インターフェースに適合
 */

import { ITool, IToolResult, IToolMetadata } from '../../types/common.js';
import { codeFindReferencesTool } from './code-find-references.js';
import { z } from 'zod';

/**
 * code_find_references ツールのアダプター
 */
export class CodeFindReferencesTool implements ITool {
  readonly metadata: IToolMetadata = {
    name: 'code_find_references',
    description: codeFindReferencesTool.description,
    parameters: {
      file_path: {
        type: 'string',
        description: 'ファイルパス',
        required: true,
      },
      line: {
        type: 'number',
        description: '行番号（0から開始）',
        required: true,
      },
      column: {
        type: 'number',
        description: '列番号（0から開始）',
        required: true,
      },
      include_declaration: {
        type: 'boolean',
        description: '宣言も含めるかどうか',
        required: false,
      },
    },
  };

  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    try {
      // パラメータの検証
      const validatedParams = codeFindReferencesTool.inputSchema.parse(parameters);
      
      // ツールの実行
      const result = await codeFindReferencesTool.execute(validatedParams);
      
      // 結果を IToolResult 形式に変換
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            tool: 'code_find_references',
            total_references: result.stats.total_references,
            files_with_references: result.stats.files_with_references,
          },
        }],
        isError: false,
      };
    } catch (error) {
      // エラーハンドリング
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof z.ZodError) {
        errorMessage = `パラメータ検証エラー: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            references: [],
            references_by_file: {},
            stats: { total_references: 0, files_with_references: 0 }
          }, null, 2),
        }],
        isError: true,
      };
    }
  }
}