import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Logger } from './logger.js';
import { ConfigManager } from './ConfigManager.js';

/**
 * LSPサーバー管理
 * LSPプロキシサーバーの自動起動・停止・監視を行う
 */
export class LSPServerManager {
  private readonly logger = Logger.getInstance();
  private proxyProcess: ChildProcess | null = null;
  private isStarting = false;
  private configManager: ConfigManager;
  private lspConfig: any = null;
  private cachedProxyStatus: { running: boolean; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5秒間キャッシュ
  
  // 改善された再起動機能
  private restartCount = 0;
  private readonly MAX_RESTART_ATTEMPTS = 3;
  private readonly RESTART_COOLDOWN = 5000; // 5秒のクールダウン
  private lastRestartTime = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30秒間隔
  private isAutoRecoveryEnabled = true;

  constructor() {
    this.configManager = new ConfigManager();
    
    // プロセス終了時のクリーンアップ
    process.on('exit', () => {
      this.cleanup();
    });
    process.on('SIGINT', () => {
      this.cleanup();
    });
    process.on('SIGTERM', () => {
      this.cleanup();
    });
  }

  /**
   * LSPプロキシサーバーを起動
   */
  async startLSPProxy(workspacePath: string): Promise<boolean> {
    // キャッシュされた状態をチェック
    if (await this.isProxyRunning()) {
      this.logger.info('LSP proxy already running');
      return true;
    }

    if (this.isStarting) {
      this.logger.info('LSP proxy startup in progress');
      return true;
    }

    // 設定をキャッシュから取得または読み込み
    if (!this.lspConfig) {
      this.lspConfig = await this.configManager.getLSPServerConfig();
    }

    if (!this.lspConfig.proxy_server.enabled || !this.lspConfig.proxy_server.auto_start) {
      this.logger.info('LSP proxy auto-start disabled');
      return false;
    }

    try {
      this.isStarting = true;
      
      // ポートが使用中かダブルチェック（レースコンディション対策）
      const isPortInUse = await this.checkPortInUse(this.lspConfig.proxy_server.port);
      if (isPortInUse) {
        this.logger.info(`LSP proxy already running on port ${this.lspConfig.proxy_server.port}`);
        this.isStarting = false;
        // キャッシュを更新
        this.updateProxyStatusCache(true);
        return true;
      }

      this.logger.info('Starting LSP proxy server', {
        workspacePath,
        port: this.lspConfig.proxy_server.port,
      });

      // LSPプロキシサーバーを起動
      const proxyPath = await this.findLSPProxyExecutable();
      if (!proxyPath) {
        throw new Error('LSP proxy executable not found');
      }

      this.proxyProcess = spawn('node', [proxyPath, workspacePath, this.lspConfig.proxy_server.port.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // プロセスイベントリスナー設定
      this.setupProcessListeners();

      // 起動確認
      const started = await this.waitForStartup(this.lspConfig.proxy_server.startup_timeout);
      this.isStarting = false;

      if (started) {
        this.logger.info('LSP proxy server started successfully', {
          pid: this.proxyProcess?.pid,
          port: this.lspConfig.proxy_server.port,
        });
        // キャッシュを更新
        this.updateProxyStatusCache(true);
        // 再起動カウンターをリセット
        this.restartCount = 0;
        // ヘルスチェック開始
        this.startHealthCheck();
        return true;
      } else {
        this.logger.error('LSP proxy server failed to start within timeout');
        await this.stopLSPProxy();
        return false;
      }
    } catch (error) {
      this.isStarting = false;
      this.logger.error('Failed to start LSP proxy server', error as Error);
      return false;
    }
  }

  /**
   * LSPプロキシサーバーを停止
   */
  async stopLSPProxy(): Promise<void> {
    if (!this.proxyProcess) {
      return;
    }

    try {
      this.logger.info('Stopping LSP proxy server', { pid: this.proxyProcess.pid });
      
      this.proxyProcess.kill('SIGTERM');
      
      // 強制終了のタイムアウト
      setTimeout(() => {
        if (this.proxyProcess && !this.proxyProcess.killed) {
          this.logger.warn('Force killing LSP proxy server');
          this.proxyProcess.kill('SIGKILL');
        }
      }, 5000);

      this.proxyProcess = null;
      // キャッシュを更新
      this.updateProxyStatusCache(false);
      this.logger.info('LSP proxy server stopped');
    } catch (error) {
      this.logger.error('Failed to stop LSP proxy server', error as Error);
    }
  }

  /**
   * LSPプロキシサーバーの状態確認（キャッシュ付き）
   */
  async isProxyRunning(): Promise<boolean> {
    const now = Date.now();
    
    // キャッシュされた状態をチェック
    if (this.cachedProxyStatus && (now - this.cachedProxyStatus.timestamp) < this.CACHE_TTL) {
      return this.cachedProxyStatus.running;
    }

    let isRunning = false;

    // プロセス状態をチェック
    if (this.proxyProcess && !this.proxyProcess.killed && this.proxyProcess.exitCode === null) {
      isRunning = true;
    } else {
      // プロセスがない場合、ポートチェック
      if (!this.lspConfig) {
        this.lspConfig = await this.configManager.getLSPServerConfig();
      }
      isRunning = await this.checkPortInUse(this.lspConfig.proxy_server.port);
    }

    // キャッシュを更新
    this.updateProxyStatusCache(isRunning);
    return isRunning;
  }

  /**
   * LSPプロキシ実行ファイルを検索
   */
  private async findLSPProxyExecutable(): Promise<string | null> {
    // build/lsp-proxy-standalone.js を探す
    const possiblePaths = [
      'build/lsp-proxy-standalone.js',
      '../build/lsp-proxy-standalone.js',
      '../../build/lsp-proxy-standalone.js',
    ];

    for (const relativePath of possiblePaths) {
      try {
        const fullPath = path.resolve(relativePath);
        (await import('fs')).accessSync(fullPath);
        return fullPath;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * ポート使用確認
   */
  private async checkPortInUse(port: number): Promise<boolean> {
    const { createServer } = await import('net');
    return new Promise((resolve) => {
      const server = createServer();
      
      server.listen(port, () => {
        server.close(() => resolve(false));
      });
      
      server.on('error', () => resolve(true));
    });
  }

  /**
   * 起動完了を待機
   */
  private async waitForStartup(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 500;
      
      const checkHealth = async () => {
        try {
          const response = await fetch(`http://${this.lspConfig.proxy_server.host}:${this.lspConfig.proxy_server.port}/health`);
          if (response.ok) {
            resolve(true);
            return;
          }
        } catch {
          // まだ起動していない
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }
        
        setTimeout(checkHealth, checkInterval);
      };
      
      setTimeout(checkHealth, checkInterval);
    });
  }

  /**
   * プロセスイベントリスナー設定
   */
  private setupProcessListeners(): void {
    if (!this.proxyProcess) return;

    this.proxyProcess.stdout?.on('data', (data) => {
      // 標準出力は情報レベルでログ
      const output = data.toString().trim();
      if (output) {
        this.logger.info(`LSP Proxy: ${output}`);
      }
    });

    this.proxyProcess.stderr?.on('data', (data) => {
      // 標準エラーも情報レベル（LSPサーバーは正常な情報もstderrに出力することがある）
      const error = data.toString().trim();
      if (error) {
        this.logger.info(`LSP Proxy: ${error}`);
      }
    });

    this.proxyProcess.on('exit', (code, signal) => {
      this.logger.info(`LSP proxy process exited`, { code, signal });
      this.proxyProcess = null;
      // キャッシュを更新
      this.updateProxyStatusCache(false);
      // ヘルスチェック停止
      this.stopHealthCheck();
      
      // 異常終了時の自動復旧
      if (code !== 0 && code !== null && this.isAutoRecoveryEnabled) {
        this.logger.warn('LSP proxy exited abnormally, attempting automatic recovery', { 
          code, 
          signal, 
          restartCount: this.restartCount 
        });
        this.attemptAutoRestart();
      }
    });

    this.proxyProcess.on('error', (error) => {
      this.logger.error('LSP proxy process error', error);
      this.proxyProcess = null;
      // キャッシュを更新
      this.updateProxyStatusCache(false);
      // ヘルスチェック停止
      this.stopHealthCheck();
      
      // エラー時の自動復旧
      if (this.isAutoRecoveryEnabled) {
        this.logger.warn('LSP proxy error, attempting automatic recovery', { 
          error: error.message, 
          restartCount: this.restartCount 
        });
        this.attemptAutoRestart();
      }
    });
  }

  /**
   * プロキシ状態キャッシュを更新
   */
  private updateProxyStatusCache(running: boolean): void {
    this.cachedProxyStatus = {
      running,
      timestamp: Date.now()
    };
  }

  /**
   * キャッシュをクリア（設定変更時などに使用）
   */
  public clearCache(): void {
    this.cachedProxyStatus = null;
    this.lspConfig = null;
  }

  /**
   * 自動復旧を試行
   */
  private async attemptAutoRestart(): Promise<void> {
    const now = Date.now();
    
    // クールダウン期間中はスキップ
    if (now - this.lastRestartTime < this.RESTART_COOLDOWN) {
      this.logger.debug('Auto restart skipped due to cooldown period');
      return;
    }
    
    // 最大試行回数チェック
    if (this.restartCount >= this.MAX_RESTART_ATTEMPTS) {
      this.logger.error(`LSP proxy auto restart failed after ${this.MAX_RESTART_ATTEMPTS} attempts`);
      this.isAutoRecoveryEnabled = false; // 自動復旧を無効化
      return;
    }
    
    this.restartCount++;
    this.lastRestartTime = now;
    
    this.logger.info(`Attempting LSP proxy auto restart (attempt ${this.restartCount}/${this.MAX_RESTART_ATTEMPTS})`);
    
    // 少し待ってから再起動
    setTimeout(async () => {
      try {
        const success = await this.startLSPProxy('');
        if (!success) {
          this.logger.error(`LSP proxy auto restart attempt ${this.restartCount} failed`);
        } else {
          this.logger.info(`LSP proxy auto restart attempt ${this.restartCount} succeeded`);
        }
      } catch (error) {
        this.logger.error(`LSP proxy auto restart attempt ${this.restartCount} error:`, error as Error);
      }
    }, 1000); // 1秒待機
  }

  /**
   * ヘルスチェック開始
   */
  private startHealthCheck(): void {
    this.stopHealthCheck(); // 既存のインターバルをクリア
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.performDetailedHealthCheck();
        if (!isHealthy && this.isAutoRecoveryEnabled) {
          this.logger.warn('LSP proxy failed health check, attempting recovery');
          this.attemptAutoRestart();
        }
      } catch (error) {
        this.logger.error('Health check error:', error as Error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
    
    this.logger.debug('LSP proxy health check started');
  }

  /**
   * ヘルスチェック停止
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.debug('LSP proxy health check stopped');
    }
  }

  /**
   * 詳細なヘルスチェック実行
   */
  private async performDetailedHealthCheck(): Promise<boolean> {
    if (!await this.isProxyRunning()) {
      return false;
    }

    try {
      if (!this.lspConfig) {
        this.lspConfig = await this.configManager.getLSPServerConfig();
      }

      // ヘルスエンドポイントをチェック
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト
      
      const response = await fetch(
        `http://${this.lspConfig.proxy_server.host}:${this.lspConfig.proxy_server.port}/health`,
        { 
          method: 'GET',
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return false;
      }

      // レスポンス内容も確認
      const healthData: any = await response.json();
      
      // 基本的なヘルスチェック
      if (!healthData?.status || healthData.status !== 'healthy') {
        return false;
      }

      // LSPサーバーの状態確認（可能であれば）
      if (healthData?.lspServers) {
        const hasHealthyLSP = Object.values(healthData.lspServers).some(
          (server: any) => server?.status === 'running'
        );
        if (!hasHealthyLSP) {
          this.logger.warn('No healthy LSP servers found');
          return false;
        }
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Health check failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 自動復旧機能の有効/無効を切り替え
   */
  public setAutoRecoveryEnabled(enabled: boolean): void {
    this.isAutoRecoveryEnabled = enabled;
    this.logger.info(`LSP proxy auto recovery ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled) {
      // 再起動カウンターをリセット
      this.restartCount = 0;
    }
  }

  /**
   * 手動での強制再起動
   */
  public async forceRestart(workspacePath: string = ''): Promise<boolean> {
    this.logger.info('Forcing LSP proxy restart');
    
    // 既存プロセスを停止
    await this.stopLSPProxy();
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 再起動フラグリセット
    this.restartCount = 0;
    this.isAutoRecoveryEnabled = true;
    
    // 再起動
    return await this.startLSPProxy(workspacePath);
  }

  /**
   * クリーンアップ（プロセス終了時）
   */
  async cleanup(): Promise<void> {
    this.stopHealthCheck();
    await this.stopLSPProxy();
    this.clearCache();
  }
}


