import * as path from 'path'
import * as fs from 'fs/promises'
import { WorkspaceManager } from '../tools/project-management/workspace-manager.js'
import { AutoWorkspaceConfigManager } from './AutoWorkspaceConfigManager.js'
import { AutoWorkspaceConfig } from '../types/auto-workspace-config.js'


export class AutoWorkspaceManager {
  private isInitialized = false
  private configManager: AutoWorkspaceConfigManager
  private config: AutoWorkspaceConfig | null = null
  
  constructor(private workspaceManager: WorkspaceManager) {
    this.configManager = AutoWorkspaceConfigManager.getInstance()
  }
  
  async ensureWorkspaceActive(): Promise<void> {
    if (this.isInitialized) {
      this.log('🔄 Workspace already initialized, skipping activation')
      return
    }
    
    try {
      // 設定を読み込み
      this.config = await this.configManager.loadConfig()
      
      // 自動アクティベーションが無効の場合はスキップ
      if (!this.config.auto_activate) {
        this.log('⏸️  Auto workspace activation disabled by config')
        this.isInitialized = true
        return
      }
      
      this.log('🎯 Starting auto workspace activation...')
      
      // 現在のワークスペース状態をチェック
      const currentWorkspace = await this.workspaceManager.getCurrentWorkspace()
      this.log('📋 Current workspace status:', currentWorkspace?.status || 'none')
      
      if (currentWorkspace?.status === 'active') {
        this.log('✅ Workspace already active, initialization complete')
        this.isInitialized = true
        return
      }
      
      // 自動検出＆アクティベーション
      this.log('🚀 No active workspace found, starting auto-activation...')
      await this.autoActivateWorkspace()
      this.isInitialized = true
      
    } catch (error) {
      this.logWarn('⚠️  Auto workspace activation failed:', error)
      // エラーでも継続（フォールバック動作）
    }
  }
  
  private async autoActivateWorkspace() {
    if (!this.config) throw new Error('Config not loaded')
    
    this.log('🚀 Initializing effortlessly-mcp workspace...')
    
    const currentDir = process.cwd()
    
    // プロジェクトタイプの決定（設定 > 自動検出）
    const projectType = this.config.project.type || await this.detectProjectType(currentDir)
    
    this.log(`📁 Project: ${path.basename(currentDir)}`)
    this.log(`🔍 Project type: ${projectType}${this.config.project.type ? ' (configured)' : ' (detected)'}`)
    
    await this.workspaceManager.activateWorkspace(currentDir, {
      name: path.basename(currentDir),
      settings: {
        index_enabled: this.config.project.index_enabled,
        auto_save_logs: this.config.project.auto_save_logs
      }
    })
    
    // バナー表示（設定に基づいて）
    if (this.config.display.show_banner) {
      this.showReadyBanner(projectType)
    }
  }
  
  // LSP機能は v2.0 戦略転換により廃止済み
  private showReadyBanner(projectType: string) {
    if (!this.config) return
    
    // カスタムバナーがある場合はそれを使用
    if (this.config.display.custom_banner) {
      this.log(this.config.display.custom_banner)
      return
    }
    
    // 絵文字の使用設定に基づいてバナーを調整
    const emoji = this.config.display.use_emojis
    const sparkles = emoji ? '✨' : '*'
    const target = emoji ? '🎯' : '-'

    const folder = emoji ? '📂' : '[]'
    const search = emoji ? '🔍' : '?'
    const shield = emoji ? '🛡️' : '#'
    const chart = emoji ? '📊' : '|'
    const rocket = emoji ? '🚀' : '>'
    
    const banner = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███████╗███████╗███████╗ ██████╗ ██████╗ ████████╗        ║
║   ██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝        ║
║   █████╗  █████╗  █████╗  ██║   ██║██████╔╝   ██║           ║
║   ██╔══╝  ██╔══╝  ██╔══╝  ██║   ██║██╔══██╗   ██║           ║
║   ███████╗██║     ██║     ╚██████╔╝██║  ██║   ██║           ║
║   ╚══════╝╚═╝     ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝           ║
║                                                              ║
║                 ${sparkles} WORKSPACE READY! ${sparkles}                      ║
║                                                              ║
║   ${target} Project Type: ${projectType.padEnd(30)}                    ║
║   ${folder} Semantic search enabled    ${search} Symbol analysis ready    ║
║   ${shield}  Security features active   ${chart} Audit logging enabled   ║
║                                                              ║
║              Ready for effortless development! ${rocket}           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`
    this.log(banner)
  }
  
  private async detectProjectType(dir: string): Promise<string> {
    try {
      const files = await fs.readdir(dir)
      const detectionRules = this.configManager.getDetectionRules()
      
      const detectedTypes: { type: string; priority: number }[] = []
      
      // 各検出ルールを適用
      for (const rule of detectionRules) {
        const hasFiles = rule.files.some((pattern: string) => {
          if (pattern.includes('*')) {
            // glob パターンのサポート（簡易版）
            const regex = new RegExp(pattern.replace(/\*/g, '.*'))
            return files.some(f => regex.test(f))
          } else {
            return files.includes(pattern)
          }
        })
        
        if (hasFiles) {
          detectedTypes.push({ type: rule.type, priority: rule.priority })
        }
      }
      
      if (detectedTypes.length === 0) {
        return 'generic'
      }
      
      // 複数のタイプが検出された場合
      if (detectedTypes.length > 1) {
        // 高優先度のタイプを選択
        detectedTypes.sort((a, b) => b.priority - a.priority)
        
        // 上位2つが同じ優先度の場合は mixed として扱う
        if (detectedTypes.length >= 2 && detectedTypes[0].priority === detectedTypes[1].priority) {
          return 'mixed'
        }
      }
      
      return detectedTypes[0].type
      
    } catch (error) {
      this.logWarn('Project type detection failed:', error)
      return 'generic'
    }
  }
  
  // LSP機能は v2.0 戦略転換により廃止済み

  /**
   * ログ出力（設定に基づいて詳細ログを制御）
   */
  private log(...args: unknown[]): void {
    if (this.config?.display.verbose_logging !== false) {
      // eslint-disable-next-line no-console
      console.log(...args)
    }
  }

  private logWarn(...args: unknown[]): void {
    console.warn(...args)
  }
}