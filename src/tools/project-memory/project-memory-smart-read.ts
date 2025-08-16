/**
 * プロジェクト知識スマート読み取りツール
 * ファイル名から内容を推測してAIが自動的に最適なメモリを検索・取得
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { ProjectMemoryService } from '../../services/project-memory.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { LogManager } from '../../utils/log-manager.js';

const ProjectMemorySmartReadSchema = z.object({
  query: z.string().min(1).describe('What information are you looking for?'),
  max_results: z.number().min(1).max(10).default(3).describe('Maximum number of memory files to return'),
  include_content: z.boolean().default(true).describe('Whether to include full content or just metadata')
});

type ProjectMemorySmartReadParams = z.infer<typeof ProjectMemorySmartReadSchema>;

interface MemoryMatch {
  filename: string;
  relevance_score: number;
  reason: string;
  content?: string;
  metadata: {
    size: number;
    tags: string[];
    created_at: string;
    updated_at: string;
  };
}

/**
 * プロジェクト知識スマート読み取りツール
 */
export class ProjectMemorySmartReadTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'project_memory_smart_read',
    description: 'AI駆動のプロジェクト知識検索。ファイル名から内容を推測して最適なメモリを自動検索・取得',
    parameters: {
      query: {
        type: 'string',
        description: 'What information are you looking for?',
        required: true
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of memory files to return (1-10)',
        required: false
      },
      include_content: {
        type: 'boolean',
        description: 'Whether to include full content or just metadata',
        required: false
      }
    }
  };

  protected readonly schema = ProjectMemorySmartReadSchema;

  protected async executeInternal(_validatedParameters: unknown): Promise<IToolResult> {
    const params = _validatedParameters as ProjectMemorySmartReadParams;
    const { query, max_results, include_content } = params;

    this.logger.info(`Smart reading project memory with query: "${query}"`);

    const workspaceManager = WorkspaceManager.getInstance();
    const currentWorkspace = await workspaceManager.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
    }

    const memoryService = new ProjectMemoryService(currentWorkspace.root_path, this.logger);
    const memoryList = await memoryService.listMemories();

    if (memoryList.memories.length === 0) {
      return this.createTextResult(JSON.stringify({
        success: true,
        query: query,
        matches: [],
        message: 'No project memories found in the workspace.'
      }, null, 2));
    }

    const matches: MemoryMatch[] = [];

    for (const memory of memoryList.memories) {
      const score = this.calculateRelevanceScore(query, memory.name);
      if (score > 0) {
        const match: MemoryMatch = {
          filename: memory.name,
          relevance_score: score,
          reason: this.generateReasoningText(query, memory.name, score),
          metadata: {
            size: memory.size,
            tags: memory.tags || [],
            created_at: memory.createdAt,
            updated_at: memory.updatedAt
          }
        };

        if (include_content) {
          try {
            const memoryEntry = await memoryService.readMemory(memory.name);
            match.content = memoryEntry.content;
          } catch (error) {
            this.logger.warn(`Failed to read content for ${memory.name}: ${error}`);
            match.content = '<Failed to read content>';
          }
        }

        matches.push(match);
      }
    }

    matches.sort((a, b) => b.relevance_score - a.relevance_score);
    const topMatches = matches.slice(0, max_results);

    this.logger.info(`Smart read completed: ${topMatches.length} matches found for query "${query}"`);

    const response = {
      success: true,
      query: query,
      total_available: memoryList.memories.length,
      matches_found: matches.length,
      returned_matches: topMatches.length,
      matches: topMatches,
      workspace: {
        name: currentWorkspace.name,
        root_path: currentWorkspace.root_path
      }
    };

    const logManager = LogManager.getInstance();
    await logManager.logOperation(
      'PROJECT_MEMORY_SMART_READ',
      null,
      `Smart query: "${query}" | Found: ${topMatches.length}/${matches.length} matches | Files: ${topMatches.map(m => m.filename).join(', ')}`
    );

    return this.createTextResult(JSON.stringify(response, null, 2));
  }

  private calculateRelevanceScore(query: string, filename: string): number {
    const normalizedQuery = query.toLowerCase();
    const normalizedFilename = filename.toLowerCase();

    let score = 0;

    // セルフドキュメンティング型ファイル名の構造を解析
    // {project-name}-{category}-{detail}-{version}-{context}
    const filenameParts = normalizedFilename.split('-');
    
    // 1. 直接キーワードマッチ（最高優先度）
    const queryWords = normalizedQuery.split(/\s+/);
    for (const word of queryWords) {
      if (normalizedFilename.includes(word)) {
        // カテゴリ部分でのマッチは高得点
        if (filenameParts.length >= 2 && filenameParts[1].includes(word)) {
          score += 40; // カテゴリマッチは高得点
        } else if (filenameParts.length >= 3 && filenameParts[2].includes(word)) {
          score += 35; // 詳細部分のマッチ
        } else {
          score += 30; // 一般的なマッチ
        }
      }
    }

    // 2. フレーズ全体でのマッチ
    if (normalizedFilename.includes(normalizedQuery)) {
      score += 25;
    }

    // 3. カテゴリ特化スコアリング
    const categoryScore = this.calculateCategoryScore(normalizedQuery, filenameParts);
    score += categoryScore;

    // 4. 関連語彙マッチング（拡張）
    const relatedTerms = this.getRelatedTerms(normalizedQuery);
    for (const term of relatedTerms) {
      if (normalizedFilename.includes(term)) {
        score += 10;
      }
    }

    // 5. プロジェクト固有ターム
    if (normalizedFilename.includes('effortlessly-mcp')) {
      score += 5;
    }

    // 6. バージョン情報ボーナス（新しいバージョンを優先）
    if (normalizedFilename.includes('v1.0.14')) {
      score += 3;
    }

    return Math.min(score, 100);
  }

  /**
   * カテゴリ特化スコアリング
   */
  private calculateCategoryScore(query: string, filenameParts: string[]): number {
    if (filenameParts.length < 2) return 0;

    const category = filenameParts[1]; // カテゴリ部分
    const detail = filenameParts.length >= 3 ? filenameParts[2] : '';

    // クエリとカテゴリのマッピング
    const categoryMapping: Record<string, string[]> = {
      'architecture': ['architecture', 'design', 'structure', 'system'],
      'dependencies': ['dependencies', 'dependency', 'libs', 'packages'],
      'tech-stack': ['tech', 'technology', 'stack', 'tools'],
      'development': ['development', 'dev', 'environment', 'setup'],
      'test': ['test', 'testing', 'verification', 'validation'],
      'integration': ['integration', 'lsp', 'api', 'external'],
      'navigation': ['navigation', 'index', 'meta', 'overview'],
      'structure': ['structure', 'organization', 'layout', 'hierarchy'],
      'security': ['security', 'auth', 'audit', 'permission'],
      'data': ['data', 'storage', 'database', 'persistence']
    };

    let categoryScore = 0;
    const normalizedQuery = query.toLowerCase();

    // カテゴリ直接マッチ
    if (normalizedQuery.includes(category)) {
      categoryScore += 20;
    }

    // カテゴリ関連語マッチ
    const relatedCategories = categoryMapping[category] || [];
    for (const related of relatedCategories) {
      if (normalizedQuery.includes(related)) {
        categoryScore += 15;
        break; // 1つマッチすれば十分
      }
    }

    // 詳細部分マッチ
    if (detail && normalizedQuery.includes(detail.replace(/-/g, ' '))) {
      categoryScore += 10;
    }

    return categoryScore;
  }

  private getRelatedTerms(query: string): string[] {
    const relatedTermsMap: Record<string, string[]> = {
      'architecture': ['structure', 'design', 'component', 'system', 'pattern', 'framework'],
      'lsp': ['language', 'server', 'protocol', 'integration', 'typescript', 'swift'],
      'tech': ['technology', 'stack', 'dependency', 'library', 'framework', 'tools'],
      'structure': ['architecture', 'organization', 'layout', 'hierarchy', 'modules'],
      'test': ['verification', 'validation', 'check', 'testing', 'qa', 'quality'],
      'initialization': ['startup', 'setup', 'init', 'bootstrap', 'config'],
      'dependencies': ['deps', 'libs', 'packages', 'modules', 'imports'],
      'development': ['dev', 'environment', 'setup', 'context', 'workspace'],
      'navigation': ['index', 'meta', 'overview', 'guide', 'map'],
      'integration': ['api', 'external', 'connector', 'bridge', 'interface'],
      'security': ['auth', 'audit', 'permission', 'access', 'safety'],
      'data': ['storage', 'database', 'persistence', 'management', 'models'],
      'audit': ['review', 'analysis', 'assessment', 'evaluation', 'report'],
      'overview': ['summary', 'index', 'guide', 'introduction', 'outline'],
      'implementation': ['code', 'execution', 'runtime', 'practice', 'build'],
      'comprehensive': ['complete', 'full', 'detailed', 'thorough', 'extensive']
    };

    const terms: string[] = [];
    for (const [key, values] of Object.entries(relatedTermsMap)) {
      if (query.toLowerCase().includes(key)) {
        terms.push(...values);
      }
    }

    return terms;
  }

  private generateReasoningText(query: string, _filename: string, score: number): string {
    if (score >= 50) {
      return `High relevance: Filename strongly suggests content related to "${query}"`;
    } else if (score >= 25) {
      return `Medium relevance: Filename likely contains information about "${query}"`;
    } else if (score > 0) {
      return `Low relevance: Filename may contain some information related to "${query}"`;
    }
    return 'No clear relevance detected';
  }
}