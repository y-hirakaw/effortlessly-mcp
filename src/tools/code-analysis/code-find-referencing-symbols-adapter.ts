import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { codeFindReferencingSymbolsTool, CodeFindReferencingSymbolsParamsSchema } from './code-find-referencing-symbols.js';
import type { ITool, IToolResult } from '../../types/common.js';
// import { SecurityManager } from '../../services/security/security-manager.js';
import { Logger } from '../../services/logger.js';

/**
 * code_find_referencing_symbols ツールのアダプター
 */
export class CodeFindReferencingSymbolsTool implements ITool {
  readonly metadata = {
    name: 'code_find_referencing_symbols',
    description: '指定したシンボルを参照している箇所を検索します。LSP統合によるセマンティック検索とテキストベース検索のフォールバック機能を提供します。',
    parameters: {
      target_symbol: {
        type: 'string' as const,
        description: '検索対象のシンボル名',
        required: true
      },
      max_results: {
        type: 'number' as const,
        description: '最大結果数',
        required: false
      },
      context_lines: {
        type: 'number' as const,
        description: 'マッチした行の前後に表示する行数',
        required: false
      },
      include_body: {
        type: 'boolean' as const,
        description: 'シンボル本体を結果に含めるか',
        required: false
      },
      include_declarations: {
        type: 'boolean' as const,
        description: '宣言も結果に含めるか',
        required: false
      },
      workspace_path: {
        type: 'string' as const,
        description: 'ワークスペースパス（省略時は現在のワークスペース）',
        required: false
      },
      symbol_kinds: {
        type: 'array' as const,
        description: '検索対象シンボル種類の配列',
        required: false
      },
      file_types: {
        type: 'array' as const,
        description: '検索対象ファイル拡張子',
        required: false
      },
      exclude_patterns: {
        type: 'array' as const,
        description: '除外パターン',
        required: false
      }
    }
  } as const;

  async execute(request: z.infer<typeof CallToolRequestSchema>): Promise<IToolResult> {
    const logger = Logger.getInstance();
    
    try {
      // パラメータの検証
      const params = CodeFindReferencingSymbolsParamsSchema.parse(request.params);
      
      // セキュリティチェック
      // const securityManager = SecurityManager.getInstance();
      
      // if (params.workspace_path) {
      //   await securityManager.validatePath(params.workspace_path, 'read');
      // }
      
      // 操作ログ
      logger.info('Executing code_find_referencing_symbols', { 
        target_symbol: params.target_symbol,
        file_types: params.file_types,
        max_results: params.max_results
      });

      // ツール実行
      const result = await codeFindReferencingSymbolsTool.execute(params);
      
      // 結果のログ記録
      logger.info('code_find_referencing_symbols completed successfully', {
        target_symbol: params.target_symbol,
        references_found: result.results?.length || 0
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      logger.error('code_find_referencing_symbols failed', {
        errorMessage,
        params: request.params
      } as any);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'code_find_referencing_symbols failed',
              message: errorMessage,
              details: 'Check the symbol name and ensure the workspace is properly activated'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}