export interface AutoWorkspaceConfig {
  auto_activate: boolean
  project: {
    type?: 'swift' | 'typescript' | 'mixed' | 'generic'
    lsp_servers?: string[]
    index_enabled?: boolean
    auto_save_logs?: boolean
  }
  display: {
    show_banner: boolean
    custom_banner?: string
    verbose_logging: boolean
    use_emojis: boolean
  }
  advanced: {
    init_timeout: number
    detection_depth: number
    retry_count: number
  }
}

export interface ProjectTypeDetectionRule {
  type: string
  files: string[]
  lsp_servers: string[]
  priority: number
}

export const DEFAULT_AUTO_WORKSPACE_CONFIG: AutoWorkspaceConfig = {
  auto_activate: true,
  project: {
    index_enabled: true,
    auto_save_logs: true
  },
  display: {
    show_banner: true,
    verbose_logging: true,
    use_emojis: true
  },
  advanced: {
    init_timeout: 30000,
    detection_depth: 3,
    retry_count: 2
  }
}

export const DEFAULT_DETECTION_RULES: ProjectTypeDetectionRule[] = [
  {
    type: 'swift',
    files: ['Package.swift', '*.xcodeproj', '*.xcworkspace'],
    lsp_servers: ['swift'],
    priority: 100
  },
  {
    type: 'typescript',
    files: ['package.json', 'tsconfig.json', 'yarn.lock', 'pnpm-lock.yaml'],
    lsp_servers: ['typescript'],
    priority: 90
  },
  {
    type: 'go',
    files: ['go.mod', 'go.sum'],
    lsp_servers: ['gopls'],
    priority: 85
  },
  {
    type: 'rust',
    files: ['Cargo.toml', 'Cargo.lock'],
    lsp_servers: ['rust-analyzer'],
    priority: 85
  },
  {
    type: 'python',
    files: ['pyproject.toml', 'setup.py', 'requirements.txt'],
    lsp_servers: ['python'],
    priority: 80
  }
]