import { z } from 'zod';
import { WorkspaceConfig, WorkspaceSettings } from './types.js';

/**
 * ワークスペース設定のバリデーションスキーマ
 */
const workspaceSettingsSchema = z.object({
  index_enabled: z.boolean().default(true),
  lsp_servers: z.array(z.string()).default(['typescript']),
  auto_save_logs: z.boolean().default(true),
  log_retention_days: z.number().min(1).max(365).default(30),
  max_file_size: z.number().positive().default(1048576),
  excluded_patterns: z.array(z.string()).default(['*.env', '*.key', '*.pem', 'node_modules/**', '.git/**']),
  follow_symlinks: z.boolean().default(false),
});

const workspaceConfigSchema = z.object({
  name: z.string().min(1).max(100),
  root_path: z.string().min(1),
  created_at: z.string().datetime(),
  last_accessed: z.string().datetime(),
  settings: workspaceSettingsSchema,
});

/**
 * ワークスペース設定のバリデーター
 */
export class WorkspaceConfigValidator {
  /**
   * ワークスペース設定をバリデーション
   */
  static validateConfig(config: unknown): WorkspaceConfig {
    return workspaceConfigSchema.parse(config);
  }

  /**
   * ワークスペース設定のパーシャルバリデーション
   */
  static validatePartialSettings(settings: unknown): Partial<WorkspaceSettings> {
    return workspaceSettingsSchema.partial().parse(settings);
  }

  /**
   * ワークスペース名のバリデーション
   */
  static validateWorkspaceName(name: string): string {
    return z.string()
      .min(1, 'ワークスペース名は1文字以上である必要があります')
      .max(100, 'ワークスペース名は100文字以下である必要があります')
      .regex(/^[a-zA-Z0-9_-]+$/, 'ワークスペース名は英数字、アンダースコア、ハイフンのみ使用できます')
      .parse(name);
  }

  /**
   * ルートパスのバリデーション
   */
  static validateRootPath(path: string): string {
    const trimmedPath = path.trim();
    
    if (!trimmedPath || trimmedPath.length === 0) {
      throw new Error('ルートパスが指定されていません');
    }
    
    // 相対パスや危険なパスの検証
    if (trimmedPath.includes('..') || trimmedPath.includes('~')) {
      throw new Error('相対パスや~記法は使用できません');
    }
    
    // 絶対パスかどうかを確認（Unix系では /、Windowsでは C:\ など）
    const isAbsolute = trimmedPath.startsWith('/') || /^[A-Za-z]:\\/.test(trimmedPath);
    if (!isAbsolute) {
      throw new Error('絶対パスを指定してください');
    }
    
    return trimmedPath;
  }

  /**
   * デフォルト設定の生成
   */
  static createDefaultSettings(): WorkspaceSettings {
    return {
      index_enabled: true,
      lsp_servers: ['typescript'],
      auto_save_logs: true,
      log_retention_days: 30,
      max_file_size: 1048576, // 1MB
      excluded_patterns: ['*.env', '*.key', '*.pem', 'node_modules/**', '.git/**'],
      follow_symlinks: false,
    };
  }

  /**
   * デフォルト設定をマージ
   */
  static mergeWithDefaults(settings: Partial<WorkspaceSettings>): WorkspaceSettings {
    const defaults = this.createDefaultSettings();
    return {
      ...defaults,
      ...settings,
    };
  }
}