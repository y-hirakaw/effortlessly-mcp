/**
 * 多言語LSP統合管理
 * 複数のLSPサーバーを効率的に管理し、プロトコル分離を実現
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { basename } from 'path';
import { existsSync, readFileSync } from 'fs';
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
      // TypeScript LSPの場合、プロジェクト認識を確認して再試行
      if (this.config.language === 'typescript') {
        try {
          // 最初の試行
          let symbols = await this.sendRequest('workspace/symbol', { query });
          if (symbols && symbols.length > 0) {
            this.logger.info(`Found ${symbols.length} symbols for query: "${query}"`);
            return symbols;
          }
          
          // プロジェクト認識の問題の可能性があるため、再初期化を試行
          this.logger.info('No symbols found, attempting project recognition enhancement...');
          
          // プロジェクト再読み込みコマンドを送信
          await this.sendRequest('workspace/executeCommand', {
            command: '_typescript.reloadProjects',
            arguments: []
          });
          
          // 少し待機
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 再試行
          symbols = await this.sendRequest('workspace/symbol', { query });
          this.logger.info(`Found ${symbols?.length || 0} symbols for query: "${query}" after project reload`);
          return symbols || [];
          
        } catch (reloadError) {
          this.logger.warn('Project reload failed, using fallback approach', { error: (reloadError as Error).message });
          
          // フォールバック: 通常の検索を実行
          const symbols = await this.sendRequest('workspace/symbol', { query });
          return symbols || [];
        }
      } else {
        // 他の言語の場合は通常通り
        const symbols = await this.sendRequest('workspace/symbol', { query });
        this.logger.info(`Found ${symbols?.length || 0} symbols for query: "${query}"`);
        return symbols || [];
      }
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
          definition: { dynamicRegistration: false },
          completion: { dynamicRegistration: false },
          hover: { dynamicRegistration: false }
        },
        workspace: {
          symbol: { dynamicRegistration: false },
          didChangeConfiguration: { dynamicRegistration: false },
          didChangeWatchedFiles: { dynamicRegistration: false },
          executeCommand: { dynamicRegistration: false },
          workspaceFolders: true,
          configuration: true
        }
      },
      workspaceFolders: [
        {
          uri: `file://${this.workspaceRoot}`,
          name: basename(this.workspaceRoot)
        }
      ],
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
          allowIncompleteCompletions: true,
          importModuleSpecifier: 'shortest',
          includePackageJsonAutoImports: 'auto'
        },
        tsserver: {
          logLevel: 'info',
          logVerbosity: 'verbose',
          trace: 'verbose'
        }
      }
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
              includeCompletionsForModuleExports: true,
              importModuleSpecifier: 'shortest',
              includeCompletionsWithInsertText: true,
              allowIncompleteCompletions: true
            },
            suggest: {
              includeCompletionsForModuleExports: true,
              includeAutomaticOptionalChainCompletions: true
            },
            format: {
              enable: true
            },
            validate: {
              enable: true
            },
            workspaceSymbols: {
              scope: 'allOpenProjects'
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
      
      // 待機時間を追加してLSPの安定化を待つ
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 主要TypeScriptファイルを明示的に開く（プロジェクト認識を促進）
      const mainFiles = [
        `${this.workspaceRoot}/src/index.ts`,
        `${this.workspaceRoot}/tsconfig.json`,
        `${this.workspaceRoot}/package.json`
      ];
      
      for (const filePath of mainFiles) {
        try {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            this.sendNotification('textDocument/didOpen', {
              textDocument: {
                uri: `file://${filePath}`,
                languageId: filePath.endsWith('.ts') ? 'typescript' : filePath.endsWith('.json') ? 'json' : 'plaintext',
                version: 1,
                text: content
              }
            });
            this.logger.info(`Opened file for project recognition: ${filePath}`);
          } else {
            this.logger.warn(`Project file not found: ${filePath}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to open file ${filePath}`, { error: (error as Error).message });
        }
      }
      
      // TypeScript特有のプロジェクト検証
      const tsConfigPath = `${this.workspaceRoot}/tsconfig.json`;
      const packageJsonPath = `${this.workspaceRoot}/package.json`;
      
      if (!existsSync(tsConfigPath)) {
        this.logger.warn('tsconfig.json not found - this may cause "No Project" errors');
      } else {
        try {
          const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf8'));
          this.logger.info('TypeScript configuration loaded', {
            include: tsConfig.include,
            compilerOptions: tsConfig.compilerOptions ? Object.keys(tsConfig.compilerOptions) : []
          });
        } catch (error) {
          this.logger.warn('Failed to parse tsconfig.json', { error: (error as Error).message });
        }
      }
      
      if (!existsSync(packageJsonPath)) {
        this.logger.warn('package.json not found - this may affect project recognition');
      }
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