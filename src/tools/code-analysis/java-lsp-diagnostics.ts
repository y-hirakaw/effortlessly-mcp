/**
 * Java LSP診断・トラブルシューティング機能
 * Phase 2A - エラーハンドリング・自動復旧システム
 */

import { z } from 'zod';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { JavaLSP } from '../../services/lsp/java-lsp.js';
import { Logger } from '../../services/logger.js';

/**
 * Java LSP診断パラメータスキーマ
 */
export const JavaLSPDiagnosticsParamsSchema = z.object({
  operation: z.enum([
    'status',           // 現在の状態確認
    'health_check',     // ヘルスチェック実行
    'error_history',    // エラー履歴表示
    'recovery_stats',   // 復旧統計
    'troubleshoot',     // トラブルシューティング
    'reset_stats'       // 統計リセット
  ]).describe('診断操作の種類'),
  
  detailed: z.boolean().optional().default(false).describe('詳細情報を含めるか')
});

export type JavaLSPDiagnosticsParams = z.infer<typeof JavaLSPDiagnosticsParamsSchema>;

/**
 * Java LSP診断結果
 */
export interface JavaLSPDiagnosticsResult {
  operation: string;
  timestamp: string;
  workspace?: string;
  status?: {
    health: 'healthy' | 'warning' | 'error' | 'disconnected';
    uptime: number;
    errorRate: number;
    lastHealthCheck: string;
    circuitBreakerOpen: boolean;
  };
  errorHistory?: Array<{
    type: string;
    message: string;
    timestamp: string;
    recoverable: boolean;
    recovered?: boolean;
    context?: any;
  }>;
  recoveryStats?: {
    totalErrors: number;
    recoveredErrors: number;
    failedRecoveries: number;
    recoverySuccessRate: number;
    averageRecoveryTime: number;
    lastRecoveryTime?: string;
    errorsByType: Record<string, number>;
    recoverySuccessByType: Record<string, number>;
  };
  troubleshooting?: {
    issues: Array<{
      severity: 'critical' | 'warning' | 'info';
      category: string;
      description: string;
      recommendation: string;
      autoFixable: boolean;
    }>;
    systemInfo: {
      javaVersion?: string;
      jdtLSAvailable: boolean;
      workspaceValid: boolean;
      memoryUsage: number;
      diskSpace?: number;
    };
  };
  message: string;
}

/**
 * Java LSP診断ツール実装
 */
