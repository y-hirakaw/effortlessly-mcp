// プロジェクト管理ツールのエクスポート
export { WorkspaceManager } from './workspace-manager.js';
export { WorkspaceConfigValidator } from './workspace-config.js';

// ツールの実装（関数版）
export { workspaceActivateTool } from './workspace-activate.js';
export { workspaceGetInfoTool } from './workspace-get-info.js';
export { workspaceListAllTool } from './workspace-list-all.js';

// ツールアダプター（ITool互換クラス版）
export { WorkspaceActivateTool } from './workspace-activate-adapter.js';
export { WorkspaceGetInfoTool } from './workspace-get-info-adapter.js';
export { WorkspaceListAllTool } from './workspace-list-all-adapter.js';

// 型定義
export type { 
  WorkspaceConfig, 
  WorkspaceSettings, 
  WorkspaceInfo,
  WorkspaceListItem,
  WorkspaceActivationResult,
  WorkspaceCreateOptions
} from './types.js';

export type { WorkspaceActivateInput } from './workspace-activate.js';
export type { WorkspaceInfoResult } from './workspace-get-info.js';
export type { WorkspaceListResult } from './workspace-list-all.js';