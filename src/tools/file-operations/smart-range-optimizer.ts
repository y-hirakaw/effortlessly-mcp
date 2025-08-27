import { z } from 'zod';
import { Logger } from '../../services/logger.js';
import { SmartRangeOptimizer, Intent } from '../../services/SmartRangeOptimizer.js';
import type { MdcToolImplementation } from '../../types/mcp.js';

const logger = Logger.getInstance();

// ツールのパラメータスキーマ
const SmartRangeOptimizerParams = z.object({
  file_path: z.string().describe('分析対象のファイルパス'),
  intent: z.enum([
    'bug_investigation',
    'code_review',
    'feature_addition',
    'refactoring',
    'documentation',
    'testing',
    'general'
  ]).optional().default('general').describe('読み込みの意図・目的'),
  max_ranges: z.number().optional().default(5).describe('提案する最大範囲数（デフォルト: 5）'),
  semantic_queries: z.array(z.string()).optional().describe('自然言語での検索クエリ (例: "エラー処理", "データベース接続", "認証ロジック")'),
});

type SmartRangeOptimizerParamsType = z.infer<typeof SmartRangeOptimizerParams>;

// ツールの結果スキーマ
const SmartRangeOptimizerResult = z.object({
  file_path: z.string().describe('分析対象のファイルパス'),
  intent: z.string().describe('読み込みの意図'),
  suggested_ranges: z.array(z.object({
    start: z.number().describe('開始行番号（1-indexed）'),
    end: z.number().describe('終了行番号（1-indexed）'),
    label: z.string().describe('範囲のラベル'),
    relevance: z.number().describe('関連性スコア（0.0-1.0）'),
    reason: z.string().optional().describe('選択理由')
  })).describe('提案された読み込み範囲'),
  total_lines: z.number().describe('ファイル全体の行数'),
  optimization_info: z.object({
    pattern_matches: z.number().describe('パターンマッチ数'),
    historical_data_used: z.boolean().describe('履歴データの使用有無'),
    confidence: z.number().describe('提案の信頼度（0.0-1.0）')
  }).optional().describe('最適化情報'),
  usage_example: z.object({
    tool: z.string().describe('使用するツール名'),
    params: z.any().describe('ツールのパラメータ例')
  }).optional().describe('使用例')
});

type SmartRangeOptimizerResultType = z.infer<typeof SmartRangeOptimizerResult>;

/**
 * smart_range_optimizer ツールの実装
 * AIによる最適な読み込み範囲を提案
 */
export const smartRangeOptimizerTool: MdcToolImplementation<SmartRangeOptimizerParamsType, SmartRangeOptimizerResultType> = {
  name: 'smart_range_optimizer',
  description: 'AIによる最適なファイル読み込み範囲の提案。意図に基づいて関連性の高い部分を特定',
  inputSchema: SmartRangeOptimizerParams as z.ZodSchema<SmartRangeOptimizerParamsType>,

  async execute(params: SmartRangeOptimizerParamsType): Promise<SmartRangeOptimizerResultType> {
    logger.info('smart_range_optimizer tool called', { params });

    try {
      const optimizer = SmartRangeOptimizer.getInstance();
      
      // 最適範囲の提案を取得
      const suggestedRanges = await optimizer.suggestOptimalRanges(
        params.file_path,
        params.intent as Intent,
        params.max_ranges,
        params.semantic_queries || []
      );
      
      // ファイルの行数を取得（簡易的な実装）
      const fs = await import('fs');
      const path = await import('path');
      const content = await fs.promises.readFile(
        path.resolve(params.file_path), 
        'utf-8'
      );
      const totalLines = content.split('\n').length;
      
      // 使用例の生成
      const usageExample = {
        tool: 'read_file',
        params: {
          file_path: params.file_path,
          ranges: suggestedRanges.map(r => ({
            start: r.start,
            end: r.end,
            label: r.label
          }))
        }
      };
      
      // 最適化情報の計算
      const optimizationInfo = {
        pattern_matches: suggestedRanges.length,
        historical_data_used: suggestedRanges.some(r => 
          r.reason?.includes('履歴データから学習')
        ),
        confidence: suggestedRanges.length > 0
          ? suggestedRanges.reduce((sum, r) => sum + r.relevance, 0) / suggestedRanges.length
          : 0.5
      };
      
      logger.info('Optimal ranges suggested', {
        file_path: params.file_path,
        intent: params.intent,
        range_count: suggestedRanges.length,
        total_lines: totalLines,
        confidence: optimizationInfo.confidence
      });
      
      return {
        file_path: params.file_path,
        intent: params.intent,
        suggested_ranges: suggestedRanges,
        total_lines: totalLines,
        optimization_info: optimizationInfo,
        usage_example: usageExample
      };
      
    } catch (error) {
      logger.error('Failed to suggest optimal ranges', error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `範囲提案中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};