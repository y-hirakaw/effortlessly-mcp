/**
 * LSP依存関係管理システム
 * パッケージマネージャーを横断した統一的な依存関係管理
 */

import { exec } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { platform } from 'os';
import { Logger } from '../logger.js';
import type { LSPDependency, LSPAutoStartConfig } from './types.js';

const execAsync = promisify(exec);

/**
 * 依存関係インストールの結果
 */
export interface DependencyInstallResult {
  success: boolean;
  dependency: LSPDependency;
  installedVersion?: string;
  installedPath?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * パッケージマネージャーの情報
 */
interface PackageManagerInfo {
  name: string;
  available: boolean;
  version?: string;
  command: string;
  globalInstallDir?: string;
}

/**
 * LSP依存関係管理システム
 * 
 * 機能:
 * - 複数のパッケージマネージャー対応
 * - 依存関係の自動検出・インストール
 * - バージョン管理と競合回避
 * - インストール状態の追跡
 */
export class LSPDependencyManager {
  private logger: Logger;
  private packageManagers = new Map<string, PackageManagerInfo>();
  private installationCache = new Map<string, DependencyInstallResult>();
  private installLockFile: string;

  constructor(
    private baseInstallDir: string,
    private enableCache = true
  ) {
    this.logger = Logger.getInstance();
    this.installLockFile = join(baseInstallDir, 'installations.lock.json');
    
    // インストールディレクトリを確保
    if (!existsSync(baseInstallDir)) {
      mkdirSync(baseInstallDir, { recursive: true });
    }

    // キャッシュ読み込み
    if (enableCache) {
      this.loadInstallationCache();
    }
  }

  /**
   * パッケージマネージャーの初期化と検出
   */
  async initialize(): Promise<void> {
    this.logger.info('🔍 Detecting available package managers...');

    await Promise.all([
      this.detectNpm(),
      this.detectPip(),
      this.detectCargo(),
      this.detectBrew(),
      this.detectApt()
    ]);

    const available = Array.from(this.packageManagers.values())
      .filter(pm => pm.available)
      .map(pm => `${pm.name}@${pm.version || 'unknown'}`)
      .join(', ');

    this.logger.info(`📦 Available package managers: ${available}`);
  }

