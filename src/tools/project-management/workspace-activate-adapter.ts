import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { workspaceActivateTool, WorkspaceActivateInput } from './workspace-activate.js';

/**
 * ワークスペース活性化ツールのアダプター（ITool互換）
 */
export class WorkspaceActivateTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'workspace_activate',
    description: 'ワークスペースを活性化し、プロジェクト管理を開始します',
    parameters: {
      workspace_path: {
        type: 'string',
        description: 'ワークスペースのルートディレクトリパス',
        required: true,
      },
      name: {
        type: 'string',
        description: 'ワークスペース名（オプション、未指定時はディレクトリ名から自動生成）',
        required: false,
      },
      index_enabled: {
        type: 'boolean',
        description: 'インデックス機能を有効にするか（デフォルト: true）',
        required: false,
      },
      lsp_servers: {
        type: 'array',
        description: '使用するLSPサーバーのリスト（デフォルト: ["typescript", "python"]）',
        required: false,
      },
      auto_save_logs: {
        type: 'boolean',
        description: 'ログの自動保存を有効にするか（デフォルト: true）',
        required: false,
      },
      log_retention_days: {
        type: 'number',
        description: 'ログの保持日数（デフォルト: 30）',
        required: false,
      },
    },
  };

  protected readonly schema = z.object({
    workspace_path: z.string().min(1, 'workspace_pathは必須です'),
    name: z.string().optional(),
    index_enabled: z.boolean().optional(),
    lsp_servers: z.array(z.string()).optional(),
    auto_save_logs: z.boolean().optional(),
    log_retention_days: z.number().positive().optional(),
  });

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as WorkspaceActivateInput;
    
    try {
      const result = await workspaceActivateTool.execute(params);
      
      return this.createTextResult(JSON.stringify({
        success: result.success,
        workspace: {
          name: result.workspace.name,
          root_path: result.workspace.root_path,
          status: result.workspace.status,
          settings: result.workspace.settings,
          file_count: result.workspace.file_count,
          total_size: result.workspace.total_size,
        },
        message: result.message,
      }, null, 2));
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}