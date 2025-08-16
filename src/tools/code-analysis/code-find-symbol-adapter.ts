/**
 * code_find_symbol ツールアダプター
 * ITool インターフェースに適合
 */

import { ITool, IToolResult, IToolMetadata } from '../../types/common.js';
import { codeFindSymbolTool } from './code-find-symbol.js';
import { z } from 'zod';

/**
 * code_find_symbol ツールのアダプター
 */
export class CodeFindSymbolTool implements ITool {
  readonly metadata: IToolMetadata = {
    name: 'code_find_symbol',
    description: codeFindSymbolTool.description,
    parameters: {
      symbol_name: {
        type: 'string',
        description: '検索するシンボル名',
        required: true,
      },
      search_type: {
        type: 'string',
        description: '検索タイプ (exact または fuzzy)',
        required: false,
      },
      symbol_kind: {
        type: 'number',
        description: 'シンボルの種類（SymbolKind）',
        required: false,
      },
      file_pattern: {
        type: 'string',
        description: 'ファイルパターン（部分マッチ）',
        required: false,
      },
      max_results: {
        type: 'number',
        description: '最大結果数',
        required: false,
      },
      enable_fallback: {
        type: 'boolean',
        description: 'フォールバック検索を有効にするか（デフォルト: true）',
        required: false,
      },
    },
  };

  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    try {
      // パラメータの検証
      const validatedParams = codeFindSymbolTool.inputSchema.parse(parameters);
      
      // ツールの実行
      const result = await codeFindSymbolTool.execute(validatedParams);
      
      // 結果を IToolResult 形式に変換
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            tool: 'code_find_symbol',
            total_found: result.stats.total_found,
            search_type: result.stats.search_type,
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
            symbols: [],
            stats: { total_found: 0 }
          }, null, 2),
        }],
        isError: true,
      };
    }
  }
}