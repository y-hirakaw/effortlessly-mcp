#!/usr/bin/env node

/**
 * LSP Proxy Server スタンドアロン実行ファイル
 * 独立したプロセスとしてHTTP LSP Proxyサーバーを起動
 */

// import { resolve } from 'path'; // 未使用のため削除
import { LSPProxyServer } from './services/lsp-proxy/proxy-server.js';
import { Logger } from './services/logger.js';

async function main() {
  const logger = Logger.getInstance();
  
  try {
    // ワークスペースのルートパスを取得（現在のディレクトリを使用）
    const workspaceRoot = process.argv[2] || process.cwd();
    const port = parseInt(process.argv[3]) || 3001;
    
    logger.info('Starting LSP Proxy Server', {
      workspaceRoot,
      port,
      nodeVersion: process.version
    });
    
    // LSP Proxy Serverを作成
    const proxyServer = new LSPProxyServer(workspaceRoot, port);
    
    // グレースフルシャットダウンを設定
    proxyServer.setupGracefulShutdown();
    
    // サーバーを開始
    await proxyServer.start();
    
  } catch (error) {
    logger.error('Failed to start LSP Proxy Server', error as Error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  Logger.getInstance().error('Unhandled promise rejection', error as Error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  Logger.getInstance().error('Uncaught exception', error);
  process.exit(1);
});

main().catch((error) => {
  Logger.getInstance().error('Main function failed', error);
  process.exit(1);
});