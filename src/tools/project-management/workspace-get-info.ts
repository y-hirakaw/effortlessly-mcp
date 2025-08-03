import { Logger } from '../../services/logger.js';
import { ToolExecutionError } from '../../types/errors.js';
import { WorkspaceManager } from './workspace-manager.js';
import { WorkspaceInfo } from './types.js';

/**
 * ワークスペース情報取得の結果
 */
export interface WorkspaceInfoResult {
  hasActiveWorkspace: boolean;
  workspace?: WorkspaceInfo;
  message: string;
}

/**
 * ワークスペース情報取得ツール
 * 現在アクティブなワークスペースの情報を取得する
 */
export const workspaceGetInfoTool = {
  metadata: {
    name: 'workspace_get_info',
    description: '現在アクティブなワークスペースの情報を取得します',
    parameters: {},
  },

  /**
   * 現在のワークスペース情報を取得
   */
  async execute(): Promise<WorkspaceInfoResult> {
    const logger = Logger.getInstance();
    
    logger.info('Getting current workspace info');

    try {
      // ワークスペースマネージャーを取得
      const workspaceManager = WorkspaceManager.getInstance();

      // 現在のワークスペース情報を取得
      const workspace = await workspaceManager.getCurrentWorkspace();

      if (!workspace) {
        logger.info('No active workspace found');
        return {
          hasActiveWorkspace: false,
          message: 'アクティブなワークスペースがありません',
        };
      }

      logger.info('Current workspace info retrieved', {
        workspace_name: workspace.name,
        workspace_path: workspace.root_path,
        status: workspace.status,
        file_count: workspace.file_count,
      });

      return {
        hasActiveWorkspace: true,
        workspace,
        message: `アクティブなワークスペース: ${workspace.name}`,
      };
    } catch (error) {
      logger.error('Failed to get workspace info', {
        error_message: error instanceof Error ? error.message : String(error),
      } as any);
      
      throw new ToolExecutionError(`ワークスペース情報の取得に失敗しました: ${(error as Error).message}`);
    }
  },
};

