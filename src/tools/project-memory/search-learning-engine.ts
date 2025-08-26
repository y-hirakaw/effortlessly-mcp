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
    
    // Phase2: キャッシュから検索結果を取得を試行
    const directory = validatedParams.directory || process.cwd();
    const patternType = validatedParams.content_pattern ? 'content_pattern' : 'file_pattern';
    
    // 自動クエリ最適化の実行
    let optimizedQuery = validatedParams.query;
    let optimizationSuggestions: any[] = [];
    if (validatedParams.learn_patterns) {
      const optimizations = searchEngine.optimizeQuery(validatedParams.query, directory);
      if (optimizations && optimizations.length > 0) {
        const bestOptimization = optimizations[0];
        if (bestOptimization.confidence > 0.7) {
          optimizedQuery = bestOptimization.optimized_query;
        }
        optimizationSuggestions = optimizations;
      }
    }
    
    // 期限切れキャッシュを清掃
    await searchEngine.cleanupExpiredCache();
    
    // キャッシュから結果を取得（最適化されたクエリを使用）
    let searchResults = await searchEngine.getCachedSearchResult(
      optimizedQuery,
      patternType,
      directory
    );
    
    let fromCache = true;
    if (!searchResults) {
      // キャッシュにない場合は実際に検索実行
      fromCache = false;
      
      // ファイル変更検知（将来の増分更新で使用予定）
      await searchEngine.detectChanges(directory);
      
      // 実際の検索を実行（最適化されたクエリを使用）
      const optimizedParams = { ...validatedParams, query: optimizedQuery };
      searchResults = await this.performActualSearch(optimizedParams);
      
      // 結果をキャッシュに保存
      if (searchResults && validatedParams.learn_patterns) {
        await searchEngine.cacheSearchResult(
          optimizedQuery,
          patternType,
          directory,
          searchResults
        );
      }
    }
    
    const executionTime = Date.now() - startTime;
    const resultCount = Array.isArray(searchResults) ? searchResults.length : 0;
    
    // 検索実行結果を学習データとして記録（実際に検索した場合のみ）
    if (!fromCache && validatedParams.learn_patterns) {
      await searchEngine.recordSearch({
        query: optimizedQuery,
        pattern_type: patternType,
        directory: directory,
        results_count: resultCount,
        success: true,
        timestamp: new Date(),
        response_time_ms: executionTime
      });
      
      // 自動でパターン更新も実行
      searchEngine.learnSearchPatterns();
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
            optimizationApplied: optimizedQuery !== validatedParams.query,
            originalQuery: validatedParams.query,
            optimizedQuery: optimizedQuery !== validatedParams.query ? optimizedQuery : undefined,
            optimizationSuggestions: optimizationSuggestions.length > 0 ? optimizationSuggestions : undefined,
            cacheHit: fromCache,
            searchType: fromCache ? 'cached' : 'full_scan'
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

// optimize_search_query機能は search_with_learning に統合されました





// ツールインスタンスのエクスポート
export const searchWithLearning = new SearchWithLearningTool();
