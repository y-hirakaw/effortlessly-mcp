/**
 * LSP Proxy Server
 * HTTP REST APIでLSPサービスを提供
 */

import express from 'express';
import cors from 'cors';
import type { Server } from 'http';
// import type { SymbolInformation } from 'vscode-languageserver-protocol'; // 未使用のため削除
import { Logger } from '../logger.js';
import { LSPManager } from './lsp-manager.js';

/**
 * HTTP LSP Proxy Server
 */
export class LSPProxyServer {
  private app: express.Express;
  private server?: Server;
  private lspManager: LSPManager;
  private logger: Logger;

  constructor(
    private workspaceRoot: string,
    private port: number = 3001
  ) {
    this.logger = Logger.getInstance();
    this.app = express();
    this.lspManager = new LSPManager(workspaceRoot, this.logger);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * ミドルウェアを設定
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // リクエストログ
    this.app.use((req, _res, next) => {
      this.logger.info(`${req.method} ${req.path}`, { 
        body: req.body,
        query: req.query 
      });
      next();
    });
  }

  /**
   * ルートを設定
   */
  private setupRoutes(): void {
    // ヘルスチェック
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        workspace: this.workspaceRoot,
        timestamp: new Date().toISOString(),
        lsps: this.lspManager.getStatus()
      });
    });

    // シンボル検索
    this.app.post('/symbols/search', async (req, res) => {
      try {
        const { query, languages } = req.body;
        
        if (!query || typeof query !== 'string') {
          res.status(400).json({
            error: 'Missing or invalid query parameter'
          });
          return;
        }

        const symbols = await this.lspManager.searchSymbols(
          query, 
          languages || ['typescript']
        );

        res.json({
          query,
          languages: languages || 'all',
          total: symbols.length,
          symbols
        });
        
      } catch (error) {
        this.logger.error('Symbol search failed', error as Error);
        res.status(500).json({
          error: 'Symbol search failed',
          message: (error as Error).message
        });
      }
    });

    // 参照検索
    this.app.post('/references/find', async (req, res) => {
      try {
        const { filePath, position, includeDeclaration } = req.body;
        
        if (!filePath || !position) {
          res.status(400).json({
            error: 'Missing filePath or position parameters'
          });
          return;
        }

        const references = await this.lspManager.findReferences(
          filePath,
          position,
          includeDeclaration || false
        );

        res.json({
          filePath,
          position,
          total: references.length,
          references
        });
        
      } catch (error) {
        this.logger.error('Find references failed', error as Error);
        res.status(500).json({
          error: 'Find references failed',
          message: (error as Error).message
        });
      }
    });

    // LSP状態取得
    this.app.get('/lsps/status', (_req, res) => {
      res.json(this.lspManager.getStatus());
    });

    // 利用可能言語一覧
    this.app.get('/lsps/languages', (_req, res) => {
      res.json({
        available: this.lspManager.getAvailableLanguages()
      });
    });

    // エラーハンドリング
    this.app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error('Unhandled server error', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    });

    // 404ハンドリング
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path
      });
    });
  }

  /**
   * サーバーを開始
   */
  async start(): Promise<void> {
    try {
      // LSPマネージャーを初期化
      await this.lspManager.initialize();
      
      this.server = this.app.listen(this.port, 'localhost', () => {
        this.logger.info(`LSP Proxy Server started successfully on http://localhost:${this.port}`);
        this.logger.info(`Workspace: ${this.workspaceRoot}`);
      });

      // LSPマネージャーのイベントを監視
      this.lspManager.on('lsp-ready', (language) => {
        this.logger.info(`LSP ready: ${language}`);
      });

      this.lspManager.on('lsp-error', (language, error) => {
        this.logger.error(`LSP error: ${language}`, error);
      });

      this.lspManager.on('lsp-exit', (language) => {
        this.logger.warn(`LSP exited: ${language}`);
      });

    } catch (error) {
      this.logger.error('Failed to start LSP Proxy Server', error as Error);
      throw error;
    }
  }

  /**
   * サーバーを停止
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping LSP Proxy Server...');
    
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger.info('HTTP server stopped');
          resolve();
        });
      });
    }

    await this.lspManager.stopAll();
    this.logger.info('LSP Proxy Server stopped');
  }

  /**
   * グレースフルシャットダウンを設定
   */
  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}