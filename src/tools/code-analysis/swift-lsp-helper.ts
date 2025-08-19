/**
 * Swift LSP Helper
 * Swift LSPインスタンスの共通管理とキャッシュ機構
 */

import { Logger } from '../../services/logger.js';
import type { SwiftLSP } from '../../services/lsp/swift-lsp.js';

// キャッシュされたSwiftLSPインスタンス
let cachedSwiftLsp: SwiftLSP | null = null;
let cachedWorkspaceRoot: string | null = null;

/**
 * Swift LSPインスタンスを取得または作成（シングルトン）
 */
export async function getOrCreateSwiftLSP(workspaceRoot: string, logger: Logger): Promise<SwiftLSP> {
  // SwiftLSP サービスを動的インポート（初回のみ）
  const { SwiftLSP } = await import('../../services/lsp/swift-lsp.js');
  
  // ワークスペースが変更された場合、または初回の場合のみ新規作成
  if (!cachedSwiftLsp || cachedWorkspaceRoot !== workspaceRoot) {
    logger.info(`Initializing SwiftLSP for workspace: ${workspaceRoot}`);
    
    // 既存のインスタンスがあれば切断
    if (cachedSwiftLsp) {
      try {
        await cachedSwiftLsp.disconnect();
        logger.info('Disconnected previous SwiftLSP instance');
      } catch (error) {
        logger.warn('Failed to disconnect previous SwiftLSP instance', { error });
      }
    }
    
    // 新しいインスタンスを作成
    cachedSwiftLsp = new SwiftLSP(workspaceRoot, logger);
    cachedWorkspaceRoot = workspaceRoot;
    
    // 接続を確立
    await cachedSwiftLsp.connect();
    logger.info(`Connected to SwiftLSP for workspace: ${workspaceRoot}`);
  } else {
    logger.debug(`Reusing existing SwiftLSP instance for workspace: ${workspaceRoot}`);
  }
  
  return cachedSwiftLsp;
}

/**
 * キャッシュをクリア（テスト用やリセット時）
 */
export async function clearSwiftLSPCache(logger: Logger): Promise<void> {
  if (cachedSwiftLsp) {
    try {
      await cachedSwiftLsp.disconnect();
      logger.info('SwiftLSP cache cleared and disconnected');
    } catch (error) {
      logger.warn('Failed to disconnect SwiftLSP during cache clear', { error });
    }
    cachedSwiftLsp = null;
    cachedWorkspaceRoot = null;
  }
}

/**
 * 現在のSwiftLSPインスタンスの状態を取得
 */
export function getSwiftLSPStatus(): {
  isConnected: boolean;
  workspaceRoot: string | null;
} {
  return {
    isConnected: cachedSwiftLsp !== null,
    workspaceRoot: cachedWorkspaceRoot
  };
}
