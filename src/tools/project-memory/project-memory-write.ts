/**
 * プロジェクト知識保存ツール
 * プロジェクト固有の知識・設計情報を永続化
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { ProjectMemoryService } from '../../services/project-memory.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { LogManager } from '../../utils/log-manager.js';

const ProjectMemoryWriteSchema = z.object({
  memory_name: z.string().min(1).describe('Name of the memory to save'),
  content: z.string().min(1).describe('Content to store in the memory'),
  intent: z.string().optional().default('プロジェクト知識保存').describe('この操作を行う理由・目的'),
  tags: z.array(z.string()).optional().default([]).describe('Optional tags for categorization')
});

type ProjectMemoryWriteParams = z.infer<typeof ProjectMemoryWriteSchema>;

/**
 * プロジェクト知識保存ツール
 */
export class ProjectMemoryWriteTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'project_memory_write',
    description: 'プロジェクト固有の知識・設計情報を永続化',
    parameters: {
      memory_name: {
        type: 'string',
        description: 'Name of the memory to save',
        required: true
      },
      content: {
        type: 'string', 
        description: 'Content to store in the memory',
        required: true
      },
      intent: {
        type: 'string',
        description: 'この操作を行う理由・目的',
        required: false
      },
      tags: {
        type: 'array',
        description: 'Optional tags for categorization',
        required: false
      }
    }
  };

  protected readonly schema = ProjectMemoryWriteSchema;

  protected async executeInternal(_validatedParameters: unknown): Promise<IToolResult> {
    const params = _validatedParameters as ProjectMemoryWriteParams;
    const { memory_name, content, tags } = params;

    this.logger.info(`Saving project memory: ${memory_name}`, {
      contentLength: content.length,
      tagsCount: tags.length,
      tags: tags.join(', ')
    });

    // ワークスペースの取得
    const workspaceManager = WorkspaceManager.getInstance();
    const currentWorkspace = await workspaceManager.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
    }

    // プロジェクトメモリサービスを初期化
    const memoryService = new ProjectMemoryService(currentWorkspace.root_path, this.logger);

    // メモリを保存（新しいディレクトリ構造）
    const result = await memoryService.writeMemory(memory_name, content, tags);

    this.logger.info(`Project memory saved successfully: ${memory_name}`, {
      filePath: result.filePath,
      size: result.metadata.size
    });

    const response = {
      success: result.success,
      memory_name: result.metadata.name,
      file_path: result.filePath,
      metadata: {
        created_at: result.metadata.createdAt,
        updated_at: result.metadata.updatedAt,
        size: result.metadata.size,
        tags: result.metadata.tags,
        checksum: result.metadata.checksum
      },
      message: result.message,
      workspace: {
        name: currentWorkspace.name,
        root_path: currentWorkspace.root_path
      }
    };

    // 操作ログ記録
    const logManager = LogManager.getInstance();
    await logManager.logOperation(
      'PROJECT_MEMORY_WRITE',
      result.filePath,
      `Memory "${result.metadata.name}" written | Size: ${result.metadata.size} bytes | Tags: ${result.metadata.tags?.join(', ') || 'none'}`,
      this.metadata
    );

    console.log(`DEBUG: Final response.memory_name = "${response.memory_name}"`);
    const jsonString = JSON.stringify(response, null, 2);
    console.log(`DEBUG: JSON string contains memory_name:`, jsonString.includes(response.memory_name || ''));
    return this.createTextResult(jsonString);
  }
}