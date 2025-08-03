/**
 * CodeGetSymbolsOverview MCPアダプタークラス
 * ファイル・ディレクトリの包括的シンボル構造概要
 */

import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { IToolResult, ITool } from '../../types/common.js';
import { 
  codeGetSymbolsOverviewTool, 
  CodeGetSymbolsOverviewParamsSchema 
} from './code-get-symbols-overview.js';
// import { SecurityManager } from '../../services/security/security-manager.js';
import { Logger } from '../../services/logger.js';

/**
 * CodeGetSymbolsOverview MCPアダプタークラス
 */
export class CodeGetSymbolsOverviewTool implements ITool {
  public readonly metadata = {
    name: 'code_get_symbols_overview',
    description: 'ファイルやディレクトリの包括的なシンボル構造概要を取得します。各ファイルのトップレベルシンボル（クラス、関数、インターフェース等）の一覧とプロジェクト構造の理解に適しています。',
    parameters: {
      relative_path: {
        type: 'string' as const,
        description: 'シンボル概要を取得する相対パス（ファイルまたはディレクトリ）',
        required: true
      },
      max_files: {
        type: 'number' as const,
        description: '最大処理ファイル数',
        required: false
      },
      include_private: {
        type: 'boolean' as const,
        description: 'プライベートシンボルも含めるか',
        required: false
      },
      include_test_files: {
        type: 'boolean' as const,
        description: 'テストファイルも含めるか',
        required: false
      },
      symbol_kinds: {
        type: 'array' as const,
        description: '含めるシンボル種類の配列（SymbolKind）',
        required: false
      },
      depth: {
        type: 'number' as const,
        description: 'ネストされたシンボルの深度（0=トップレベルのみ）',
        required: false
      }
    }
  } as const;

  async execute(request: z.infer<typeof CallToolRequestSchema>): Promise<IToolResult> {
    const logger = Logger.getInstance();
    
    try {
      // パラメータの検証
      const params = CodeGetSymbolsOverviewParamsSchema.parse(request.params);
      
      // セキュリティチェック
      // const securityManager = SecurityManager.getInstance();
      
      // パス検証
      // await securityManager.validatePath(params.relative_path, 'read');
      
      // 操作ログ
      logger.info('Executing code_get_symbols_overview', { 
        path: params.relative_path,
        max_files: params.max_files,
        include_private: params.include_private,
        include_test_files: params.include_test_files,
        depth: params.depth
      });

      // ツール実行
      const result = await codeGetSymbolsOverviewTool.execute(params);
      
      // 結果のログ記録
      logger.info('code_get_symbols_overview completed successfully', {
        path: params.relative_path,
        files_analyzed: result.summary.total_files,
        total_symbols: result.summary.total_symbols,
        languages: result.summary.languages
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
      
      logger.error('code_get_symbols_overview failed', {
        errorMessage,
        params: request.params
      } as any);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'code_get_symbols_overview failed',
              message: errorMessage,
              details: 'Check the path and ensure the workspace is properly activated'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}