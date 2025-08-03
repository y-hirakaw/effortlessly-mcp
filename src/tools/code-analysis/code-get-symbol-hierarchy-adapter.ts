/**
 * code_get_symbol_hierarchy ツールアダプター
 * 階層構造でのシンボル検索機能を提供
 */

import { ITool, IToolMetadata, IToolResult } from '../../types/common.js';
import { 
  codeGetSymbolHierarchyTool,
  CodeGetSymbolHierarchyParamsSchema
} from './code-get-symbol-hierarchy.js';

export class CodeGetSymbolHierarchyTool implements ITool {
  public readonly metadata: IToolMetadata = {
    name: 'code_get_symbol_hierarchy',
    description: 'ファイルまたはディレクトリのシンボル階層（クラス、関数、変数など）を階層構造で取得します。LSPサーバーを使用してセマンティック解析を提供します。',
    parameters: {
      file_path: {
        type: 'string',
        description: '特定のファイルのシンボル階層を取得（省略時はディレクトリ全体）',
        required: false
      },
      directory_path: {
        type: 'string', 
        description: '特定のディレクトリのシンボル階層を取得（省略時は全体）',
        required: false
      },
      max_depth: {
        type: 'number',
        description: '最大階層深度',
        required: false
      },
      include_private: {
        type: 'boolean',
        description: 'プライベートシンボルも含めるか',
        required: false
      },
      symbol_kinds: {
        type: 'array',
        description: '含めるシンボル種類の配列（SymbolKind）',
        required: false
      }
    }
  };

  async execute(params: Record<string, unknown>): Promise<IToolResult> {
    // パラメータを検証
    const validatedParams = CodeGetSymbolHierarchyParamsSchema.parse(params);
    
    // 実際のツール実装を呼び出し
    const result = await codeGetSymbolHierarchyTool.execute(validatedParams);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
}