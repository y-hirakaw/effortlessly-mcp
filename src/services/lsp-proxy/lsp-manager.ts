/**
 * 多言語LSP統合管理
 * 複数のLSPサーバーを効率的に管理し、プロトコル分離を実現
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { basename } from 'path';
import type { 
  SymbolInformation, 
  Location, 
  Position 
} from 'vscode-languageserver-protocol';
import { Logger } from '../logger.js';
import { 
  LSPServerConfig, 
  LSPAvailabilityChecker, 
  LanguageDetector 
} from './lsp-config.js';

/**
 * 個別LSPプロセス管理
 */
class LSPProcess extends EventEmitter {
  private process?: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private initialized = false;
  private connected = false;

  constructor(
    private config: LSPServerConfig,
    private workspaceRoot: string,
    private logger: Logger
  ) {
    super();
  }

  /**
   * LSPプロセスを開始
   */
  async start(): Promise<void> {
    try {
      this.logger.info(`Starting LSP: ${this.config.displayName}`);
      
      this.process = spawn(this.config.command, this.config.args, {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error(`Failed to establish stdio streams for ${this.config.language}`);
      }

      this.setupProcessHandlers();
      this.setupOutputParser();
      this.connected = true;

      // 初期化実行
      await this.initialize();
      
      this.logger.info(`LSP started successfully: ${this.config.displayName}`);
      this.emit('ready');
      
    } catch (error) {
      this.logger.error(`Failed to start LSP: ${this.config.displayName}`, error as Error);
      throw error;
    }
  }

  /**
   * LSPプロセスを停止
   */
  async stop(): Promise<void> {
    if (this.process) {
      try {
        await this.sendRequest('shutdown', {});
        this.sendNotification('exit', {});
      } catch {
        // 正常終了に失敗した場合は強制終了
      }
      
      this.process.kill('SIGTERM');
      this.process = undefined;
    }
    
    this.connected = false;
    this.initialized = false;
    this.pendingRequests.clear();
    this.emit('stopped');
  }

  /**
   * ワークスペースシンボルを検索
   */
  async searchWorkspaceSymbols(query: string): Promise<SymbolInformation[]> {
    if (!this.initialized) {
      throw new Error(`LSP not initialized: ${this.config.language}`);
    }

    this.logger.info(`Searching workspace symbols for query: "${query}" in ${this.config.language}`);
    
    try {
      const symbols = await this.sendRequest('workspace/symbol', { query });
      this.logger.info(`Found ${symbols?.length || 0} symbols for query: "${query}"`);
      return symbols || [];
    } catch (error) {
      this.logger.error(`Workspace symbol search failed for "${query}"`, error as Error);
      return [];
    }
  }

  /**
   * 参照を検索
   */
  async findReferences(uri: string, position: Position, includeDeclaration = false): Promise<Location[]> {
    if (!this.initialized) {
      throw new Error(`LSP not initialized: ${this.config.language}`);
    }

    const params = {
      textDocument: { uri },
      position,
      context: { includeDeclaration }
    };

    const references = await this.sendRequest('textDocument/references', params);
    return references || [];
  }

  /**
   * LSPサーバーを初期化
   */
  private async initialize(): Promise<void> {
    const initParams = {
      processId: process.pid,
      rootUri: `file://${this.workspaceRoot}`,
      rootPath: this.workspaceRoot,
      capabilities: {
        textDocument: {
          documentSymbol: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          definition: { dynamicRegistration: false }
        },
        workspace: {
          symbol: { dynamicRegistration: false },
          didChangeConfiguration: { dynamicRegistration: false },
          didChangeWatchedFiles: { dynamicRegistration: false }
        }
      },
      workspaceFolders: [
        {
          uri: `file://${this.workspaceRoot}`,
          name: basename(this.workspaceRoot)
        }
      ]
    };

    const result = await this.sendRequest('initialize', initParams);
    this.sendNotification('initialized', {});
    
    // TypeScript LSP向けの追加設定
    if (this.config.language === 'typescript') {
      // 重要なプロジェクトファイルを明示的に通知
      this.sendNotification('workspace/didChangeWatchedFiles', {
        changes: [
          {
            uri: `file://${this.workspaceRoot}/package.json`,
            type: 1 // Created
          },
          {
            uri: `file://${this.workspaceRoot}/tsconfig.json`,
            type: 1 // Created
          }
        ]
      });
      
      // TypeScript設定を送信
      this.sendNotification('workspace/didChangeConfiguration', {
        settings: {
          typescript: {
            preferences: {
              includePackageJsonAutoImports: 'auto',
              includeCompletionsForModuleExports: true
            },
            suggest: {
              includeCompletionsForModuleExports: true
            }
          },
          javascript: {
            preferences: {
              includePackageJsonAutoImports: 'auto'
            }
          }
        }
      });
      
      // プロジェクト強制再読み込み要求
      this.logger.info('Forcing TypeScript project reload...');
    }
    
    this.initialized = true;
    
    this.logger.info(`LSP initialized: ${this.config.displayName}`, {
      capabilities: !!result.capabilities,
      workspaceRoot: this.workspaceRoot,
      serverCapabilities: result.capabilities
    });
  }

  /**
   * LSPリクエストを送信
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error(`LSP process not available: ${this.config.language}`));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      // 10秒でタイムアウト
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request timeout: ${method} (${this.config.language})`));
        }
      }, 10000);

      const message = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
      this.process.stdin.write(header + message, 'utf8');
    });
  }

  /**
   * LSP通知を送信
   */
  private sendNotification(method: string, params: any): void {
    if (!this.process?.stdin) return;

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    const message = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
    this.process.stdin.write(header + message, 'utf8');
  }

  /**
   * プロセスイベントハンドラーを設定
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.on('error', (error) => {
      this.logger.error(`LSP process error (${this.config.language})`, error);
      this.emit('error', error);
    });

    this.process.on('exit', (code, signal) => {
      this.logger.info(`LSP process exited (${this.config.language})`, { code, signal });
      this.connected = false;
      this.initialized = false;
      this.emit('exit', code);
    });

    this.process.stderr?.on('data', (data) => {
      this.logger.warn(`LSP stderr (${this.config.language})`, { data: data.toString() });
    });
  }

  /**
   * 標準出力パーサーを設定
   */
  private setupOutputParser(): void {
    if (!this.process?.stdout) return;

    let buffer = '';

    this.process.stdout.on('data', (data) => {
      buffer += data.toString('utf8');

      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.slice(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);

        if (!contentLengthMatch) {
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }

        const contentLength = parseInt(contentLengthMatch[1], 10);
        const messageStart = headerEnd + 4;

        if (buffer.length < messageStart + contentLength) {
          break;
        }

        const messageContent = buffer.slice(messageStart, messageStart + contentLength);
        buffer = buffer.slice(messageStart + contentLength);

        try {
          const message = JSON.parse(messageContent);
          this.handleMessage(message);
        } catch (error) {
          this.logger.error(`Failed to parse LSP message (${this.config.language})`, error as Error);
        }
      }
    });
  }

