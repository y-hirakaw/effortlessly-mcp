/**
 * プロジェクト知識一覧ツール
 * 保存されたプロジェクト知識の一覧とメタデータを取得
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { IToolMetadata, IToolResult } from '../types/common.js';
import { ProjectMemoryService } from '../services/project-memory.js';
import { WorkspaceManager } from './project-management/workspace-manager.js';

const ProjectMemoryListSchema = z.object({
  filter_tags: z.array(z.string()).optional().describe('Filter memories by tags'),
  include_statistics: z.boolean().optional().default(false).describe('Include detailed statistics')
});

type ProjectMemoryListParams = z.infer<typeof ProjectMemoryListSchema>;

/**
 * プロジェクト知識一覧ツール
 */
export class ProjectMemoryListTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'project_memory_list',
    description: '保存されたプロジェクト知識の一覧とメタデータを取得',
    parameters: {
      filter_tags: {
        type: 'array',
        description: 'Filter memories by tags',
        required: false
      },
      include_statistics: {
        type: 'boolean',
        description: 'Include detailed statistics',
        required: false
      }
    }
  };

  protected readonly schema = ProjectMemoryListSchema;

  protected async executeInternal(_validatedParameters: unknown): Promise<IToolResult> {
    const params = _validatedParameters as ProjectMemoryListParams;
    const { filter_tags, include_statistics } = params;

    this.logger.info('Listing project memories', {
      filterTags: filter_tags?.join(', ') || 'none',
      includeStatistics: include_statistics
    });

    // ワークスペースの取得
    const workspaceManager = WorkspaceManager.getInstance();
    const currentWorkspace = await workspaceManager.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
    }

    // プロジェクトメモリサービスを初期化
    const memoryService = new ProjectMemoryService(currentWorkspace.root_path, this.logger);

    // メモリ一覧を取得
    const listResult = await memoryService.listMemories(filter_tags);

    // 統計情報を取得（必要な場合）
    let statistics = null;
    if (include_statistics) {
      statistics = await memoryService.getMemoryStatistics();
    }

    this.logger.info(`Project memories listed: ${listResult.filteredCount}/${listResult.totalCount}`, {
      filterTags: filter_tags?.join(', ') || 'none',
      totalTags: listResult.tags.length
    });

    // レスポンス構築
    const response: any = {
      success: true,
      memories: listResult.memories.map(memory => ({
        name: memory.name,
        created_at: memory.createdAt,
        updated_at: memory.updatedAt,
        size: memory.size,
        tags: memory.tags,
        checksum: memory.checksum
      })),
      summary: {
        total_count: listResult.totalCount,
        filtered_count: listResult.filteredCount,
        available_tags: listResult.tags
      },
      filter: {
        tags: filter_tags || []
      },
      workspace: {
        name: currentWorkspace.name,
        root_path: currentWorkspace.root_path
      }
    };

    // 統計情報を追加（必要な場合）
    if (statistics) {
      response.statistics = {
        total_memories: statistics.totalMemories,
        total_size: statistics.totalSize,
        average_size: statistics.averageSize,
        tag_count: statistics.tagCount,
        oldest_memory: statistics.oldestMemory ? {
          name: statistics.oldestMemory.name,
          created_at: statistics.oldestMemory.createdAt
        } : null,
        newest_memory: statistics.newestMemory ? {
          name: statistics.newestMemory.name,
          created_at: statistics.newestMemory.createdAt
        } : null,
        tag_distribution: statistics.tagDistribution
      };
    }

    return this.createTextResult(JSON.stringify(response, null, 2));
  }
}