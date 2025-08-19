/**
 * LSP自動起動システム
 * serenaのアプローチを参考に、依存関係の自動検出・インストール・起動を提供
 */

import { exec, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { Logger } from '../logger.js';
import type { 
  ExtendedLSPServerConfig, 
  LSPDependency,
  LSPClientBase 
} from './types.js';
import { TypeScriptLSP } from './typescript-lsp.js';
import { SwiftLSP } from './swift-lsp.js';
import { JavaLSP } from './java-lsp.js';

const execAsync = promisify(exec);

/**
 * LSP自動起動とライフサイクル管理
 * 
 * 機能:
 * - LSPサーバーの自動検出・インストール
 * - 依存関係の自動解決
 * - プロセス管理とヘルスチェック
 * - 既存実装との統合（TypeScript, Swift）
 */
export class LSPAutoLauncher {
  private logger: Logger;
  private installedServers = new Map<string, ExtendedLSPServerConfig>();
  private runningProcesses = new Map<string, ChildProcess>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private workspaceRoot: string,
    private installBaseDir?: string
  ) {
    this.logger = Logger.getInstance();
    this.installBaseDir = installBaseDir || join(workspaceRoot, '.claude', 'lsp-servers');
    
    // インストールディレクトリを確保
    if (!existsSync(this.installBaseDir)) {
      mkdirSync(this.installBaseDir, { recursive: true });
    }
  }

  /**
   * LSPサーバーを検出・起動（メインエントリポイント）
   */
  async detectAndStartServer(language: string, config?: Partial<ExtendedLSPServerConfig>): Promise<LSPClientBase | null> {
    try {
      this.logger.info(`🚀 LSP AutoLauncher: Starting ${language} server detection`);

      // 言語固有の設定を取得
      const serverConfig = await this.getLanguageConfig(language, config);
      if (!serverConfig) {
        this.logger.warn(`❌ Unsupported language: ${language}`);
        return null;
      }

      // 既存実装への委譲（TypeScript, Swift）
      if (this.hasNativeImplementation(language)) {
        return await this.startNativeImplementation(language, serverConfig);
      }

      // 自動起動プロセス
      if (serverConfig.auto_start?.enabled) {
        // 1. 依存関係チェック・インストール
        if (serverConfig.auto_start.auto_install) {
          await this.ensureDependencies(language, serverConfig);
        }

        // 2. サーバー起動
        const client = await this.startLSPServer(language, serverConfig);
        
        // 3. ヘルスチェック開始
        if (serverConfig.health_check?.enabled) {
          this.startHealthCheck(language, client);
        }

        return client;
      }

      this.logger.warn(`⚠️  Auto-start disabled for ${language}`);
      return null;

    } catch (error) {
      this.logger.error(`❌ Failed to start ${language} LSP server:`);
      return null;
    }
  }

  /**
   * 言語固有の設定を取得
   */
  private async getLanguageConfig(
    language: string, 
    userConfig?: Partial<ExtendedLSPServerConfig>
  ): Promise<ExtendedLSPServerConfig | null> {
    // 既存の設定がある場合は使用
    if (this.installedServers.has(language)) {
      const existing = this.installedServers.get(language)!;
      return { ...existing, ...userConfig };
    }

    // デフォルト設定を生成
    const defaultConfig = this.createDefaultConfig(language);
    if (!defaultConfig) {
      return null;
    }

    const config = { ...defaultConfig, ...userConfig };
    this.installedServers.set(language, config);
    return config;
  }

  /**
   * デフォルト言語設定の生成
   */
  private createDefaultConfig(language: string): ExtendedLSPServerConfig | null {
    const commonConfig = {
      workspaceRoot: this.workspaceRoot,
      max_restarts: 3,
      startup_timeout: 10000,
      health_check: {
        enabled: true,
        interval: 30000, // 30秒
        timeout: 5000
      }
    };

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return {
          name: 'typescript-language-server',
          command: 'typescript-language-server',
          args: ['--stdio'],
          fileExtensions: ['.ts', '.js', '.tsx', '.jsx', '.mts', '.cts'],
          auto_start: {
            enabled: true,
            auto_install: true,
            dependencies: [
              {
                name: 'typescript',
                version: '5.5.4',
                installer: 'npm',
                required: true
              },
              {
                name: 'typescript-language-server',
                version: '4.3.3',
                installer: 'npm',
                required: true
              }
            ],
            check_command: ['typescript-language-server', '--version'],
            install_dir: join(this.installBaseDir!, 'typescript')
          },
          ...commonConfig
        };

      case 'python':
        return {
          name: 'pylsp',
          command: 'pylsp', 
          args: [],
          fileExtensions: ['.py', '.pyi', '.pyw'],
          auto_start: {
            enabled: false, // 将来実装予定
            auto_install: false,
            dependencies: [
              {
                name: 'python-lsp-server[all]',
                installer: 'pip',
                required: true
              }
            ],
            check_command: ['pylsp', '--version'],
            install_dir: join(this.installBaseDir!, 'python')
          },
          ...commonConfig
        };

      case 'go':
        return {
          name: 'gopls',
          command: 'gopls',
          args: [],
          fileExtensions: ['.go'],
          auto_start: {
            enabled: false, // 将来実装予定
            auto_install: false,
            dependencies: [
              {
                name: 'gopls',
                installer: 'system',
                required: true
              }
            ],
            check_command: ['gopls', 'version']
          },
          ...commonConfig
        };

      case 'java':
        return {
          name: 'eclipse-jdtls',
          command: 'java',
          args: [
            '-Declipse.application=org.eclipse.jdt.ls.core.id1',
            '-Dosgi.bundles.defaultStartLevel=4',
            '-Declipse.product=org.eclipse.jdt.ls.core.product',
            '-jar',
            join(this.installBaseDir!, 'java', 'eclipse-jdt-ls.jar'),
            '-configuration',
            join(this.workspaceRoot, '.jdt-config'),
            '-data',
            this.workspaceRoot
          ],
          fileExtensions: ['.java'],
          auto_start: {
            enabled: true,
            auto_install: true,
            dependencies: [
              {
                name: 'eclipse-jdt-language-server',
                installer: 'binary',
                required: true
              }
            ],
            check_command: ['jdtls', '--version']
          },
          ...commonConfig
        };

      case 'kotlin':
        return {
          name: 'kotlin-language-server',
          command: 'kotlin-language-server',
          args: [],
          fileExtensions: ['.kt', '.kts'],
          auto_start: {
            enabled: false, // 将来実装予定
            auto_install: false,
            dependencies: [
              {
                name: 'kotlin-language-server',
                installer: 'system',
                required: true
              }
            ],
            check_command: ['kotlin-language-server', '--version']
          },
          ...commonConfig
        };

      case 'swift':
        return {
          name: 'sourcekit-lsp',
          command: 'sourcekit-lsp',
          args: [],
          fileExtensions: ['.swift', '.swiftinterface'],
          auto_start: {
            enabled: true,
            auto_install: false, // システムのSwift付属を使用
            check_command: ['sourcekit-lsp', '--help']
          },
          ...commonConfig
        };



      default:
        return null;
    }
  }

  /**
   * ネイティブ実装があるかチェック
   * 現在実装済み: TypeScript/JavaScript, Swift
   * 将来実装予定: Go, Java, Kotlin, Python
   */
  private hasNativeImplementation(language: string): boolean {
    return ['typescript', 'javascript', 'swift', 'java'].includes(language.toLowerCase());
  }

  /**
   * 既存のネイティブ実装を起動
   */
  private async startNativeImplementation(
    language: string, 
    config: ExtendedLSPServerConfig
  ): Promise<LSPClientBase> {
    this.logger.info(`🔄 Using native ${language} implementation`);

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript': {
        const tsLsp = new TypeScriptLSP(config.workspaceRoot);
        await tsLsp.connect();
        return tsLsp as any; // TypeScriptLSPはLSPClientBaseを継承していると仮定
      }
        
      case 'swift': {
        const swiftLsp = new SwiftLSP(config.workspaceRoot);
        await swiftLsp.connect();
        return swiftLsp as any; // SwiftLSPはLSPClientBaseを継承していると仮定
      }

      case 'java': {
        const javaLsp = await JavaLSP.createWithAutoSetup({
          workspaceRoot: config.workspaceRoot,
          autoInstall: config.auto_start?.auto_install !== false
        });
        await javaLsp.connect();
        return javaLsp as any; // JavaLSPはLSPClientBaseを継承していると仮定
      }

      default:
        throw new Error(`No native implementation for ${language}`);
    }
  }

  /**
   * 依存関係の確保
   */
  async ensureDependencies(language: string, config: ExtendedLSPServerConfig): Promise<boolean> {
    if (!config.auto_start?.dependencies?.length) {
      this.logger.info(`✅ No dependencies required for ${language}`);
      return true;
    }

    this.logger.info(`📦 Checking dependencies for ${language}...`);

    try {
      // 1. プリインストールコマンドの実行
      if (config.auto_start.pre_install_commands?.length) {
        await this.executePreInstallCommands(config.auto_start.pre_install_commands);
      }

      // 2. 各依存関係をチェック・インストール
      for (const dep of config.auto_start.dependencies) {
        const installed = await this.installDependency(dep, config.auto_start.install_dir || this.installBaseDir!);
        if (!installed && dep.required) {
          throw new Error(`Failed to install required dependency: ${dep.name}`);
        }
      }

      // 3. インストール確認
      if (config.auto_start.check_command) {
        const verified = await this.verifyInstallation(config.auto_start.check_command);
        if (!verified) {
          throw new Error(`Installation verification failed for ${language}`);
        }
      }

      this.logger.info(`✅ Dependencies verified for ${language}`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Dependency setup failed for ${language}:`);
      return false;
    }
  }

  /**
   * プリインストールコマンドの実行
   */
  private async executePreInstallCommands(commands: string[]): Promise<void> {
    for (const command of commands) {
      this.logger.info(`🔧 Executing pre-install: ${command}`);
      try {
        const { stderr } = await execAsync(command);
        if (stderr) {
          this.logger.warn(`Pre-install warning: ${stderr}`);
        }
      } catch (error) {
        this.logger.warn(`Pre-install command failed (continuing): ${command}`);
        // 継続実行（通常は問題ない）
      }
    }
  }

  /**
   * 単一依存関係のインストール
   */
  private async installDependency(dep: LSPDependency, installDir: string): Promise<boolean> {
    try {
      this.logger.info(`📦 Installing ${dep.name} via ${dep.installer}...`);

      // インストールディレクトリの準備
      if (!existsSync(installDir)) {
        mkdirSync(installDir, { recursive: true });
      }

      switch (dep.installer) {
        case 'npm':
          return await this.installNpmPackage(dep, installDir);
        case 'pip':
          return await this.installPipPackage(dep, installDir);
        case 'cargo':
          return await this.installCargoPackage(dep, installDir);
        case 'binary':
          return await this.installBinary(dep, installDir);
        case 'system':
          return await this.installSystemPackage(dep);
        default:
          this.logger.error(`❌ Unsupported installer: ${dep.installer}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`❌ Failed to install ${dep.name}:`);
      return false;
    }
  }

  /**
   * NPMパッケージのインストール
   */
  private async installNpmPackage(dep: LSPDependency, installDir: string): Promise<boolean> {
    try {
      // package.jsonの確認・作成
      const packageJsonPath = join(installDir, 'package.json');
      if (!existsSync(packageJsonPath)) {
        writeFileSync(packageJsonPath, JSON.stringify({
          name: 'lsp-dependencies',
          version: '1.0.0',
          description: 'Auto-installed LSP dependencies'
        }, null, 2));
      }

      // npmインストール
      const packageName = dep.version ? `${dep.name}@${dep.version}` : dep.name;
      const args = ['install', packageName, ...dep.install_args || []];
      
      await execAsync(`npm ${args.join(' ')}`, {
        cwd: installDir,
        timeout: 60000 // 1分
      });

      this.logger.info(`✅ NPM install successful: ${dep.name}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ NPM install failed: ${dep.name}`);
      return false;
    }
  }

  /**
   * Pipパッケージのインストール
   */
  private async installPipPackage(dep: LSPDependency, _installDir: string): Promise<boolean> {
    try {
      const packageName = dep.version ? `${dep.name}==${dep.version}` : dep.name;
      const args = ['install', packageName, ...dep.install_args || []];

      await execAsync(`pip ${args.join(' ')}`, {
        timeout: 120000 // 2分
      });

      this.logger.info(`✅ Pip install successful: ${dep.name}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Pip install failed: ${dep.name}`);
      return false;
    }
  }

  /**
   * Cargoパッケージのインストール
   */
  private async installCargoPackage(dep: LSPDependency, _installDir: string): Promise<boolean> {
    try {
      const args = ['install', dep.name, ...dep.install_args || []];
      if (dep.version) {
        args.push('--version', dep.version);
      }

      await execAsync(`cargo ${args.join(' ')}`, {
        timeout: 300000 // 5分
      });

      this.logger.info(`✅ Cargo install successful: ${dep.name}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Cargo install failed: ${dep.name}`);
      return false;
    }
  }

  /**
   * バイナリのダウンロード・インストール
   */
  private async installBinary(dep: LSPDependency, _installDir: string): Promise<boolean> {
    // 簡易実装：将来的にバイナリダウンロード機能を追加
    this.logger.warn(`⚠️  Binary installation not yet implemented: ${dep.name}`);
    return false;
  }

  /**
   * システムパッケージのインストール
   */
  private async installSystemPackage(dep: LSPDependency): Promise<boolean> {
    this.logger.warn(`⚠️  System package installation not implemented: ${dep.name}`);
    this.logger.info('Please install system dependencies manually');
    return false;
  }

  /**
   * インストール確認
   */
  private async verifyInstallation(checkCommand: string[]): Promise<boolean> {
    try {
      await execAsync(checkCommand.join(' '), {
        timeout: 5000
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * LSPサーバープロセスの起動
   */
  private async startLSPServer(_language: string, _config: ExtendedLSPServerConfig): Promise<LSPClientBase> {
    // 簡易実装：基本的なプロセス起動
    // 将来的にLSPClientBaseを継承したGenericLSPClientを実装
    throw new Error('Generic LSP server startup not yet implemented. Use native implementations.');
  }

  /**
   * ヘルスチェックの開始
   */
  private startHealthCheck(language: string, client: LSPClientBase): void {
    const config = this.installedServers.get(language);
    if (!config?.health_check?.enabled) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // 簡単なヘルスチェック（ping相当）
        const healthy = await this.checkServerHealth(client);
        if (!healthy) {
          this.logger.warn(`⚠️  Health check failed for ${language}, attempting restart...`);
          // 自動再起動ロジック（簡易版）
        }
      } catch (error) {
        this.logger.error(`❌ Health check error for ${language}`);
      }
    }, config.health_check.interval);

    this.healthCheckIntervals.set(language, interval);
  }

  /**
   * サーバーヘルスチェック
   */
  private async checkServerHealth(client: LSPClientBase): Promise<boolean> {
    try {
      // 簡易ヘルスチェック：状態確認
      return (client as any).state?.connected === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 全サーバーのシャットダウン
   */
  async shutdown(): Promise<void> {
    this.logger.info('🔄 LSP AutoLauncher: Shutting down all servers...');

    // ヘルスチェック停止
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // プロセス終了
    for (const [language, process] of this.runningProcesses.entries()) {
      try {
        process.kill('SIGTERM');
        this.logger.info(`✅ Terminated ${language} server`);
      } catch (error) {
        this.logger.error(`❌ Failed to terminate ${language} server`);
      }
    }
    this.runningProcesses.clear();

    this.logger.info('✅ LSP AutoLauncher shutdown complete');
  }

  /**
   * 設定済み言語リストを取得
   */
  getConfiguredLanguages(): string[] {
    return Array.from(this.installedServers.keys());
  }

  /**
   * 特定言語の設定を取得
   */
  getLanguageConfiguration(language: string): ExtendedLSPServerConfig | undefined {
    // インストール済み設定を優先
    const installed = this.installedServers.get(language);
    if (installed) {
      return installed;
    }

    // デフォルト設定を返す
    return this.createDefaultConfig(language) || undefined;
  }
}