  /**
   * 依存関係リストを一括インストール
   */
  async installDependencies(
    dependencies: LSPDependency[], 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult[]> {
    this.logger.info(`📦 Installing ${dependencies.length} dependencies...`);

    const results: DependencyInstallResult[] = [];

    // プリインストールコマンドの実行
    if (config?.pre_install_commands?.length) {
      await this.executePreInstallCommands(config.pre_install_commands);
    }

    // 並列インストール（安全な場合のみ）
    const safeForParallel = this.canInstallInParallel(dependencies);
    if (safeForParallel && dependencies.length > 1) {
      this.logger.info('⚡ Parallel installation enabled');
      const promises = dependencies.map(dep => this.installSingleDependency(dep, config));
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // 順次インストール
      for (const dependency of dependencies) {
        const result = await this.installSingleDependency(dependency, config);
        results.push(result);
        
        // 必須依存関係が失敗した場合は中断
        if (!result.success && dependency.required) {
          this.logger.error(`❌ Required dependency failed: ${dependency.name}`);
          break;
        }
      }
    }

    // インストール結果の保存
    if (this.enableCache) {
      await this.saveInstallationCache();
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    this.logger.info(`📊 Installation summary: ${successful} successful, ${failed} failed, ${skipped} skipped`);

    return results;
  }

  /**
   * 単一依存関係のインストール
   */
  async installSingleDependency(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    try {
      // キャッシュチェック
      const cacheKey = this.getDependencyCacheKey(dependency);
      if (this.enableCache && this.installationCache.has(cacheKey)) {
        const cached = this.installationCache.get(cacheKey)!;
        this.logger.info(`💾 Using cached installation: ${dependency.name}`);
        return cached;
      }

      // 既存インストールチェック
      const existing = await this.checkExistingInstallation(dependency);
      if (existing.success) {
        this.logger.info(`✅ Already installed: ${dependency.name}@${existing.installedVersion}`);
        return existing;
      }

      // パッケージマネージャーチェック
      const pm = this.packageManagers.get(dependency.installer);
      if (!pm?.available) {
        return {
          success: false,
          dependency,
          error: `Package manager not available: ${dependency.installer}`
        };
      }

      this.logger.info(`📦 Installing ${dependency.name} via ${dependency.installer}...`);

      // インストール実行
      let result: DependencyInstallResult;
      switch (dependency.installer) {
        case 'npm':
          result = await this.installNpmDependency(dependency, config);
          break;
        case 'pip':
          result = await this.installPipDependency(dependency, config);
          break;
        case 'cargo':
          result = await this.installCargoDependency(dependency, config);
          break;
        case 'binary':
          result = await this.installBinaryDependency(dependency, config);
          break;
        case 'system':
          result = await this.installSystemDependency(dependency, config);
          break;
        default:
          result = {
            success: false,
            dependency,
            error: `Unsupported installer: ${dependency.installer}`
          };
      }

      // キャッシュに保存
      if (this.enableCache) {
        this.installationCache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      this.logger.error(`❌ Installation failed: ${dependency.name}`);
      return {
        success: false,
        dependency,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * NPM依存関係のインストール
   */
  private async installNpmDependency(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    try {
      const installDir = config?.install_dir || join(this.baseInstallDir, 'npm');
      if (!existsSync(installDir)) {
        mkdirSync(installDir, { recursive: true });
      }

      // package.jsonの準備
      const packageJsonPath = join(installDir, 'package.json');
      if (!existsSync(packageJsonPath)) {
        const packageJson = {
          name: 'lsp-dependencies',
          version: '1.0.0',
          description: 'Auto-installed LSP dependencies',
          private: true
        };
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }

      // インストールコマンド構築
      const packageSpec = dependency.version ? `${dependency.name}@${dependency.version}` : dependency.name;
      const args = [
        'install',
        packageSpec,
        '--save',
        '--no-audit',
        '--no-fund',
        ...dependency.install_args || []
      ];

      // インストール実行
      await execAsync(`npm ${args.join(' ')}`, {
        cwd: installDir,
        timeout: 120000, // 2分
        env: { ...process.env, ...config?.env }
      });

      // インストール確認
      const installedVersion = await this.getNpmPackageVersion(dependency.name, installDir);
      const binPath = join(installDir, 'node_modules', '.bin', dependency.name);

      return {
        success: true,
        dependency,
        installedVersion,
        installedPath: existsSync(binPath) ? binPath : undefined
      };

    } catch (error) {
      return {
        success: false,
        dependency,
        error: error instanceof Error ? error.message : 'NPM install failed'
      };
    }
  }

  /**
   * Python pip依存関係のインストール
   */
  private async installPipDependency(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    try {
      const packageSpec = dependency.version ? `${dependency.name}==${dependency.version}` : dependency.name;
      const args = [
        'install',
        packageSpec,
        '--user', // ユーザーディレクトリにインストール
        ...dependency.install_args || []
      ];

      await execAsync(`pip ${args.join(' ')}`, {
        timeout: 180000, // 3分
        env: { ...process.env, ...config?.env }
      });

      // インストール確認
      const installedVersion = await this.getPipPackageVersion(dependency.name);

      return {
        success: true,
        dependency,
        installedVersion
      };

    } catch (error) {
      return {
        success: false,
        dependency,
        error: error instanceof Error ? error.message : 'Pip install failed'
      };
    }
  }

  /**
   * Rust cargo依存関係のインストール
   */
  private async installCargoDependency(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    try {
      const args = ['install', dependency.name, ...dependency.install_args || []];
      if (dependency.version) {
        args.push('--version', dependency.version);
      }

      await execAsync(`cargo ${args.join(' ')}`, {
        timeout: 600000, // 10分（Rustコンパイルは時間がかかる）
        env: { ...process.env, ...config?.env }
      });

      // インストール確認
      const installedVersion = await this.getCargoPackageVersion(dependency.name);

      return {
        success: true,
        dependency,
        installedVersion
      };

    } catch (error) {
      return {
        success: false,
        dependency,
        error: error instanceof Error ? error.message : 'Cargo install failed'
      };
    }
  }

  /**
   * バイナリ依存関係のインストール（GitHub Releasesなど）
   */
  private async installBinaryDependency(
    dependency: LSPDependency, 
    _config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    // TODO: GitHub Releases APIを使用したバイナリダウンロード実装
    this.logger.warn(`⚠️  Binary installation not yet implemented: ${dependency.name}`);
    return {
      success: false,
      dependency,
      skipped: true,
      skipReason: 'Binary installation not implemented'
    };
  }

  /**
   * システム依存関係のインストール
   */
  private async installSystemDependency(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    const osType = platform();
    
    if (osType === 'darwin' && this.packageManagers.get('brew')?.available) {
      return await this.installBrewPackage(dependency, config);
    } else if (osType === 'linux' && this.packageManagers.get('apt')?.available) {
      return await this.installAptPackage(dependency, config);
    }

    return {
      success: false,
      dependency,
      skipped: true,
      skipReason: `System package manager not available for ${osType}`
    };
  }

  /**
   * Homebrew パッケージインストール
   */
  private async installBrewPackage(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    try {
      await execAsync(`brew install ${dependency.name}`, {
        timeout: 300000, // 5分
        env: { ...process.env, ...config?.env }
      });

      return {
        success: true,
        dependency,
        installedVersion: 'system'
      };

    } catch (error) {
      return {
        success: false,
        dependency,
        error: error instanceof Error ? error.message : 'Brew install failed'
      };
    }
  }

  /**
   * APT パッケージインストール
   */
  private async installAptPackage(
    dependency: LSPDependency, 
    config?: LSPAutoStartConfig
  ): Promise<DependencyInstallResult> {
    try {
      await execAsync(`sudo apt-get install -y ${dependency.name}`, {
        timeout: 300000, // 5分
        env: { ...process.env, ...config?.env }
      });

      return {
        success: true,
        dependency,
        installedVersion: 'system'
      };

    } catch (error) {
      return {
        success: false,
        dependency,
        error: error instanceof Error ? error.message : 'APT install failed'
      };
    }
  }

  /**
   * 既存インストールのチェック
   */
  private async checkExistingInstallation(dependency: LSPDependency): Promise<DependencyInstallResult> {
    try {
      let installedVersion: string | undefined;

      switch (dependency.installer) {
        case 'npm':
          installedVersion = await this.getNpmPackageVersion(dependency.name);
          break;
        case 'pip':
          installedVersion = await this.getPipPackageVersion(dependency.name);
          break;
        case 'cargo':
          installedVersion = await this.getCargoPackageVersion(dependency.name);
          break;
        case 'system':
        case 'binary':
          // コマンド存在チェック
          try {
            await execAsync(`which ${dependency.name}`, { timeout: 3000 });
            installedVersion = 'system';
          } catch {
            return { success: false, dependency };
          }
          break;
        default:
          return { success: false, dependency };
      }

      if (installedVersion) {
        // バージョンチェック
        if (dependency.version && installedVersion !== dependency.version && installedVersion !== 'system') {
          this.logger.warn(`⚠️  Version mismatch: ${dependency.name} (installed: ${installedVersion}, required: ${dependency.version})`);
        }

        return {
          success: true,
          dependency,
          installedVersion,
          skipped: true,
          skipReason: 'Already installed'
        };
      }

      return { success: false, dependency };

    } catch (error) {
      return { success: false, dependency };
    }
  }

  /**
   * パッケージマネージャーの検出
   */
  private async detectNpm(): Promise<void> {
    try {
      const { stdout } = await execAsync('npm --version', { timeout: 3000 });
      this.packageManagers.set('npm', {
        name: 'npm',
        available: true,
        version: stdout.trim(),
        command: 'npm'
      });
    } catch {
      this.packageManagers.set('npm', {
        name: 'npm',
        available: false,
        command: 'npm'
      });
    }
  }

  private async detectPip(): Promise<void> {
    try {
      const { stdout } = await execAsync('pip --version', { timeout: 3000 });
      this.packageManagers.set('pip', {
        name: 'pip',
        available: true,
        version: stdout.trim(),
        command: 'pip'
      });
    } catch {
      this.packageManagers.set('pip', {
        name: 'pip',
        available: false,
        command: 'pip'
      });
    }
  }

  private async detectCargo(): Promise<void> {
    try {
      const { stdout } = await execAsync('cargo --version', { timeout: 3000 });
      this.packageManagers.set('cargo', {
        name: 'cargo',
        available: true,
        version: stdout.trim(),
        command: 'cargo'
      });
    } catch {
      this.packageManagers.set('cargo', {
        name: 'cargo',
        available: false,
        command: 'cargo'
      });
    }
  }

  private async detectBrew(): Promise<void> {
    if (platform() !== 'darwin') {
      return;
    }
    
    try {
      const { stdout } = await execAsync('brew --version', { timeout: 3000 });
      this.packageManagers.set('brew', {
        name: 'brew',
        available: true,
        version: stdout.split('\n')[0].trim(),
        command: 'brew'
      });
    } catch {
      this.packageManagers.set('brew', {
        name: 'brew',
        available: false,
        command: 'brew'
      });
    }
  }

  private async detectApt(): Promise<void> {
    if (platform() !== 'linux') {
      return;
    }

    try {
      const { stdout } = await execAsync('apt --version', { timeout: 3000 });
      this.packageManagers.set('apt', {
        name: 'apt',
        available: true,
        version: stdout.split('\n')[0].trim(),
        command: 'apt'
      });
    } catch {
      this.packageManagers.set('apt', {
        name: 'apt',
        available: false,
        command: 'apt'
      });
    }
  }

  /**
   * パッケージバージョン取得
   */
  private async getNpmPackageVersion(packageName: string, installDir?: string): Promise<string | undefined> {
    try {
      const command = `npm list ${packageName} --depth=0 --json`;
      const { stdout } = await execAsync(command, { 
        cwd: installDir,
        timeout: 5000 
      });
      const result = JSON.parse(stdout);
      return result.dependencies?.[packageName]?.version;
    } catch {
      return undefined;
    }
  }

  private async getPipPackageVersion(packageName: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`pip show ${packageName}`, { timeout: 5000 });
      const versionLine = stdout.split('\n').find(line => line.startsWith('Version:'));
      return versionLine?.split(': ')[1];
    } catch {
      return undefined;
    }
  }

  private async getCargoPackageVersion(packageName: string): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`${packageName} --version`, { timeout: 5000 });
      return stdout.trim().split(' ')[1];
    } catch {
      return undefined;
    }
  }

  /**
   * ユーティリティメソッド
   */
  private canInstallInParallel(dependencies: LSPDependency[]): boolean {
    // 同じインストーラーの依存関係がある場合は順次実行
    const installers = dependencies.map(d => d.installer);
    const uniqueInstallers = new Set(installers);
    return uniqueInstallers.size === installers.length;
  }

  private getDependencyCacheKey(dependency: LSPDependency): string {
    return `${dependency.installer}:${dependency.name}@${dependency.version || 'latest'}`;
  }

  private async executePreInstallCommands(commands: string[]): Promise<void> {
    for (const command of commands) {
      this.logger.info(`🔧 Executing pre-install: ${command}`);
      try {
        await execAsync(command, { timeout: 30000 });
      } catch (error) {
        this.logger.warn(`Pre-install command failed (continuing): ${command}`);
      }
    }
  }

  /**
   * キャッシュ管理
   */
  private loadInstallationCache(): void {
    try {
      if (existsSync(this.installLockFile)) {
        const data = readFileSync(this.installLockFile, 'utf8');
        const cache = JSON.parse(data);
        for (const [key, value] of Object.entries(cache)) {
          this.installationCache.set(key, value as DependencyInstallResult);
        }
        this.logger.info(`📂 Loaded ${this.installationCache.size} cached installations`);
      }
    } catch (error) {
      this.logger.warn('Failed to load installation cache');
    }
  }

  private async saveInstallationCache(): Promise<void> {
    try {
      const cache = Object.fromEntries(this.installationCache.entries());
      writeFileSync(this.installLockFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      this.logger.warn('Failed to save installation cache');
    }
  }

  /**
   * クリーンアップ
   */
  async cleanupFailedInstallations(): Promise<void> {
    this.logger.info('🧹 Cleaning up failed installations...');
    
    // 失敗したインストールのキャッシュエントリを削除
    const failedEntries = Array.from(this.installationCache.entries())
      .filter(([, result]) => !result.success && !result.skipped);

    for (const [key, result] of failedEntries) {
      this.installationCache.delete(key);
      this.logger.info(`🗑️  Removed failed installation cache: ${result.dependency.name}`);
    }

    await this.saveInstallationCache();
  }

  /**
   * インストール状態レポート
   */
  getInstallationReport(): {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    packageManagers: Array<{ name: string; available: boolean; version?: string }>;
  } {
    const results = Array.from(this.installationCache.values());
    return {
      total: results.length,
      successful: results.filter(r => r.success && !r.skipped).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      packageManagers: Array.from(this.packageManagers.values())
    };
  }
}
