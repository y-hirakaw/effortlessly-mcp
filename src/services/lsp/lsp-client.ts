/**
 * LSPクライアント基盤実装
 * 外部LSPサーバーとの通信を管理する基底クラス
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { 
  InitializeParams,
  InitializeResult,
  DocumentSymbolParams,
  SymbolInformation,
  ReferenceParams,
  Location,
  Position
} from 'vscode-languageserver-protocol';
import { Logger } from '../logger.js';
import type { LSPServerConfig, LSPClientState } from './types.js';

/**
 * LSPクライアント基盤クラス
 * 任意のLSPサーバーとの通信を抽象化
 */
export abstract class LSPClientBase extends EventEmitter {
  protected process?: ChildProcess;
  protected requestId = 0;
  protected pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void; }>();
  protected state: LSPClientState = {
    connected: false,
    initialized: false,
    lastActivity: new Date()
  };

  constructor(
    protected config: LSPServerConfig,
    protected logger: Logger = Logger.getInstance()
  ) {
    super();
  }

  /**
   * LSPサーバーを起動し接続を確立
   */
  async connect(): Promise<void> {
    try {
      this.logger.info(`LSP: Starting ${this.config.name} server`);
      
      // プロセスを起動
      this.process = spawn(this.config.command, this.config.args, {
        cwd: this.config.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error('Failed to establish stdio streams');
      }

      // プロセスイベントを設定
      this.setupProcessHandlers();
      
      // 標準出力をパース
      this.setupOutputParser();

      this.state.connected = true;
      this.state.lastActivity = new Date();
      
      // 初期化実行
      await this.initialize();
      
      this.logger.info(`LSP: ${this.config.name} server connected and initialized`);
      this.emit('connected');
      
    } catch (error) {
      this.state.errorState = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`LSP: Failed to connect to ${this.config.name}`, error as Error);
      throw error;
    }
  }

  /**
   * LSPサーバーとの接続を切断
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.logger.info(`LSP: Disconnecting from ${this.config.name} server`);
      
      // 正常終了リクエストを送信
      try {
        await this.sendRequest('shutdown', {});
        this.sendNotification('exit', {});
      } catch (error) {
        this.logger.warn('LSP: Error during graceful shutdown', { error: (error as Error).message });
      }

      // プロセス終了
      this.process.kill('SIGTERM');
      this.process = undefined;
    }

    this.state.connected = false;
    this.state.initialized = false;
    this.pendingRequests.clear();
    
    this.emit('disconnected');
  }

  /**
   * LSPサーバーの状態を取得
   */
  getState(): LSPClientState {
    return { ...this.state };
  }

  /**
   * ドキュメントのシンボル情報を取得
   */
  async getDocumentSymbols(uri: string): Promise<SymbolInformation[]> {
    if (!this.state.initialized) {
      throw new Error('LSP client not initialized');
    }

    const params: DocumentSymbolParams = {
      textDocument: { uri }
    };

    try {
      const symbols = await this.sendRequest('textDocument/documentSymbol', params);
      this.state.lastActivity = new Date();
      return symbols || [];
    } catch (error) {
      this.logger.error('LSP: Failed to get document symbols', error as Error);
      throw error;
    }
  }

  /**
   * シンボルの参照を検索
   */
  async findReferences(uri: string, position: Position, includeDeclaration = false): Promise<Location[]> {
    if (!this.state.initialized) {
      throw new Error('LSP client not initialized');
    }

    const params: ReferenceParams = {
      textDocument: { uri },
      position,
      context: { includeDeclaration }
    };

    try {
      const references = await this.sendRequest('textDocument/references', params);
      this.state.lastActivity = new Date();
      return references || [];
    } catch (error) {
      this.logger.error('LSP: Failed to find references', error as Error);
      throw error;
    }
  }

  /**
   * LSPサーバーを初期化
   */
  protected async initialize(): Promise<void> {
    const initParams: InitializeParams = {
      processId: process.pid,
      rootUri: `file://${this.config.workspaceRoot}`,
      capabilities: {
        textDocument: {
          documentSymbol: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
          hover: { dynamicRegistration: false }
        },
        workspace: {
          symbol: { dynamicRegistration: false }
        }
      }
    };

    try {
      this.logger.info('LSP: Sending initialize request...');
      const result: InitializeResult = await this.sendRequest('initialize', initParams);
      this.logger.info('LSP: Initialize request completed, sending initialized notification...');
      
      this.sendNotification('initialized', {});
      this.logger.info('LSP: Initialized notification sent');
      
      this.state.initialized = true;
      this.logger.info(`LSP: ${this.config.name} initialized successfully`, { 
        serverCapabilities: !!result.capabilities,
        documentSymbol: !!result.capabilities?.textDocumentSync
      });
      
    } catch (error) {
      this.logger.error('LSP: Initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * LSPリクエストを送信
   */
  protected async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('LSP process not available'));
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

      // 10秒でタイムアウト（初期化の時間を増やす）
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.logger.warn(`LSP request timeout: ${method} (${id})`);
          reject(new Error(`LSP request timeout: ${method}`));
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
  protected sendNotification(method: string, params: any): void {
    if (!this.process?.stdin) {
      this.logger.warn('LSP: Cannot send notification, process not available');
      return;
    }

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
  protected setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.on('error', (error) => {
      this.state.errorState = error.message;
      this.logger.error('LSP: Process error', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code, signal) => {
      this.logger.info(`LSP: Process exited with code ${code}, signal ${signal}`);
      this.state.connected = false;
      this.state.initialized = false;
      this.emit('disconnected');
    });

    this.process.stderr?.on('data', (data) => {
      this.logger.warn('LSP: stderr', data.toString());
    });
  }

  /**
   * 標準出力パーサーを設定
   */
  protected setupOutputParser(): void {
    if (!this.process?.stdout) return;

    let buffer = '';

    this.process.stdout.on('data', (data: Buffer) => {
      buffer += data.toString('utf8');
      
      // Content-Lengthヘッダーをパース
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = buffer.slice(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        
        if (!contentLengthMatch) {
          this.logger.warn('LSP: Invalid header received');
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }

        const contentLength = parseInt(contentLengthMatch[1], 10);
        const messageStart = headerEnd + 4;
        
        if (buffer.length < messageStart + contentLength) {
          // メッセージが不完全
          break;
        }

        const messageContent = buffer.slice(messageStart, messageStart + contentLength);
        buffer = buffer.slice(messageStart + contentLength);

        try {
          const message = JSON.parse(messageContent);
          this.handleMessage(message);
        } catch (error) {
          this.logger.error('LSP: Failed to parse message', error as Error);
        }
      }
    });
  }

  /**
   * LSPメッセージを処理
   */
  protected handleMessage(message: any): void {
    this.state.lastActivity = new Date();
    
    // より詳細なログ情報を提供
    if (message.id !== undefined) {
      this.logger.info('LSP: Received response', { 
        id: message.id, 
        hasError: !!message.error,
        hasResult: !!message.result,
        resultType: message.result ? typeof message.result : undefined,
        resultLength: Array.isArray(message.result) ? message.result.length : undefined,
        errorCode: message.error?.code,
        errorMessage: message.error?.message?.substring(0, 200) // エラーメッセージを切り詰め
      });
    } else if (message.method) {
      this.logger.info('LSP: Received notification', { 
        method: message.method,
        hasParams: !!message.params
      });
    }

    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      // レスポンス処理
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        const errorDetail = {
          code: message.error.code,
          message: message.error.message,
          data: message.error.data
        };
        this.logger.error('LSP: Received error response', new Error(`LSP Error: ${JSON.stringify(errorDetail)}`));
        pending.reject(new Error(`LSP Error: ${message.error.message} (Code: ${message.error.code || 'unknown'})`));
      } else {
        // 成功レスポンスの詳細情報
        const resultInfo = {
          type: typeof message.result,
          isArray: Array.isArray(message.result),
          length: Array.isArray(message.result) ? message.result.length : undefined,
          isEmpty: Array.isArray(message.result) ? message.result.length === 0 : !message.result
        };
        this.logger.info('LSP: Received successful response', resultInfo);
        pending.resolve(message.result);
      }
    } else if (message.method) {
      // 通知処理 - より詳細なログ
      this.logger.info(`LSP: Processing notification: ${message.method}`, {
        hasParams: !!message.params,
        paramsType: message.params ? typeof message.params : undefined
      });
      this.emit('notification', message.method, message.params);
    } else {
      // 予期しないメッセージ形式
      this.logger.warn('LSP: Received unexpected message format', {
        hasId: message.id !== undefined,
        hasMethod: !!message.method,
        hasError: !!message.error,
        hasResult: !!message.result
      });
    }
  }

  /**
   * URIからファイルパスを変換
   */
  protected uriToPath(uri: string): string {
    return uri.replace(/^file:\/\//, '');
  }

  /**
   * ファイルパスからURIを変換
   */
  protected pathToUri(path: string): string {
    return `file://${path}`;
  }
}