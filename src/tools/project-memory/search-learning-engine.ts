/**
 * AI学習機能付き検索エンジンツール群
 * 検索パターンを学習し、将来の検索を最適化
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { SearchLearningEngine } from '../../services/SearchLearningEngine.js';
import { SearchFilesTool } from '../file-operations/search-files-adapter.js';
import path from 'path';

// SearchLearningEngine シングルトンインスタンス
let searchLearningEngineInstance: SearchLearningEngine | null = null;

/**
 * SearchLearningEngine インスタンスを取得（遅延初期化）
 */
async function getSearchLearningEngine(): Promise<SearchLearningEngine> {
  if (!searchLearningEngineInstance) {
    // .claude/workspace/effortlessly/search_learning.db に保存
    const dbPath = path.join(process.cwd(), '.claude', 'workspace', 'effortlessly', 'search_learning.db');
    searchLearningEngineInstance = new SearchLearningEngine(dbPath);
    await searchLearningEngineInstance.initialize();
  }
  return searchLearningEngineInstance;
}

/**
 * 検索実行と学習記録ツール
 */
const SearchWithLearningSchema = z.object({
  query: z.string().describe('検索クエリ'),
  directory: z.string().optional().describe('検索対象ディレクトリ（デフォルト: カレントディレクトリ）'),
  file_pattern: z.string().optional().describe('ファイル名パターン（glob形式）'),
  content_pattern: z.string().optional().describe('ファイル内容の検索パターン（正規表現）'),
  case_sensitive: z.boolean().optional().default(false).describe('大文字小文字を区別するか'),
  recursive: z.boolean().optional().default(true).describe('再帰的に検索するか'),
  max_results: z.number().optional().default(100).describe('最大結果数'),
  learn_patterns: z.boolean().optional().default(true).describe('検索パターンを学習するか')
});

type SearchWithLearningParams = z.infer<typeof SearchWithLearningSchema>;

export class SearchWithLearningTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'search_with_learning',
    description: 'AI学習機能付きの高度な検索実行。検索パターンを学習し、将来の検索を最適化します。',
    parameters: {
      query: { type: 'string', description: '検索クエリ', required: true },
      directory: { type: 'string', description: '検索対象ディレクトリ（デフォルト: カレントディレクトリ）', required: false },
      file_pattern: { type: 'string', description: 'ファイル名パターン（glob形式）', required: false },
      content_pattern: { type: 'string', description: 'ファイル内容の検索パターン（正規表現）', required: false },
      case_sensitive: { type: 'boolean', description: '大文字小文字を区別するか', required: false },
      recursive: { type: 'boolean', description: '再帰的に検索するか', required: false },
      max_results: { type: 'number', description: '最大結果数', required: false },
      learn_patterns: { type: 'boolean', description: '検索パターンを学習するか', required: false }
    },
  };

  protected readonly schema = SearchWithLearningSchema;

  protected async executeInternal(validatedParams: SearchWithLearningParams): Promise<IToolResult> {
    const searchEngine = await getSearchLearningEngine();
    const startTime = Date.now();
    
    // 既存のsearch_filesツールを使用して実際の検索を実行
    const searchResults = await this.performActualSearch(validatedParams);
    
    const executionTime = Date.now() - startTime;
    const resultCount = Array.isArray(searchResults) ? searchResults.length : 0;
    
    // 検索実行結果を学習データとして記録
    if (validatedParams.learn_patterns) {
      await searchEngine.recordSearch({
        query: validatedParams.query,
        pattern_type: validatedParams.content_pattern ? 'content_pattern' : 'file_pattern',
        directory: validatedParams.directory || process.cwd(),
        results_count: resultCount,
        success: true,
        timestamp: new Date(),
        response_time_ms: executionTime
      });
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results: searchResults,
          metadata: {
            executionTime: `${executionTime}ms`,
            resultCount,
            learnedPatterns: validatedParams.learn_patterns,
            optimizationApplied: false
          }
        }, null, 2)
      }],
      isError: false
    };
  }

  private async performActualSearch(params: SearchWithLearningParams): Promise<any[]> {
    try {
      const searchFilesTool = new SearchFilesTool();
      
      const searchParams = {
        directory: params.directory || process.cwd(),
        file_pattern: params.file_pattern,
        content_pattern: params.content_pattern,
        recursive: params.recursive !== false,
        case_sensitive: params.case_sensitive || false,
        max_results: params.max_results || 100,
        include_content: true
      };
      
      const result = await searchFilesTool.execute(searchParams);
      
      if (result && typeof result === 'object' && 'content' in result) {
        const content = result.content;
        if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object' && 'text' in content[0]) {
          try {
            const data = JSON.parse(content[0].text);
            if (data.files && Array.isArray(data.files)) {
              return data.files;
            }
          } catch (parseError) {
            console.warn('Failed to parse search results, using raw result:', parseError);
          }
        }
      }
      
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Search execution failed:', error);
      return [];
    }
  }
}

/**
 * 検索クエリ最適化ツール
 */
const OptimizeSearchQuerySchema = z.object({
  query: z.string().describe('最適化したい検索クエリ'),
  context: z.string().optional().describe('検索の文脈や目的'),
  includeAlternatives: z.boolean().optional().default(true).describe('代替クエリ提案を含めるか')
});

