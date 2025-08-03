import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { codeSearchPatternTool, CodeSearchPatternParamsSchema } from './code-search-pattern.js';
import type { ITool, IToolResult } from '../../types/common.js';
// import { SecurityManager } from '../../services/security/security-manager.js';
import { Logger } from '../../services/logger.js';

/**
 * code_search_pattern ツールのアダプター
 */
export class CodeSearchPatternTool implements ITool {
  readonly metadata = {
    name: 'code_search_pattern',
    description: '柔軟なパターン検索機能を提供します。正規表現パターンによるファイル内容検索、ファイルタイプフィルタ、除外パターン、コンテキスト情報を含む高度な検索が可能です。',
    parameters: {
      pattern: {
        type: 'string' as const,
        description: '検索パターン（正規表現対応）',
        required: true
      },
      case_sensitive: {
        type: 'boolean' as const,
        description: '大文字小文字を区別するか',
        required: false
      },
      max_results: {
        type: 'number' as const,
        description: '最大結果数',
        required: false
      },
      file_size_limit: {
        type: 'number' as const,
        description: 'ファイルサイズ制限（バイト）',
        required: false
      },
      context_lines: {
        type: 'number' as const,
        description: 'マッチした行の前後に表示する行数',
        required: false
      },
      whole_word: {
        type: 'boolean' as const,
        description: '単語境界での検索',
        required: false
      },
      include_symbol_context: {
        type: 'boolean' as const,
        description: 'シンボルコンテキスト情報を含めるか',
        required: false
      },
      search_mode: {
        type: 'string' as const,
        description: '検索モード: symbol, content, hybrid',
        required: false
      },
      workspace_path: {
        type: 'string' as const,
        description: 'ワークスペースパス（省略時は現在のワークスペース）',
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
      const params = CodeSearchPatternParamsSchema.parse(request.params);
      
      // セキュリティチェック
      // const securityManager = SecurityManager.getInstance();
      
      // if (params.workspace_path) {
      //   await securityManager.validatePath(params.workspace_path, 'read');
      // }
      
      // 操作ログ
      logger.info('Executing code_search_pattern', { 
        pattern: params.pattern,
        search_mode: params.search_mode,
        file_types: params.file_types
      });

      // ツール実行
      const result = await codeSearchPatternTool.execute(params);
      
      // 結果のログ記録
      logger.info('code_search_pattern completed successfully', {
        pattern: params.pattern,
        matches_found: result.total_matches || 0
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
      
      logger.error('code_search_pattern failed', {
        errorMessage,
        params: request.params
      } as any);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'code_search_pattern failed',
              message: errorMessage,
              details: 'Check the pattern syntax and ensure the workspace is properly activated'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}