  /**
   * LSPメッセージを処理
   */
  private handleMessage(message: any): void {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(`LSP Error (${this.config.language}): ${message.error.message}`));
      } else {
        pending.resolve(message.result);
      }
    }
    // 通知は無視（必要に応じて後で実装）
  }

  /**
   * プロセス状態を取得
   */
  getState() {
    return {
      language: this.config.language,
      connected: this.connected,
      initialized: this.initialized,
      pid: this.process?.pid
    };
  }
}

/**
 * LSPマネージャー - 複数言語のLSPプロセスを管理
 */
export class LSPManager extends EventEmitter {
  private processes = new Map<string, LSPProcess>();
  private availableConfigs: LSPServerConfig[] = [];

  constructor(
    private workspaceRoot: string,
    private logger: Logger = Logger.getInstance()
  ) {
    super();
  }

  /**
   * LSPマネージャーを初期化
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing LSP Manager');

    // 利用可能なLSPサーバーを検出
    this.availableConfigs = await LSPAvailabilityChecker.getAvailableLSPs();

    this.logger.info(`Found ${this.availableConfigs.length} available LSP servers`, {
      languages: this.availableConfigs.map(c => c.language)
    });

    // 必須LSPの確認
    const { missing } = await LSPAvailabilityChecker.checkRequiredLSPs();
    if (missing.length > 0) {
      this.logger.warn('Missing required LSP servers', {
        missing: missing.map(c => c.displayName)
      });
    }
  }

  /**
   * 指定言語のLSPプロセスを開始
   */
  async startLSP(language: string): Promise<void> {
    if (this.processes.has(language)) {
      return; // 既に開始済み
    }

    const config = this.availableConfigs.find(c => c.language === language);
    if (!config) {
      throw new Error(`LSP not available for language: ${language}`);
    }

    const lspProcess = new LSPProcess(config, this.workspaceRoot, this.logger);

    lspProcess.on('ready', () => {
      this.emit('lsp-ready', language);
    });

    lspProcess.on('error', (error) => {
      this.emit('lsp-error', language, error);
    });

    lspProcess.on('exit', () => {
      this.processes.delete(language);
      this.emit('lsp-exit', language);
    });

    await lspProcess.start();
    this.processes.set(language, lspProcess);
  }

  /**
   * 指定言語のLSPプロセスを停止
   */
  async stopLSP(language: string): Promise<void> {
    const process = this.processes.get(language);
    if (process) {
      await process.stop();
      this.processes.delete(language);
    }
  }

  /**
   * 全LSPプロセスを停止
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map(lang => this.stopLSP(lang));
    await Promise.all(stopPromises);
  }

  /**
   * シンボル検索（複数言語対応）
   */
  async searchSymbols(query: string, languages?: string[]): Promise<SymbolInformation[]> {
    const targetLanguages = languages || Array.from(this.processes.keys());
    const results: SymbolInformation[] = [];

    for (const language of targetLanguages) {
      try {
        // 必要に応じてLSPを開始
        if (!this.processes.has(language)) {
          await this.startLSP(language);
        }

        const process = this.processes.get(language);
        if (process) {
          const symbols = await process.searchWorkspaceSymbols(query);
          results.push(...symbols);
        }
      } catch (error) {
        this.logger.warn(`Symbol search failed for ${language}`, { error: (error as Error).message });
      }
    }

    return results;
  }

  /**
   * 参照検索
   */
  async findReferences(filePath: string, position: Position, includeDeclaration = false): Promise<Location[]> {
    const language = LanguageDetector.detectLanguage(filePath);
    if (language === 'unknown') {
      return [];
    }

    try {
      // 必要に応じてLSPを開始
      if (!this.processes.has(language)) {
        await this.startLSP(language);
      }

      const process = this.processes.get(language);
      if (process) {
        const uri = `file://${filePath}`;
        return await process.findReferences(uri, position, includeDeclaration);
      }
    } catch (error) {
      this.logger.warn(`Find references failed for ${filePath}`, { error: (error as Error).message });
    }

    return [];
  }

  /**
   * 利用可能な言語一覧を取得
   */
  getAvailableLanguages(): string[] {
    return this.availableConfigs.map(c => c.language);
  }

  /**
   * LSPプロセス状態を取得
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [language, process] of this.processes) {
      status[language] = process.getState();
    }

    return {
      available: this.availableConfigs.map(c => c.language),
      running: status,
      workspaceRoot: this.workspaceRoot
    };
  }
}