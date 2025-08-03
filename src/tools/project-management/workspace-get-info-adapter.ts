import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { workspaceGetInfoTool } from './workspace-get-info.js';

/**
 * ワークスペース情報取得ツールのアダプター（ITool互換）
 */
export class WorkspaceGetInfoTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'workspace_get_info',
    description: '現在アクティブなワークスペースの情報を取得します',
    parameters: {},
  };

  protected readonly schema = z.object({});

  protected async executeInternal(): Promise<IToolResult> {
    try {
      const result = await workspaceGetInfoTool.execute();
      
      return this.createTextResult(JSON.stringify({
        hasActiveWorkspace: result.hasActiveWorkspace,
        workspace: result.workspace ? {
          name: result.workspace.name,
          root_path: result.workspace.root_path,
          status: result.workspace.status,
          created_at: result.workspace.created_at,
          last_accessed: result.workspace.last_accessed,
          settings: result.workspace.settings,
          file_count: result.workspace.file_count,
          total_size: result.workspace.total_size,
        } : undefined,
        message: result.message,
      }, null, 2));
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}