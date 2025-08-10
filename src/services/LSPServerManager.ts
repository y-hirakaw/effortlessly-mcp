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

  constructor() {}

  /**
   * LSPプロキシサーバーを起動
   */
  async startLSPProxy(workspacePath: string): Promise<boolean> {
    if (this.proxyProcess || this.isStarting) {
      this.logger.info('LSP proxy already running or starting');
      return true;
    }

    const configManager = new ConfigManager();
    const lspConfig = await configManager.getLSPServerConfig();

    if (!lspConfig.proxy_server.enabled || !lspConfig.proxy_server.auto_start) {
      this.logger.info('LSP proxy auto-start disabled');
      return false;
    }

    try {
      this.isStarting = true;
      
      // ポートが使用中かチェック
      const isPortInUse = await this.checkPortInUse(lspConfig.proxy_server.port);
      if (isPortInUse) {
        this.logger.info(`LSP proxy already running on port ${lspConfig.proxy_server.port}`);
        this.isStarting = false;
        return true;
      }

      this.logger.info('Starting LSP proxy server', {
        workspacePath,
        port: lspConfig.proxy_server.port,
      });

      // LSPプロキシサーバーを起動
      const proxyPath = await this.findLSPProxyExecutable();
      if (!proxyPath) {
        throw new Error('LSP proxy executable not found');
      }

      this.proxyProcess = spawn('node', [proxyPath, workspacePath, lspConfig.proxy_server.port.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // プロセスイベントリスナー設定
      this.setupProcessListeners();

      // 起動確認
      const started = await this.waitForStartup(lspConfig.proxy_server.startup_timeout);
      this.isStarting = false;

      if (started) {
        this.logger.info('LSP proxy server started successfully', {
          pid: this.proxyProcess?.pid,
          port: lspConfig.proxy_server.port,
        });
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
      this.logger.info('LSP proxy server stopped');
    } catch (error) {
      this.logger.error('Failed to stop LSP proxy server', error as Error);
    }
  }

  /**
   * LSPプロキシサーバーの状態確認
   */
  async isProxyRunning(): Promise<boolean> {
    if (!this.proxyProcess) {
      const configManager = new ConfigManager();
      const lspConfig = await configManager.getLSPServerConfig();
      return await this.checkPortInUse(lspConfig.proxy_server.port);
    }

    return !this.proxyProcess.killed && this.proxyProcess.exitCode === null;
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
    const configManager = new ConfigManager();
    const lspConfig = await configManager.getLSPServerConfig();
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 500;
      
      const checkHealth = async () => {
        try {
          const response = await fetch(`http://${lspConfig.proxy_server.host}:${lspConfig.proxy_server.port}/health`);
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
    });

    this.proxyProcess.on('error', (error) => {
      this.logger.error('LSP proxy process error', error);
      this.proxyProcess = null;
    });
  }

  /**
   * クリーンアップ（プロセス終了時）
   */
  async cleanup(): Promise<void> {
    await this.stopLSPProxy();
  }
}


