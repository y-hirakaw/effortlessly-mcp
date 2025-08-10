/**
 * Java LSP基本診断ツール
 * Phase 2A - 簡略版エラーハンドリング・診断システム
 */

import { ITool, IToolMetadata } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { JavaLSP } from '../../services/lsp/java-lsp.js';
import { z } from 'zod';

/**
 * 基本診断パラメータスキーマ
 */
export const JavaLSPBasicDiagnosticsParamsSchema = z.object({
  detailed: z.boolean().optional().default(false).describe('詳細情報を含めるか')
});

export type JavaLSPBasicDiagnosticsParams = z.infer<typeof JavaLSPBasicDiagnosticsParamsSchema>;

/**
 * Java LSP基本診断ツールのメタデータ
 */
const METADATA: IToolMetadata = {
  name: 'java_lsp_basic_diagnostics',
  description: 'Java LSP基本診断・ステータス確認（Phase 2A版）',
  parameters: {
    detailed: {
      type: 'boolean',
      description: '詳細情報を含めるか',
      required: false
    }
  }
};

/**
 * Java LSP基本診断ツール実装
 */
export class JavaLSPBasicDiagnosticsTool implements ITool {
  public readonly metadata = METADATA;
  private readonly logger = Logger.getInstance();

  async execute(params: JavaLSPBasicDiagnosticsParams) {
    this.logger.info('Java LSP基本診断ツール実行', { detailed: params.detailed });

    try {
      // ワークスペース情報取得
      const workspaceManager = WorkspaceManager.getInstance();
      const workspaceInfo = await workspaceManager.getCurrentWorkspace();
      
      if (!workspaceInfo?.name) {
        return {
          content: [
            {
              type: 'text' as const,
              text: '❌ アクティブなワークスペースが見つかりません。\nワークスペースをアクティベートしてください。'
            }
          ]
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
          content: [
            {
              type: 'text' as const,
              text: `❌ Java LSPクライアントの作成に失敗しました。\n**ワークスペース**: ${workspaceInfo.name}\n**エラー**: ${error instanceof Error ? error.message : String(error)}\n\nJava環境とJDTサーバーを確認してください。`
            }
          ]
        };
      }

      // 基本診断実行
      const diagnostics = javaLsp.getBasicDiagnostics();
      
      let output = `## ☕ Java LSP 基本診断結果\n\n`;
      output += `**ワークスペース**: ${workspaceInfo.name}\n`;
      output += `**実行時刻**: ${new Date().toLocaleString('ja-JP')}\n\n`;

      // ステータス表示
      const statusIcon = this.getStatusIcon(diagnostics.status);
      output += `### ${statusIcon} ステータス: ${diagnostics.status.toUpperCase()}\n\n`;
      
      output += `- **稼働時間**: ${this.formatUptime(diagnostics.uptime)}\n`;
      output += `- **エラー数**: ${diagnostics.errorCount}件\n`;
      
      if (diagnostics.lastErrorTime) {
        output += `- **最終エラー**: ${diagnostics.lastErrorTime.toLocaleString('ja-JP')}\n`;
      } else {
        output += `- **最終エラー**: なし ✅\n`;
      }

      // 詳細情報
      if (params.detailed) {
        const state = javaLsp.getState();
        output += `\n### 🔧 詳細情報\n`;
        output += `- **接続状態**: ${state.connected ? '✅ 接続中' : '❌ 切断'}\n`;
        output += `- **初期化状態**: ${state.initialized ? '✅ 初期化済み' : '❌ 未初期化'}\n`;
        
        // connectedAtプロパティは現在利用不可のためスキップ
        // if (state.connectedAt) {
        //   output += `- **接続開始**: ${state.connectedAt.toLocaleString('ja-JP')}\n`;
        // }
        
        if (state.lastActivity) {
          output += `- **最終アクティビティ**: ${state.lastActivity.toLocaleString('ja-JP')}\n`;
        }

        // メモリ使用量
        const memUsage = process.memoryUsage();
        output += `- **メモリ使用量**: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n`;
      }

      // ヘルス判定とおすすめアクション
      output += `\n### 💡 ステータス解説\n`;
      switch (diagnostics.status) {
        case 'healthy':
          output += `✅ **正常**: Java LSPは正常に動作しています。\n`;
          break;
        case 'warning':
          output += `⚠️ **警告**: エラーが多発しています（${diagnostics.errorCount}件）。\n`;
          output += `**推奨**: ワークスペース設定とJARファイルパスを確認してください。\n`;
          break;
        case 'error':
          output += `❌ **エラー**: Java LSPが正常に接続・初期化されていません。\n`;
          output += `**推奨**: LSPサーバーの再起動を検討してください。\n`;
          break;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: output
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Java LSP基本診断ツールエラー: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ 診断エラー: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * ステータスアイコン取得
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '🟢';
      case 'warning': return '🟡';  
      case 'error': return '🔴';
      default: return '❓';
    }
  }

  /**
   * 稼働時間フォーマット
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