import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import { ToolExecutionError } from '../../types/errors.js';
import { WorkspaceManager } from './workspace-manager.js';
import { WorkspaceListItem } from './types.js';

/**
 * ワークスペース一覧取得の結果
 */
export interface WorkspaceListResult {
  workspaces: WorkspaceListItem[];
  total: number;
  activeWorkspace?: string;
  message: string;
}

/**
 * ワークスペース一覧取得ツール
 * 登録済みのすべてのワークスペースを一覧表示する
 */
export const workspaceListAllTool = {
  metadata: {
    name: 'workspace_list_all',
    description: '登録済みのすべてのワークスペースを一覧表示します',
    parameters: {},
  },

  /**
   * ワークスペース一覧を取得
   */
  async execute(): Promise<WorkspaceListResult> {
    const logger = Logger.getInstance();
    
    logger.info('Getting workspace list');

    try {
      // ワークスペースマネージャーを取得
      const workspaceManager = WorkspaceManager.getInstance();

      // ワークスペース一覧を取得
      const workspaces = await workspaceManager.listWorkspaces();

      // 現在のアクティブワークスペースを取得
      const currentWorkspace = await workspaceManager.getCurrentWorkspace();
      const activeWorkspace = currentWorkspace?.name;

      logger.info('Workspace list retrieved', {
        total: workspaces.length,
        active_workspace: activeWorkspace,
        workspaces: workspaces.map(w => ({
          name: w.name,
          path: w.root_path,
          status: w.status,
        })),
      });

      let message: string;
      if (workspaces.length === 0) {
        message = '登録されているワークスペースがありません';
      } else if (workspaces.length === 1) {
        message = '1つのワークスペースが登録されています';
      } else {
        message = `${workspaces.length}個のワークスペースが登録されています`;
      }

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logOperation(
        'WORKSPACE_LIST_ALL',
        null,
        `Listed ${workspaces.length} workspaces${activeWorkspace ? ` (active: ${activeWorkspace})` : ''}`
      );

      return {
        workspaces,
        total: workspaces.length,
        activeWorkspace,
        message,
      };
    } catch (error) {
      logger.error('Failed to get workspace list', {
        error_message: error instanceof Error ? error.message : String(error),
      } as any);
      
      throw new ToolExecutionError(`ワークスペース一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  },
};