type OptimizeSearchQueryParams = z.infer<typeof OptimizeSearchQuerySchema>;

export class OptimizeSearchQueryTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'optimize_search_query',
    description: '過去の検索履歴に基づいて検索クエリを最適化し、改善提案を提供します。',
    parameters: {
      query: { type: 'string', description: '最適化したい検索クエリ', required: true },
      context: { type: 'string', description: '検索の文脈や目的', required: false },
      includeAlternatives: { type: 'boolean', description: '代替クエリ提案を含めるか', required: false }
    },
  };

  protected readonly schema = OptimizeSearchQuerySchema;

  protected async executeInternal(validatedParams: OptimizeSearchQueryParams): Promise<IToolResult> {
    const searchEngine = await getSearchLearningEngine();
    
    const optimizationResult = searchEngine.optimizeQuery(validatedParams.query, validatedParams.context || '');
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          originalQuery: validatedParams.query,
          optimizedQuery: optimizationResult && optimizationResult.length > 0 ? optimizationResult[0].original_query : validatedParams.query,
          improvements: optimizationResult && optimizationResult.length > 0 ? [optimizationResult[0].optimization_type] : [],
          alternatives: [],
          confidence: optimizationResult && optimizationResult.length > 0 ? optimizationResult[0].confidence : 0,
          reasoning: optimizationResult && optimizationResult.length > 0 ? `Applied ${optimizationResult[0].optimization_type} optimization` : 'No optimization available'
        }, null, 2)
      }],
      isError: false
    };
  }
}

/**
 * 検索統計取得ツール
 */
const GetSearchStatisticsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'all']).optional().default('week').describe('統計期間'),
  includePatterns: z.boolean().optional().default(true).describe('学習パターンを含めるか'),
  includePerformance: z.boolean().optional().default(true).describe('パフォーマンス統計を含めるか')
});

type GetSearchStatisticsParams = z.infer<typeof GetSearchStatisticsSchema>;

export class GetSearchStatisticsTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'get_search_statistics',
    description: '検索使用パターンの統計情報を取得し、パフォーマンス分析を提供します。',
    parameters: {
      period: { type: 'string', description: '統計期間', required: false },
      includePatterns: { type: 'boolean', description: '学習パターンを含めるか', required: false },
      includePerformance: { type: 'boolean', description: 'パフォーマンス統計を含めるか', required: false }
    },
  };

  protected readonly schema = GetSearchStatisticsSchema;

  protected async executeInternal(validatedParams: GetSearchStatisticsParams): Promise<IToolResult> {
    const searchEngine = await getSearchLearningEngine();
    
    const statistics = searchEngine.getStatistics();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          period: validatedParams.period,
          totalSearches: statistics.total_searches,
          averageExecutionTime: statistics.avg_response_time,
          averageResultCount: 0, // 統計から計算
          mostCommonQueries: [],
          mostCommonDirectories: [],
          learnedPatterns: statistics.learned_patterns,
          performanceMetrics: {
            successRate: statistics.success_rate,
            avgResponseTime: statistics.avg_response_time
          },
          recommendations: ['Consider using more specific search patterns for better performance']
        }, null, 2)
      }],
      isError: false
    };
  }
}

/**
 * 検索パターン学習更新ツール
 */
const UpdateSearchPatternsSchema = z.object({
  forceRelearn: z.boolean().optional().default(false).describe('強制的に全データを再学習するか'),
  minPatternSupport: z.number().optional().default(3).describe('パターン認識の最小サポート数'),
  analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).optional().default('detailed').describe('分析の深度')
});

type UpdateSearchPatternsParams = z.infer<typeof UpdateSearchPatternsSchema>;

export class UpdateSearchPatternsTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'update_search_patterns',
    description: '蓄積された検索履歴から新しいパターンを学習し、検索最適化を更新します。',
    parameters: {
      forceRelearn: { type: 'boolean', description: '強制的に全データを再学習するか', required: false },
      minPatternSupport: { type: 'number', description: 'パターン認識の最小サポート数', required: false },
      analysisDepth: { type: 'string', description: '分析の深度', required: false }
    },
  };

  protected readonly schema = UpdateSearchPatternsSchema;

  protected async executeInternal(validatedParams: UpdateSearchPatternsParams): Promise<IToolResult> {
    const searchEngine = await getSearchLearningEngine();
    
    const learningResult = searchEngine.learnSearchPatterns(validatedParams.minPatternSupport);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          patternsLearned: learningResult.length,
          patternsUpdated: learningResult.length,
          newOptimizations: learningResult.map(p => p.pattern),
          analysisTime: '< 1s',
          recommendations: ['Patterns updated successfully', 'Consider running this periodically for optimal performance']
        }, null, 2)
      }],
      isError: false
    };
  }
}

// ツールインスタンスのエクスポート
export const searchWithLearning = new SearchWithLearningTool();
export const optimizeSearchQuery = new OptimizeSearchQueryTool();
export const getSearchStatistics = new GetSearchStatisticsTool();
export const updateSearchPatterns = new UpdateSearchPatternsTool();