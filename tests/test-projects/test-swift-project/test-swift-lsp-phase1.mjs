#!/usr/bin/env node

/**
 * Swift LSP Phase 1強化機能のテスト実行
 */

import { SwiftLSP } from '../build/services/lsp/swift-lsp.js';
import { Logger } from '../build/services/logger.js';

async function runPhase1Test() {
  console.log('🔄 Swift LSP Phase 1強化機能テスト開始...\n');
  
  const logger = new Logger();
  const swiftLSP = new SwiftLSP('/Users/y-hirakawa/git/effortlessly-mcp/test-swift-project', logger);
  
  try {
    // 統合テスト実行
    console.log('📋 統合テスト実行中...');
    const testResult = await swiftLSP.runIntegrationTest();
    
    console.log('\n📊 テスト結果:');
    console.log(`全体成功: ${testResult.success ? '✅' : '❌'}`);
    
    console.log('\n🔍 詳細テスト結果:');
    for (const [testName, result] of Object.entries(testResult.testResults)) {
      const status = result.success ? '✅' : '❌';
      const details = result.error ? ` (エラー: ${result.error})` : '';
      const count = 'resultCount' in result ? ` [${result.resultCount}件]` : '';
      const fileCount = 'fileCount' in result ? ` [${result.fileCount}ファイル]` : '';
      console.log(`  ${testName}: ${status}${count}${fileCount}${details}`);
    }
    
    console.log('\n📈 パフォーマンス統計:');
    const metrics = testResult.performanceMetrics;
    console.log(`  総検索回数: ${metrics.totalSearches}`);
    console.log(`  LSP成功率: ${(metrics.lspSuccessRate * 100).toFixed(1)}%`);
    console.log(`  フォールバック使用率: ${(metrics.fallbackUsageRate * 100).toFixed(1)}%`);
    console.log(`  平均応答時間: ${metrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`  キャッシュ効率: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`  LSPキャッシュサイズ: ${metrics.cacheSize}`);
    console.log(`  フォールバックキャッシュサイズ: ${metrics.fallbackCacheSize}`);
    
    if (testResult.recommendations.length > 0) {
      console.log('\n💡 推奨事項:');
      testResult.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    // 診断レポート生成
    console.log('\n🔬 診断レポート生成中...');
    const diagnosticReport = swiftLSP.generateDiagnosticReport();
    
    console.log('\n📋 システム状態:');
    console.log(`  LSP接続状態: ${diagnosticReport.lspStatus.connected ? '✅' : '❌'}`);
    console.log(`  最終活動: ${diagnosticReport.lspStatus.lastActivity || 'なし'}`);
    console.log(`  エラー状態: ${diagnosticReport.lspStatus.errorState || 'なし'}`);
    
    console.log('\n📁 プロジェクト情報:');
    console.log(`  ワークスペース: ${diagnosticReport.projectInfo.workspaceRoot}`);
    console.log(`  Swiftファイル数: ${diagnosticReport.projectInfo.swiftFilesFound}`);
    console.log(`  Package.swift: ${diagnosticReport.projectInfo.hasPackageSwift ? '✅' : '❌'}`);
    console.log(`  Podfile: ${diagnosticReport.projectInfo.hasPodfile ? '✅' : '❌'}`);
    
    // パフォーマンス統計リセットテスト
    console.log('\n🔄 パフォーマンス統計リセットテスト...');
    swiftLSP.resetPerformanceMetrics();
    const resetMetrics = swiftLSP.getPerformanceMetrics();
    const allZero = Object.values(resetMetrics).every(val => val === 0);
    console.log(`統計リセット: ${allZero ? '✅' : '❌'}`);
    
    console.log('\n🎉 Phase 1強化機能テスト完了！');
    return testResult.success;
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// メイン実行
runPhase1Test()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });