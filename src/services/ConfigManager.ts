import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { FileSystemService } from './FileSystemService.js';
import { Logger } from './logger.js';
import { WorkspaceConfig } from '../tools/project-management/types.js';

/**
 * 統合設定管理
 * config.yamlの読み書きを一元管理
 */
export interface IntegratedConfig {
  logging: {
    operations: {
      enabled: boolean;
    };
    diff: {
      enabled: boolean;
      max_lines_for_detailed_diff: number;
      display_options: {
        default_context_lines: number;
      };
    };
  };
  workspaces: {
    current: string | null;
    configurations: Record<string, WorkspaceConfig>;
  };
  lsp_servers: {
    proxy_server: {
      enabled: boolean;
      host: string;
      port: number;
      auto_start: boolean;
      startup_timeout: number;
    };
    supported_languages: Record<string, {
      enabled: boolean;
      server_command: string;
      server_args: string[];
    }>;
  };

}

export class ConfigManager {
  private readonly logger = Logger.getInstance();
  private readonly configPath: string;
  private config: IntegratedConfig | null = null;

  constructor() {
    this.configPath = path.join(os.homedir(), '.claude', 'workspace', 'effortlessly', 'config.yaml');
  }

  /**
   * 設定ファイルを読み込み
   */
  async loadConfig(): Promise<IntegratedConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const fsService = FileSystemService.getInstance();
      const content = await fsService.readFile(this.configPath, { encoding: 'utf8' });
      const data = yaml.load(content as string) as IntegratedConfig;
      
      // デフォルト値でマージ
      this.config = this.mergeWithDefaults(data);
      
      this.logger.debug('Config loaded successfully', { path: this.configPath });
      return this.config;
    } catch (error) {
      this.logger.warn('Failed to load config, using defaults', { error: (error as Error).message });
      this.config = this.createDefaultConfig();
      return this.config;
    }
  }

  /**
   * 設定ファイルを保存
   */
  async saveConfig(config?: IntegratedConfig): Promise<void> {
    const configToSave = config || this.config;
    if (!configToSave) {
      throw new Error('No config to save');
    }

    const yamlContent = yaml.dump(configToSave, {
      indent: 2,
      lineWidth: -1,
    });

    const fsService = FileSystemService.getInstance();
    await fsService.writeFile(this.configPath, yamlContent, { encoding: 'utf8' });
    
    this.config = configToSave;
    this.logger.debug('Config saved successfully', { path: this.configPath });
  }

  /**
   * ワークスペース設定を追加/更新
   */
  async setWorkspaceConfig(name: string, workspaceConfig: WorkspaceConfig): Promise<void> {
    const config = await this.loadConfig();
    config.workspaces.configurations[name] = workspaceConfig;
    config.workspaces.current = name;
    await this.saveConfig(config);
    
    // ワークスペース固有のconfig.yamlも作成
    await this.createWorkspaceConfigFile(name, workspaceConfig);
  }

  /**
   * ワークスペース固有のconfig.yamlファイルを作成
   */
  private async createWorkspaceConfigFile(_name: string, workspaceConfig: WorkspaceConfig): Promise<void> {
    const workspaceConfigPath = path.join(
      workspaceConfig.root_path,
      '.claude',
      'workspace',
      'effortlessly',
      'config.yaml'
    );

    // ワークスペース固有の設定構造
    const workspaceSpecificConfig = {
      workspace: {
        name: workspaceConfig.name,
        root_path: workspaceConfig.root_path,
        created_at: workspaceConfig.created_at,
        last_accessed: workspaceConfig.last_accessed,
        settings: workspaceConfig.settings,
      },
      logging: {
        operations: {
          enabled: workspaceConfig.settings?.auto_save_logs ?? true,
        },
        diff: {
          enabled: true,
          max_lines_for_detailed_diff: 500,
          display_options: {
            default_context_lines: 3,
          },
        },
      },
      lsp_servers: {
        proxy_server: {
          enabled: true,
          host: 'localhost',
          port: 3001,
          auto_start: true,
          startup_timeout: 10000,
        },
        supported_languages: {
          typescript: {
            enabled: workspaceConfig.settings?.lsp_servers?.includes('typescript') ?? true,
            server_command: 'typescript-language-server',
            server_args: ['--stdio'],
          },
          python: {
            enabled: workspaceConfig.settings?.lsp_servers?.includes('python') ?? false,
            server_command: 'pylsp',
            server_args: [],
          },
          swift: {
            enabled: workspaceConfig.settings?.lsp_servers?.includes('swift') ?? false,
            server_command: 'sourcekit-lsp',
            server_args: [],
          },
        },
      },

    };

    try {
      this.logger.info(`Attempting to create config file at: ${workspaceConfigPath}`);
      
      // ディレクトリが存在しない場合は作成
      const configDir = path.dirname(workspaceConfigPath);
      const fsService = FileSystemService.getInstance();
      await fsService.mkdir(configDir, { recursive: true });
      
      const yamlContent = yaml.dump(workspaceSpecificConfig, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      this.logger.info(`YAML content generated, length: ${yamlContent.length}`);

      await fsService.writeFile(workspaceConfigPath, yamlContent);
      
      this.logger.info(`Workspace-specific config created successfully: ${workspaceConfigPath}`);
    } catch (error) {
      this.logger.error('Failed to create workspace-specific config file', {
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
        config_path: workspaceConfigPath,
      } as any);
      throw error;
    }
  }

  /**
   * 現在のワークスペース設定を取得
   */
  async getCurrentWorkspaceConfig(): Promise<WorkspaceConfig | null> {
    const config = await this.loadConfig();
    const currentName = config.workspaces.current;
    if (!currentName) {
      return null;
    }
    return config.workspaces.configurations[currentName] || null;
  }

  /**
   * LSPサーバー設定を取得
   */
  async getLSPServerConfig() {
    const config = await this.loadConfig();
    return config.lsp_servers;
  }



  /**
   * Get specific workspace configuration by name
   */
  async getWorkspaceConfig(name: string): Promise<WorkspaceConfig | null> {
    const config = await this.loadConfig();
    return config.workspaces.configurations[name] || null;
  }



  /**
   * デフォルト設定を作成
   */
  private createDefaultConfig(): IntegratedConfig {
    return {
      logging: {
        operations: {
          enabled: true,
        },
        diff: {
          enabled: true,
          max_lines_for_detailed_diff: 500,
          display_options: {
            default_context_lines: 3,
          },
        },
      },
      workspaces: {
        current: null,
        configurations: {},
      },
      lsp_servers: {
        proxy_server: {
          enabled: true,
          host: 'localhost',
          port: 3001,
          auto_start: true,
          startup_timeout: 10000,
        },
        supported_languages: {
          typescript: {
            enabled: true,
            server_command: 'typescript-language-server',
            server_args: ['--stdio'],
          },
          python: {
            enabled: true,
            server_command: 'pylsp',
            server_args: [],
          },
          swift: {
            enabled: true,
            server_command: 'sourcekit-lsp',
            server_args: [],
          },
        },
      },

    };
  }

  /**
   * デフォルト値とマージ
   */
  private mergeWithDefaults(config: Partial<IntegratedConfig>): IntegratedConfig {
    const defaults = this.createDefaultConfig();
    return {
      logging: { ...defaults.logging, ...config.logging },
      workspaces: { 
        current: config.workspaces?.current || defaults.workspaces.current,
        configurations: { ...defaults.workspaces.configurations, ...config.workspaces?.configurations },
      },
      lsp_servers: { ...defaults.lsp_servers, ...config.lsp_servers },

    };
  }
}
