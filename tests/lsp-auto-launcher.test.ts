/**
 * LSP自動起動システムのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LSPAutoLauncher } from '../src/services/lsp/lsp-auto-launcher.js';
import { LSPDependencyManager } from '../src/services/lsp/lsp-dependency-manager.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LSP Auto-Launcher System', () => {
  let testWorkspaceRoot: string;
  let autoLauncher: LSPAutoLauncher;
  let dependencyManager: LSPDependencyManager;

  beforeEach(() => {
    // テスト用の一時ディレクトリを作成
    testWorkspaceRoot = join(tmpdir(), `lsp-test-${Date.now()}`);
    if (!existsSync(testWorkspaceRoot)) {
      mkdirSync(testWorkspaceRoot, { recursive: true });
    }

    // インスタンス初期化
    autoLauncher = new LSPAutoLauncher(testWorkspaceRoot);
    dependencyManager = new LSPDependencyManager(join(testWorkspaceRoot, '.claude', 'lsp-servers'));

    // モック設定
    vi.clearAllMocks();
  });

  afterEach(() => {
    // テストディレクトリのクリーンアップ
    if (existsSync(testWorkspaceRoot)) {
      rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
  });

  describe('LSPAutoLauncher', () => {
    it('should create default configurations for supported languages', async () => {
      // TypeScript設定のテスト
      const tsConfig = await autoLauncher['getLanguageConfig']('typescript');
      expect(tsConfig).toBeDefined();
      expect(tsConfig?.name).toBe('typescript-language-server');
      expect(tsConfig?.command).toBe('typescript-language-server');
      expect(tsConfig?.args).toEqual(['--stdio']);
      expect(tsConfig?.fileExtensions).toContain('.ts');
      expect(tsConfig?.auto_start?.enabled).toBe(true);
      expect(tsConfig?.auto_start?.auto_install).toBe(true);

      // Python設定のテスト（将来実装予定）
      const pyConfig = await autoLauncher['getLanguageConfig']('python');
      expect(pyConfig).toBeDefined();
      expect(pyConfig?.name).toBe('pylsp');
      expect(pyConfig?.command).toBe('pylsp');
      expect(pyConfig?.fileExtensions).toContain('.py');
      expect(pyConfig?.auto_start?.enabled).toBe(false); // 将来実装予定

      // Go設定のテスト（将来実装予定）
      const goConfig = await autoLauncher['getLanguageConfig']('go');
      expect(goConfig).toBeDefined();
      expect(goConfig?.name).toBe('gopls');
      expect(goConfig?.fileExtensions).toContain('.go');
      expect(goConfig?.auto_start?.enabled).toBe(false);

      // Java設定のテスト（将来実装予定）
      const javaConfig = await autoLauncher['getLanguageConfig']('java');
      expect(javaConfig).toBeDefined();
      expect(javaConfig?.name).toBe('eclipse-jdtls');
      expect(javaConfig?.fileExtensions).toContain('.java');
      expect(javaConfig?.auto_start?.enabled).toBe(false);

      // Kotlin設定のテスト（将来実装予定）
      const kotlinConfig = await autoLauncher['getLanguageConfig']('kotlin');
      expect(kotlinConfig).toBeDefined();
      expect(kotlinConfig?.name).toBe('kotlin-language-server');
      expect(kotlinConfig?.fileExtensions).toContain('.kt');
      expect(kotlinConfig?.auto_start?.enabled).toBe(false);

      // Swift設定のテスト
      const swiftConfig = await autoLauncher['getLanguageConfig']('swift');
      expect(swiftConfig).toBeDefined();
      expect(swiftConfig?.name).toBe('sourcekit-lsp');
      expect(swiftConfig?.auto_start?.auto_install).toBe(false); // システム標準使用
    });

    it('should detect native implementations', () => {
      // 現在実装済み
      expect(autoLauncher['hasNativeImplementation']('typescript')).toBe(true);
      expect(autoLauncher['hasNativeImplementation']('swift')).toBe(true);
      
      // 将来実装予定（現在はfalse）
      expect(autoLauncher['hasNativeImplementation']('python')).toBe(false);
      expect(autoLauncher['hasNativeImplementation']('go')).toBe(false);
      expect(autoLauncher['hasNativeImplementation']('java')).toBe(false);
      expect(autoLauncher['hasNativeImplementation']('kotlin')).toBe(false);
      
      // 対応予定なし
      expect(autoLauncher['hasNativeImplementation']('unknown')).toBe(false);
    });

    it('should return null for unsupported languages', async () => {
      const config = await autoLauncher['getLanguageConfig']('unsupported-language');
      expect(config).toBeNull();
    });

    it('should merge user configuration with defaults', async () => {
      const userConfig = {
        max_restarts: 5,
        startup_timeout: 20000
      };

      const config = await autoLauncher['getLanguageConfig']('typescript', userConfig);
      expect(config?.max_restarts).toBe(5);
      expect(config?.startup_timeout).toBe(20000);
      expect(config?.name).toBe('typescript-language-server'); // デフォルト値も保持
    });

    it('should track configured languages', async () => {
      await autoLauncher['getLanguageConfig']('typescript');
      await autoLauncher['getLanguageConfig']('python');

      const languages = autoLauncher.getConfiguredLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages.length).toBe(2);
    });
  });

  describe('LSPDependencyManager', () => {
    beforeEach(async () => {
      await dependencyManager.initialize();
    });

    it('should initialize and detect package managers', async () => {
      const report = dependencyManager.getInstallationReport();
      expect(report).toBeDefined();
      expect(report.packageManagers).toBeDefined();
      expect(Array.isArray(report.packageManagers)).toBe(true);

      // 少なくとも1つのパッケージマネージャーが利用可能であることを期待
      const availableManagers = report.packageManagers.filter(pm => pm.available);
      expect(availableManagers.length).toBeGreaterThan(0);
    });

    it('should generate cache keys correctly', () => {
      const dependency = {
        name: 'typescript',
        version: '5.5.4',
        installer: 'npm' as const,
        required: true
      };

      const cacheKey = dependencyManager['getDependencyCacheKey'](dependency);
      expect(cacheKey).toBe('npm:typescript@5.5.4');

      // バージョンなしの場合
      const depWithoutVersion = { ...dependency };
      delete (depWithoutVersion as any).version;
      const cacheKey2 = dependencyManager['getDependencyCacheKey'](depWithoutVersion);
      expect(cacheKey2).toBe('npm:typescript@latest');
    });

    it('should detect parallel installation capability', () => {
      const sameInstaller = [
        { name: 'pkg1', installer: 'npm' as const, required: true },
        { name: 'pkg2', installer: 'npm' as const, required: true }
      ];

      const differentInstallers = [
        { name: 'pkg1', installer: 'npm' as const, required: true },
        { name: 'pkg2', installer: 'pip' as const, required: true }
      ];

      expect(dependencyManager['canInstallInParallel'](sameInstaller)).toBe(false);
      expect(dependencyManager['canInstallInParallel'](differentInstallers)).toBe(true);
    });

    it('should handle installation results correctly', async () => {
      const mockDependencies = [
        {
          name: 'test-package-1',
          installer: 'npm' as const,
          required: true
        },
        {
          name: 'test-package-2', 
          installer: 'pip' as const,
          required: false
        }
      ];

      // installSingleDependencyをモック
      const installSpy = vi.spyOn(dependencyManager, 'installSingleDependency')
        .mockResolvedValueOnce({
          success: true,
          dependency: mockDependencies[0],
          installedVersion: '1.0.0'
        })
        .mockResolvedValueOnce({
          success: false,
          dependency: mockDependencies[1],
          error: 'Package not found'
        });

      const results = await dependencyManager.installDependencies(mockDependencies);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].installedVersion).toBe('1.0.0');
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Package not found');

      expect(installSpy).toHaveBeenCalledTimes(2);
    });

    it('should stop installation on required dependency failure', async () => {
      const mockDependencies = [
        {
          name: 'required-package',
          installer: 'npm' as const,
          required: true
        },
        {
          name: 'optional-package', 
          installer: 'npm' as const,
          required: false
        }
      ];

      const installSpy = vi.spyOn(dependencyManager, 'installSingleDependency')
        .mockResolvedValueOnce({
          success: false,
          dependency: mockDependencies[0],
          error: 'Installation failed'
        });

      const results = await dependencyManager.installDependencies(mockDependencies);

      // 必須パッケージが失敗したため、2番目のパッケージはインストールされない
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(installSpy).toHaveBeenCalledTimes(1);
    });

    it('should clean up failed installations', async () => {
      // 失敗した結果をキャッシュに追加
      dependencyManager['installationCache'].set('test-key', {
        success: false,
        dependency: {
          name: 'failed-package',
          installer: 'npm',
          required: true
        },
        error: 'Installation failed'
      });

      const initialSize = dependencyManager['installationCache'].size;
      await dependencyManager.cleanupFailedInstallations();
      
      expect(dependencyManager['installationCache'].size).toBeLessThan(initialSize);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete language setup flow', async () => {
      // 実際のネイティブ実装（TypeScript）のテスト
      // モックされた環境でのテスト
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        state: { connected: true, initialized: true, lastActivity: new Date() }
      };

      // startNativeImplementationをモック
      const startNativeSpy = vi.spyOn(autoLauncher as any, 'startNativeImplementation')
        .mockResolvedValue(mockClient);

      const client = await autoLauncher.detectAndStartServer('typescript');

      expect(startNativeSpy).toHaveBeenCalledWith('typescript', expect.any(Object));
      expect(client).toBeDefined();
    });

    it('should handle shutdown gracefully', async () => {
      // プロセスをモック
      const mockProcess = {
        kill: vi.fn()
      };

      autoLauncher['runningProcesses'].set('test-server', mockProcess as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await autoLauncher.shutdown();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(autoLauncher['runningProcesses'].size).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should provide installation reports', async () => {
      await dependencyManager.initialize();
      
      const report = dependencyManager.getInstallationReport();
      
      expect(report).toMatchObject({
        total: expect.any(Number),
        successful: expect.any(Number),
        failed: expect.any(Number),
        skipped: expect.any(Number),
        packageManagers: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            available: expect.any(Boolean)
          })
        ])
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing package managers gracefully', async () => {
      const dependency = {
        name: 'test-package',
        installer: 'non-existent-installer' as any,
        required: false
      };

      const result = await dependencyManager.installSingleDependency(dependency);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Package manager not available');
    });

    it('should handle network timeouts in dependency installation', async () => {
      const dependency = {
        name: 'test-package',
        installer: 'npm' as const,
        required: false
      };

      // execAsyncをモックしてタイムアウトをシミュレート
      const mockExec = vi.fn().mockImplementation((command, options, callback) => {
        setTimeout(() => {
          callback(new Error('Command timeout'), null, null);
        }, 100);
      });
      vi.doMock('child_process', () => ({
        exec: mockExec
      }));

      const result = await dependencyManager.installSingleDependency(dependency);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should continue operation when LSP initialization fails', async () => {
      // 存在しない言語でのテストによりエラーハンドリングを確認
      const result = await autoLauncher.detectAndStartServer('nonexistent-language');

      expect(result).toBeNull();
      // ログが記録されることも確認
      // エラーハンドリングが適切に動作していることを確認
    });
  });
});

describe('LSPManager Integration', () => {
  it('should initialize with workspace root', async () => {
    const { LSPManager } = await import('../src/services/lsp/index.js');
    
    const manager = LSPManager.getInstance();
    const testRoot = join(tmpdir(), 'lsp-manager-test');
    
    if (!existsSync(testRoot)) {
      mkdirSync(testRoot, { recursive: true });
    }

    await expect(manager.initialize(testRoot)).resolves.toBeUndefined();

    // クリーンアップ
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should handle multiple language enablement', async () => {
    const { LSPManager } = await import('../src/services/lsp/index.js');
    
    const manager = LSPManager.getInstance();
    const testRoot = join(tmpdir(), 'lsp-manager-multi-test');
    
    if (!existsSync(testRoot)) {
      mkdirSync(testRoot, { recursive: true });
    }

    await manager.initialize(testRoot);

    // enableLanguageSupportをモック
    const enableSpy = vi.spyOn(manager, 'enableLanguageSupport')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const results = await manager.enableMultipleLanguages(['typescript', 'python']);

    expect(results.get('typescript')).toBe(true);
    expect(results.get('python')).toBe(false);
    expect(enableSpy).toHaveBeenCalledTimes(2);

    // クリーンアップ
    await manager.disconnectAll();
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });
});
