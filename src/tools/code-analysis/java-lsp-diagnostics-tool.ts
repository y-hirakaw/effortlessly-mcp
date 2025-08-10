/**
 * Java LSP診断・トラブルシューティングツール
 * Phase 2A - エラーハンドリング・自動復旧システム用MCP Tool
 */

import { ITool, IToolMetadata } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { 
  javaLSPDiagnostics, 
  JavaLSPDiagnosticsParams,
  JavaLSPDiagnosticsResult 
} from './java-lsp-diagnostics.js';

/**
 * Java LSP診断ツールのメタデータ
 */
const METADATA: IToolMetadata = {
  name: 'java_lsp_diagnostics',
  description: 'Java LSP診断・トラブルシューティング・自動復旧システムの管理',
  parameters: {
    operation: {
      type: 'string',
      description: '診断操作の種類 (status, health_check, error_history, recovery_stats, troubleshoot, reset_stats)',
      required: true
    },
    detailed: {
      type: 'boolean',
      description: '詳細情報を含めるか',
      required: false
    }
  }
};

/**
 * Java LSP診断ツール実装
 */
export class JavaLSPDiagnosticsTool implements ITool {
  public readonly metadata = METADATA;
  private readonly logger = Logger.getInstance();

  async execute(params: JavaLSPDiagnosticsParams) {
    this.logger.info('Java LSP診断ツール実行', { 
      operation: params.operation,
      detailed: params.detailed
    });

    try {
      const result = await javaLSPDiagnostics(params);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: this.formatResult(result)
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Java LSP診断ツールエラー: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: `診断エラー: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 診断結果をフォーマット
   */
  private formatResult(result: JavaLSPDiagnosticsResult): string {
    let output = `## Java LSP 診断結果\n`;
    output += `**操作**: ${result.operation}\n`;
    output += `**タイムスタンプ**: ${result.timestamp}\n`;
    
    if (result.workspace) {
      output += `**ワークスペース**: ${result.workspace}\n`;
    }
    
    output += `**メッセージ**: ${result.message}\n\n`;

    // ステータス情報
    if (result.status) {
      output += `### 📊 ステータス\n`;
      output += `- **健康状態**: ${this.getHealthEmoji(result.status.health)} ${result.status.health.toUpperCase()}\n`;
      output += `- **稼働時間**: ${this.formatUptime(result.status.uptime)}\n`;
      output += `- **エラー率**: ${result.status.errorRate}/分\n`;
      output += `- **最終ヘルスチェック**: ${new Date(result.status.lastHealthCheck).toLocaleString('ja-JP')}\n`;
      output += `- **サーキットブレーカー**: ${result.status.circuitBreakerOpen ? '🔴 開' : '🟢 閉'}\n\n`;
    }

    // 復旧統計
    if (result.recoveryStats) {
      output += `### 🔧 復旧統計\n`;
      output += `- **総エラー数**: ${result.recoveryStats.totalErrors}件\n`;
      output += `- **復旧成功**: ${result.recoveryStats.recoveredErrors}件\n`;
      output += `- **復旧失敗**: ${result.recoveryStats.failedRecoveries}件\n`;
      output += `- **成功率**: ${result.recoveryStats.recoverySuccessRate}%\n`;
      output += `- **平均復旧時間**: ${result.recoveryStats.averageRecoveryTime}ms\n`;
      
      if (result.recoveryStats.lastRecoveryTime) {
        output += `- **最終復旧時刻**: ${new Date(result.recoveryStats.lastRecoveryTime).toLocaleString('ja-JP')}\n`;
      }
      
      if (Object.keys(result.recoveryStats.errorsByType).length > 0) {
        output += `\n**エラー種別**:\n`;
        for (const [type, count] of Object.entries(result.recoveryStats.errorsByType)) {
          const successCount = result.recoveryStats.recoverySuccessByType[type] || 0;
          const successRate = count > 0 ? Math.round((successCount / count) * 100) : 0;
          output += `  - ${type}: ${count}件 (復旧率 ${successRate}%)\n`;
        }
      }
      output += `\n`;
    }

    // エラー履歴
    if (result.errorHistory && result.errorHistory.length > 0) {
      output += `### ⚠️ エラー履歴 (最新${result.errorHistory.length}件)\n`;
      for (const error of result.errorHistory.slice(-10)) {
        const timestamp = new Date(error.timestamp).toLocaleString('ja-JP');
        const recoveryIcon = error.recoverable ? (error.recovered ? '🔧' : '⏳') : '❌';
        output += `${recoveryIcon} **${error.type}** (${timestamp})\n`;
        output += `   ${error.message}\n`;
        if (error.context && (error.context.operation || error.context.file)) {
          output += `   📍 ${error.context.operation || ''}${error.context.file ? ` - ${error.context.file}` : ''}\n`;
        }
        output += `\n`;
      }
    }

    // トラブルシューティング
    if (result.troubleshooting) {
      output += `### 🔍 トラブルシューティング\n`;
      
      if (result.troubleshooting.issues.length > 0) {
        output += `**発見された問題**:\n`;
        for (const issue of result.troubleshooting.issues) {
          const severityIcon = this.getSeverityEmoji(issue.severity);
          output += `${severityIcon} **${issue.category}** (${issue.severity})\n`;
          output += `   ${issue.description}\n`;
          output += `   💡 推奨: ${issue.recommendation}\n`;
          output += `   ${issue.autoFixable ? '🔧 自動修復可能' : '👤 手動対応必要'}\n\n`;
        }
      }
      
      if (result.troubleshooting.systemInfo) {
        output += `**システム情報**:\n`;
        const info = result.troubleshooting.systemInfo;
        if (info.javaVersion) output += `- Java版: ${info.javaVersion}\n`;
        output += `- JDT LS利用可能: ${info.jdtLSAvailable ? '✅' : '❌'}\n`;
        output += `- ワークスペース有効: ${info.workspaceValid ? '✅' : '❌'}\n`;
        output += `- メモリ使用量: ${info.memoryUsage}MB\n`;
        if (info.diskSpace) output += `- ディスク容量: ${info.diskSpace}MB\n`;
        output += `\n`;
      }
    }

    return output;
  }

  /**
   * 健康状態の絵文字を取得
   */
  private getHealthEmoji(health: string): string {
    switch (health) {
      case 'healthy': return '🟢';
      case 'warning': return '🟡';
      case 'error': return '🔴';
      case 'disconnected': return '⚫';
      default: return '❓';
    }
  }

  /**
   * 重要度の絵文字を取得
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  }

  /**
   * 稼働時間をフォーマット
   */
  private formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours}時間${minutes}分${remainingSeconds}秒`;
  }
}