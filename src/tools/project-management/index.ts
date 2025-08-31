// プロジェクト管理ツールのエクスポート
export { WorkspaceManager } from './workspace-manager.js';
export { WorkspaceConfigValidator } from './workspace-config.js';

// ツールの実装（関数版）
export { workspaceSetupTool } from './workspace-setup.js';

// ツールアダプター（ITool互換クラス版）
export { WorkspaceSetupTool } from './workspace-setup-adapter.js';

// 型定義
export type { 
  WorkspaceConfig, 
  WorkspaceSettings, 
  WorkspaceInfo,
  WorkspaceListItem,
  WorkspaceActivationResult,
  WorkspaceCreateOptions
} from './types.js';

export type { WorkspaceSetupInput } from './workspace-setup.js';