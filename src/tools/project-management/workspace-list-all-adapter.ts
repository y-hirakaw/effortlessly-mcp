import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { workspaceListAllTool } from './workspace-list-all.js';

/**
 * ワークスペース一覧取得ツールのアダプター（ITool互換）
 */
export class WorkspaceListAllTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'workspace_list_all',
    description: '登録済みのすべてのワークスペースを一覧表示します',
    parameters: {},
  };

  protected readonly schema = z.object({});

  protected async executeInternal(): Promise<IToolResult> {
    try {
      const result = await workspaceListAllTool.execute();
      
      return this.createTextResult(JSON.stringify({
        workspaces: result.workspaces.map(w => ({
          name: w.name,
          root_path: w.root_path,
          status: w.status,
          last_accessed: w.last_accessed,
          file_count: w.file_count,
        })),
        total: result.total,
        activeWorkspace: result.activeWorkspace,
        message: result.message,
      }, null, 2));
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}