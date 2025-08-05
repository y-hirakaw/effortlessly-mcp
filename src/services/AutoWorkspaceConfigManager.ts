import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as yaml from 'js-yaml'
import { Logger } from './logger.js'
import { 
  AutoWorkspaceConfig, 
  DEFAULT_AUTO_WORKSPACE_CONFIG,
  DEFAULT_DETECTION_RULES
} from '../types/auto-workspace-config.js'

export class AutoWorkspaceConfigManager {
  private static instance: AutoWorkspaceConfigManager
  private readonly logger = Logger.getInstance()
  private readonly configDir: string
  private readonly configPath: string
  private cachedConfig: AutoWorkspaceConfig | null = null

  private constructor() {
    this.configDir = path.join(os.homedir(), '.claude', 'workspace', 'effortlessly')
    this.configPath = path.join(this.configDir, 'auto-workspace.yaml')
  }

  static getInstance(): AutoWorkspaceConfigManager {
    if (!AutoWorkspaceConfigManager.instance) {
      AutoWorkspaceConfigManager.instance = new AutoWorkspaceConfigManager()
    }
    return AutoWorkspaceConfigManager.instance
  }

  async loadConfig(): Promise<AutoWorkspaceConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    try {
      await fs.access(this.configPath)
      const content = await fs.readFile(this.configPath, 'utf8')
      const data = yaml.load(content) as { auto_workspace?: Partial<AutoWorkspaceConfig> }
      
      this.cachedConfig = this.mergeWithDefaults(data.auto_workspace || {})
      this.logger.info('Auto workspace config loaded', { config_path: this.configPath })
      return this.cachedConfig

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.info('No auto workspace config found, using defaults')
        this.cachedConfig = { ...DEFAULT_AUTO_WORKSPACE_CONFIG }
        await this.createDefaultConfig()
        return this.cachedConfig
      }
      
      this.logger.error('Failed to load auto workspace config', { error_message: error instanceof Error ? error.message : String(error) } as any)
      throw error
    }
  }

  getDetectionRules() {
    return [...DEFAULT_DETECTION_RULES]
  }

  private async createDefaultConfig(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true })
      
      const content = yaml.dump({
        auto_workspace: DEFAULT_AUTO_WORKSPACE_CONFIG
      }, {
        indent: 2,
        lineWidth: -1
      })
      
      await fs.writeFile(this.configPath, content, 'utf8')
      this.logger.info('Default auto workspace config created', { config_path: this.configPath })
      
    } catch (error) {
      this.logger.warn('Failed to create default config', { error })
    }
  }

  private mergeWithDefaults(userConfig: Partial<AutoWorkspaceConfig>): AutoWorkspaceConfig {
    return {
      auto_activate: userConfig.auto_activate ?? DEFAULT_AUTO_WORKSPACE_CONFIG.auto_activate,
      project: {
        type: userConfig.project?.type,
        lsp_servers: userConfig.project?.lsp_servers,
        index_enabled: userConfig.project?.index_enabled ?? DEFAULT_AUTO_WORKSPACE_CONFIG.project.index_enabled,
        auto_save_logs: userConfig.project?.auto_save_logs ?? DEFAULT_AUTO_WORKSPACE_CONFIG.project.auto_save_logs
      },
      display: {
        show_banner: userConfig.display?.show_banner ?? DEFAULT_AUTO_WORKSPACE_CONFIG.display.show_banner,
        custom_banner: userConfig.display?.custom_banner,
        verbose_logging: userConfig.display?.verbose_logging ?? DEFAULT_AUTO_WORKSPACE_CONFIG.display.verbose_logging,
        use_emojis: userConfig.display?.use_emojis ?? DEFAULT_AUTO_WORKSPACE_CONFIG.display.use_emojis
      },
      advanced: {
        init_timeout: userConfig.advanced?.init_timeout ?? DEFAULT_AUTO_WORKSPACE_CONFIG.advanced.init_timeout,
        detection_depth: userConfig.advanced?.detection_depth ?? DEFAULT_AUTO_WORKSPACE_CONFIG.advanced.detection_depth,
        retry_count: userConfig.advanced?.retry_count ?? DEFAULT_AUTO_WORKSPACE_CONFIG.advanced.retry_count
      }
    }
  }
}