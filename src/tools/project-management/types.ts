/**
 * ワークスペース設定の型定義
 */
export interface WorkspaceConfig {
  name: string;
  root_path: string;
  created_at: string;
  last_accessed: string;
  settings: WorkspaceSettings;
}

/**
 * ワークスペース設定オプション
 */
export interface WorkspaceSettings {
  index_enabled: boolean;
  lsp_servers: string[];
  auto_save_logs: boolean;
  log_retention_days: number;
  max_file_size?: number;
  excluded_patterns?: string[];
  follow_symlinks?: boolean;
}

/**
 * ワークスペース情報（実行時情報を含む）
 */
export interface WorkspaceInfo extends WorkspaceConfig {
  status: 'active' | 'inactive';
  file_count?: number;
  total_size?: number;
  last_indexed?: string;
}

/**
 * ワークスペース一覧用の簡略情報
 */
export interface WorkspaceListItem {
  name: string;
  root_path: string;
  status: 'active' | 'inactive';
  last_accessed: string;
  file_count?: number;
}

/**
 * ワークスペース活性化の結果
 */
export interface WorkspaceActivationResult {
  success: boolean;
  workspace: WorkspaceInfo;
  message?: string;
  warnings?: string[];
}

/**
 * ワークスペース作成時のオプション
 */
export interface WorkspaceCreateOptions {
  name?: string;
  settings?: Partial<WorkspaceSettings>;
}