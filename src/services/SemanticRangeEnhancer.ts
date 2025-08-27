import { DirectMiniLMEmbeddings } from './DirectMiniLMEmbeddings.js';
import { OptimalRange, Intent } from './SmartRangeOptimizer.js';
import { Logger } from './logger.js';

const logger = Logger.getInstance();

/**
 * SmartRangeOptimizerにセマンティック検索機能を追加するエンハンサー
 */
export class SemanticRangeEnhancer {
  private embeddings: DirectMiniLMEmbeddings | null = null;
  private initialized = false;
  
  async initialize(): Promise<void> {
    try {
      this.embeddings = new DirectMiniLMEmbeddings();
      await this.embeddings.initialize();
      this.initialized = true;
      logger.info('SemanticRangeEnhancer initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`SemanticRangeEnhancer initialization failed, falling back to pattern-only mode: ${errorMessage}`);
      // 初期化失敗はセマンティック検索なしで継続
      this.initialized = false;
    }
  }
  
  /**
   * セマンティック検索でコードブロック範囲を検出
   */
  async detectSemanticRanges(
    lines: string[],
    intent: Intent,
    semanticQueries: string[] = [],
    maxRanges: number = 5
  ): Promise<OptimalRange[]> {
    
    if (!this.initialized || !this.embeddings) {
      logger.info('Semantic search not available, skipping');
      return [];
    }
    
    try {
      // 意図からクエリを自動生成
      const intentQueries = this.getIntentQueries(intent);
      const allQueries = [...semanticQueries, ...intentQueries];
      
      if (allQueries.length === 0) {
        return [];
      }
      
      // コードを意味のあるブロックに分割
      const codeBlocks = this.extractCodeBlocks(lines);
      
      if (codeBlocks.length === 0) {
        return [];
      }
      
      const ranges: OptimalRange[] = [];
      
      // 各クエリでセマンティック検索実行
      for (const query of allQueries) {
        const matches = await this.embeddings.findSemanticMatches(
          codeBlocks.map(block => block.content),
          query,
          0.6  // 閾値をやや低めに設定
        );
        
        matches.forEach(match => {
          const block = codeBlocks[match.index];
          ranges.push({
            start: block.startLine + 1,
            end: block.endLine + 1,
            label: `セマンティック一致: "${this.truncateQuery(query)}"`,
            relevance: match.score,
            reason: `自然言語クエリ「${query}」との意味的類似度: ${match.score.toFixed(3)}`
          });
        });
      }
      
      // 重複除去と上位選択
      const uniqueRanges = this.deduplicateRanges(ranges);
      const sortedRanges = uniqueRanges
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, maxRanges);
      
      logger.info('Semantic range detection completed', {
        totalQueries: allQueries.length,
        codeBlocks: codeBlocks.length,
        foundRanges: sortedRanges.length
      });
      
      return sortedRanges;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Semantic range detection failed: ${errorMessage}`);
      return [];
    }
  }
  
  /**
   * 意図から自動的にセマンティッククエリを生成
   */
  private getIntentQueries(intent: Intent): string[] {
    const queryMap: Record<Intent, string[]> = {
      bug_investigation: [
        'error handling and exception processing',
        'validation and input checking logic',
        'null reference and undefined value checks',
        'debugging and error reporting code'
      ],
      code_review: [
        'class design and method implementation',
        'interface definitions and architecture',
        'algorithm implementation and logic',
        'performance critical code sections'
      ],
      feature_addition: [
        'existing interfaces and API definitions',
        'similar feature implementations',
        'import statements and dependencies',
        'configuration and setup code'
      ],
      refactoring: [
        'complex methods that need simplification',
        'duplicate code patterns',
        'class structure and inheritance',
        'coupling and dependency management'
      ],
      documentation: [
        'public interfaces and API methods',
        'configuration and setup instructions',
        'usage examples and code samples',
        'important architectural decisions'
      ],
      testing: [
        'test cases and testing patterns',
        'mock objects and test utilities',
        'assertion logic and validations',
        'test setup and teardown code'
      ],
      general: [
        'main functionality and core logic',
        'important class and method definitions',
        'configuration and initialization code'
      ]
    };
    
    return queryMap[intent] || [];
  }
  
  /**
   * コードを意味のあるブロックに分割
   */
  private extractCodeBlocks(lines: string[]): Array<{content: string, startLine: number, endLine: number}> {
    const blocks: Array<{content: string, startLine: number, endLine: number}> = [];
    let currentBlock: string[] = [];
    let blockStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 空行やコメント行でブロック分割
      if (line === '' || line.startsWith('//') || line.startsWith('/*')) {
        if (currentBlock.length > 0) {
          blocks.push({
            content: currentBlock.join('\n'),
            startLine: blockStart,
            endLine: i - 1
          });
          currentBlock = [];
        }
        blockStart = i + 1;
      } else {
        currentBlock.push(lines[i]);
      }
    }
    
    // 最後のブロック
    if (currentBlock.length > 0) {
      blocks.push({
        content: currentBlock.join('\n'),
        startLine: blockStart,
        endLine: lines.length - 1
      });
    }
    
    // 短いブロック（3行未満）を除外
    return blocks.filter(block => 
      block.endLine - block.startLine >= 2 && 
      block.content.length > 50  // 最小文字数
    );
  }
  
  /**
   * 重複する範囲を統合
   */
  private deduplicateRanges(ranges: OptimalRange[]): OptimalRange[] {
    const uniqueRanges: OptimalRange[] = [];
    
    for (const range of ranges) {
      const overlapping = uniqueRanges.find(existing => 
        (range.start <= existing.end && range.end >= existing.start)
      );
      
      if (overlapping) {
        // より高い関連性を持つ方を採用
        if (range.relevance > overlapping.relevance) {
          const index = uniqueRanges.indexOf(overlapping);
          uniqueRanges[index] = range;
        }
      } else {
        uniqueRanges.push(range);
      }
    }
    
    return uniqueRanges;
  }
  
  /**
   * クエリ文字列を表示用に短縮
   */
  private truncateQuery(query: string, maxLength: number = 30): string {
    return query.length > maxLength ? query.substring(0, maxLength) + '...' : query;
  }
  
  /**
   * 初期化状態確認
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * リソースクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.embeddings) {
      await this.embeddings.cleanup();
      this.embeddings = null;
    }
    this.initialized = false;
  }
}