/**
 * プロジェクト知識読み取りツール
 * 保存されたプロジェクト固有の知識・設計情報を取得
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { ProjectMemoryService } from '../../services/project-memory.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { LogManager } from '../../utils/log-manager.js';

const ProjectMemoryReadSchema = z.object({
  memory_name: z.string().min(1).describe('Name of the memory to read')
});

type ProjectMemoryReadParams = z.infer<typeof ProjectMemoryReadSchema>;

/**
 * プロジェクト知識読み取りツール
 */
export class ProjectMemoryReadTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'project_memory_read',
    description: '保存されたプロジェクト固有の知識・設計情報を取得',
    parameters: {
      memory_name: {
        type: 'string',
        description: 'Name of the memory to read',
        required: true
      }
    }
  };

  protected readonly schema = ProjectMemoryReadSchema;

  protected async executeInternal(_validatedParameters: unknown): Promise<IToolResult> {
    const params = _validatedParameters as ProjectMemoryReadParams;
    const { memory_name } = params;

    this.logger.info(`Reading project memory: ${memory_name}`);

    // ワークスペースの取得
    const workspaceManager = WorkspaceManager.getInstance();
    const currentWorkspace = await workspaceManager.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
    }

    // プロジェクトメモリサービスを初期化
    const memoryService = new ProjectMemoryService(currentWorkspace.root_path, this.logger);

    // メモリを読み取り
    const memoryEntry = await memoryService.readMemory(memory_name);

    this.logger.info(`Project memory read successfully: ${memory_name}`, {
      contentLength: memoryEntry.content.length,
      tagsCount: memoryEntry.metadata.tags.length,
      lastUpdated: memoryEntry.metadata.updatedAt
    });

    const response = {
      success: true,
      memory_name: memoryEntry.metadata.name,
      content: memoryEntry.content,
      metadata: {
        created_at: memoryEntry.metadata.createdAt,
        updated_at: memoryEntry.metadata.updatedAt,
        size: memoryEntry.metadata.size,
        tags: memoryEntry.metadata.tags,
        checksum: memoryEntry.metadata.checksum
      },
      workspace: {
        name: currentWorkspace.name,
        root_path: currentWorkspace.root_path
      }
    };

    // 操作ログ記録
    const logManager = LogManager.getInstance();
    await logManager.logOperation(
      'PROJECT_MEMORY_READ',
      null,
      `Memory "${memoryEntry.metadata.name}" read | Size: ${memoryEntry.metadata.size} bytes | Tags: ${memoryEntry.metadata.tags?.join(', ') || 'none'}`
    );

    return this.createTextResult(JSON.stringify(response, null, 2));
  }
}