export async function javaLSPDiagnostics(params: JavaLSPDiagnosticsParams): Promise<JavaLSPDiagnosticsResult> {
  const logger = Logger.getInstance();
  const timestamp = new Date().toISOString();
  
  try {
    logger.info('Java LSP診断開始', { operation: params.operation, detailed: params.detailed });
    
    // ワークスペース情報取得
    const workspaceManager = WorkspaceManager.getInstance();
    const workspaceInfo = await workspaceManager.getCurrentWorkspace();
    
    if (!workspaceInfo?.name) {
      return {
        operation: params.operation,
        timestamp,
        message: 'アクティブなワークスペースが見つかりません。ワークスペースをアクティベートしてください。'
      };
    }

    // Phase 2A版：LSPクライアントインスタンスの直接作成
    // 注意：実際の統合版では適切なLSPマネージャーから取得する
    let javaLsp: JavaLSP;
    try {
      javaLsp = await JavaLSP.createWithAutoSetup({
        workspaceRoot: workspaceInfo.root_path,
        autoInstall: false
      });
    } catch (error) {
      return {
        operation: params.operation,
        timestamp,
        workspace: workspaceInfo.name,
        message: `Java LSPクライアントの作成に失敗: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // 操作に応じた診断実行
    // 注意：Phase 2Aでは基本診断のみ実装済み、包括的診断は未実装
    switch (params.operation) {
      case 'status':
        return await getBasicStatusDiagnostics(javaLsp, timestamp, workspaceInfo.name, params.detailed);
      
      case 'health_check':
        return await performBasicHealthCheck(javaLsp, timestamp, workspaceInfo.name);
      
      case 'error_history':
        return await getBasicErrorHistory(javaLsp, timestamp, workspaceInfo.name, params.detailed);
      
      case 'recovery_stats':
        return await getBasicRecoveryStats(javaLsp, timestamp, workspaceInfo.name);
      
      case 'troubleshoot':
        return await performBasicTroubleshooting(javaLsp, timestamp, workspaceInfo.name, params.detailed);
      
      case 'reset_stats':
        return await resetBasicStatistics(javaLsp, timestamp, workspaceInfo.name);
      
      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }

  } catch (error) {
    logger.error(`Java LSP診断エラー: ${error instanceof Error ? error.message : String(error)}`);
    return {
      operation: params.operation,
      timestamp,
      message: `診断エラー: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 基本ステータス診断 (Phase 2A版)
 */
async function getBasicStatusDiagnostics(
  javaLsp: JavaLSP, 
  timestamp: string, 
  workspace: string, 
  detailed: boolean
): Promise<JavaLSPDiagnosticsResult> {
  const diagnostics = javaLsp.getBasicDiagnostics();
  
  const result: JavaLSPDiagnosticsResult = {
    operation: 'status',
    timestamp,
    workspace,
    status: {
      health: diagnostics.status,
      uptime: diagnostics.uptime,
      errorRate: diagnostics.errorCount, // 基本版では累積エラー数
      lastHealthCheck: new Date().toISOString(),
      circuitBreakerOpen: false // 基本版では固定
    },
    message: `Java LSP基本状態: ${diagnostics.status.toUpperCase()}, エラー${diagnostics.errorCount}件`
  };

  if (detailed) {
    // 基本版では限定的な詳細情報のみ提供
    result.errorHistory = diagnostics.lastErrorTime ? [{
      type: 'basic_error',
      message: `最新エラー時刻: ${diagnostics.lastErrorTime.toISOString()}`,
      timestamp: diagnostics.lastErrorTime.toISOString(),
      recoverable: false,
      context: {}
    }] : [];
  }

  return result;
}

/**
 * 基本ヘルスチェック実行 (Phase 2A版)
 */
async function performBasicHealthCheck(
  javaLsp: JavaLSP, 
  timestamp: string, 
  workspace: string
): Promise<JavaLSPDiagnosticsResult> {
  // 基本的な接続テスト
  const state = javaLsp.getState();
  const isConnected = state.connected && state.initialized;
  
  let healthStatus: 'healthy' | 'warning' | 'error' | 'disconnected' = isConnected ? 'healthy' : 'disconnected';
  let healthMessage = 'ヘルスチェック完了';
  
  try {
    if (isConnected) {
      // 簡単なシンボル検索テスト
      await javaLsp.searchSymbols('test', { maxResults: 1 });
      healthMessage = 'LSP接続・機能正常';
    } else {
      healthMessage = 'LSP接続異常 - 再接続が必要';
      healthStatus = 'error';
    }
  } catch (error) {
    healthStatus = 'error';
    healthMessage = `LSP機能エラー: ${error instanceof Error ? error.message : String(error)}`;
  }

  const diagnostics = javaLsp.getBasicDiagnostics();
  
  return {
    operation: 'health_check',
    timestamp,
    workspace,
    status: {
      health: healthStatus,
      uptime: diagnostics.uptime,
      errorRate: diagnostics.errorCount, // 基本版では累積エラー数
      lastHealthCheck: new Date().toISOString(),
      circuitBreakerOpen: false // 基本版では固定
    },
    message: healthMessage
  };
}

/**
 * 基本エラー履歴取得 (Phase 2A版)
 */
async function getBasicErrorHistory(
  javaLsp: JavaLSP, 
  timestamp: string, 
  workspace: string, 
  _detailed: boolean  // Phase 2Aでは未使用
): Promise<JavaLSPDiagnosticsResult> {
  const diagnostics = javaLsp.getBasicDiagnostics();
  const errorHistory = diagnostics.lastErrorTime ? [{
    type: 'basic_error',
    message: `エラー記録: ${diagnostics.errorCount}件`,
    timestamp: diagnostics.lastErrorTime.toISOString(),
    recoverable: false,
    context: {}
  }] : [];
  
  return {
    operation: 'error_history',
    timestamp,
    workspace,
    errorHistory,
    message: `基本エラー履歴: ${diagnostics.errorCount}件の累積エラー`
  };
}

/**
 * 基本復旧統計取得 (Phase 2A版)
 */
async function getBasicRecoveryStats(
  _javaLsp: JavaLSP,  // Phase 2Aでは未使用
  timestamp: string, 
  workspace: string
): Promise<JavaLSPDiagnosticsResult> {
  // Phase 2Aでは復旧統計は未実装
  return {
    operation: 'recovery_stats',
    timestamp,
    workspace,
    message: 'Phase 2Aでは復旧統計は未実装です。基本診断を使用してください。'
  };
}

/**
 * 基本トラブルシューティング実行 (Phase 2A版)
 */
async function performBasicTroubleshooting(
  javaLsp: JavaLSP, 
  timestamp: string, 
  workspace: string, 
  _detailed: boolean  // Phase 2Aでは未使用
): Promise<JavaLSPDiagnosticsResult> {
  const diagnostics = javaLsp.getBasicDiagnostics();
  const state = javaLsp.getState();
  const issues: any[] = [];
  
  // 基本的な問題の分析
  if (!state.connected || !state.initialized) {
    issues.push({
      severity: 'critical',
      category: 'connection',
      description: 'LSPサーバーが接続されていません',
      recommendation: 'LSPサーバーを再起動してください',
      autoFixable: false
    });
  }
  
  if (diagnostics.errorCount > 5) {
    issues.push({
      severity: 'warning',
      category: 'high_error_count',
      description: `累積エラー数が多すぎます (${diagnostics.errorCount}件)`,
      recommendation: 'ワークスペースの設定とJavaファイルを確認してください',
      autoFixable: false
    });
  }

  // 基本システム情報収集
  const systemInfo = {
    jdtLSAvailable: true,
    workspaceValid: state.connected,
    memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) // MB
  };

  return {
    operation: 'troubleshoot',
    timestamp,
    workspace,
    troubleshooting: {
      issues,
      systemInfo
    },
    message: `基本トラブルシューティング完了: ${issues.length}件の問題を発見`
  };
}

/**
 * 基本統計リセット (Phase 2A版)
 */
async function resetBasicStatistics(
  _javaLsp: JavaLSP,  // Phase 2Aでは未使用
  timestamp: string, 
  workspace: string
): Promise<JavaLSPDiagnosticsResult> {
  // Phase 2Aでは統計リセット未実装
  return {
    operation: 'reset_stats',
    timestamp,
    workspace,
    message: 'Phase 2Aでは統計リセットは未実装です。参照機能のみ提供しています。'
  };
}

// Phase 2A注記: formatError と formatRecoveryStats は包括版で使用するため削除