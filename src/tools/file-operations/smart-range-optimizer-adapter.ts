import { ITool, IToolParameter } from '../../types/common.js';
import { smartRangeOptimizerTool } from './smart-range-optimizer.js';

/**
 * SmartRangeOptimizer Tool Adapter
 * AIによる最適なファイル読み込み範囲の提案
 */
export class SmartRangeOptimizerTool implements ITool {
  public readonly name = 'smart_range_optimizer';
  public readonly metadata = {
    name: 'smart_range_optimizer',
    description: smartRangeOptimizerTool.description,
    parameters: {
      file_path: {
        type: 'string',
        description: '分析対象のファイルパス',
        required: true
      } as IToolParameter,
      intent: {
        type: 'string',
        description: '読み込みの意図・目的（bug_investigation, code_review, feature_addition, refactoring, documentation, testing, general）',
        required: false
      } as IToolParameter,
      max_ranges: {
        type: 'number',
        description: '提案する最大範囲数（デフォルト: 5）',
        required: false
      } as IToolParameter,
      semantic_queries: {
        type: 'array',
        description: '自然言語での検索クエリ (例: "エラー処理", "データベース接続", "認証ロジック")',
        required: false
      } as IToolParameter
    }
  };

  async execute(params: any): Promise<any> {
    try {
      const result = await smartRangeOptimizerTool.execute(params);
      
      // 結果を IToolResult 形式に変換（他のツールと同じ形式）
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            file_path: result.file_path,
            intent: result.intent,
            range_count: result.suggested_ranges?.length || 0,
            total_lines: result.total_lines,
            confidence: result.optimization_info?.confidence || 0
          },
        }],
        isError: false,
      };
    } catch (error) {
      console.error('SmartRangeOptimizerTool execute error:', error);
      
      // エラーも同じ形式で返す
      return {
        content: [{
          type: 'text',
          text: `SmartRangeOptimizer エラー: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }
}