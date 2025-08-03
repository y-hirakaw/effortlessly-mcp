/**
 * code_analyze_dependencies ツールアダプター
 * 依存関係分析機能を提供
 */

import { ITool, IToolMetadata, IToolResult } from '../../types/common.js';
import { 
  codeAnalyzeDependenciesTool,
  CodeAnalyzeDependenciesParamsSchema
} from './code-analyze-dependencies.js';

export class CodeAnalyzeDependenciesTool implements ITool {
  public readonly metadata: IToolMetadata = {
    name: 'code_analyze_dependencies',
    description: 'ファイルのインポート/エクスポート依存関係を分析し、依存関係グラフを生成します。循環依存の検出も行います。',
    parameters: {
      file_path: {
        type: 'string',
        description: '分析対象のファイルパス',
        required: true
      },
      depth: {
        type: 'number',
        description: '依存関係の追跡深度',
        required: false
      },
      include_external: {
        type: 'boolean',
        description: '外部ライブラリの依存関係も含めるか',
        required: false
      },
      include_dev_dependencies: {
        type: 'boolean',
        description: '開発依存関係も含めるか',
        required: false
      },
      resolve_imports: {
        type: 'boolean',
        description: 'インポートパスを解決するか',
        required: false
      }
    }
  };

  async execute(params: Record<string, unknown>): Promise<IToolResult> {
    // パラメータを検証
    const validatedParams = CodeAnalyzeDependenciesParamsSchema.parse(params);
    
    // 実際のツール実装を呼び出し
    const result = await codeAnalyzeDependenciesTool.execute(validatedParams);
    
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