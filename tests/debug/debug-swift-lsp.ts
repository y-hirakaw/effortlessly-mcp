#!/usr/bin/env node

/**
 * Swift LSP Debug Script
 * SourceKit-LSPの詳細デバッグを実行
 */

const path = require('path');
const fs = require('fs');

// 簡易ロガー（依存関係を最小限に）
class SimpleLogger {
  info(message, data = {}) {
    console.log(`[INFO] ${message}`, Object.keys(data).length > 0 ? data : '');
  }
  
  warn(message, data = {}) {
    console.log(`[WARN] ${message}`, Object.keys(data).length > 0 ? data : '');
  }
  
  error(message, error) {
    console.log(`[ERROR] ${message}`, error?.message || error || '');
  }
}

async function debugSwiftLSP() {
  console.log('🚀 Swift LSP Debug Session Starting...');
  console.log('=====================================\n');

  // テストプロジェクトのパス
  const testProjectPath = path.resolve('./test-swift-project');
  console.log(`📂 Test Project: ${testProjectPath}\n`);

  // ロガーを設定
  const logger = new Logger({
    level: 'debug',
    enableColors: true
  });

  try {
    // Swift LSPインスタンス作成
    console.log('🔧 Creating Swift LSP instance...');
    const swiftLSP = new SwiftLSP(testProjectPath, logger);

    // SourceKit-LSPの利用可能性確認
    console.log('🔍 Checking SourceKit-LSP availability...');
    const isAvailable = await SwiftLSP.isAvailable();
    console.log(`✅ SourceKit-LSP Available: ${isAvailable}\n`);

    if (!isAvailable) {
      console.log('❌ SourceKit-LSP is not available. Exiting...');
      return;
    }

    // LSP接続
    console.log('🔌 Connecting to SourceKit-LSP...');
    await swiftLSP.connect();
    console.log('✅ Connected successfully!\n');

    // プロジェクト設定の詳細表示
    console.log('📋 Project Configuration Details:');
    const projectConfig = await swiftLSP.detectProjectConfig();
    console.log(JSON.stringify(projectConfig, null, 2));
    console.log('');

    // テストクエリ実行
    const testQueries = [
      'DataManager',
      'Logger', 
      'NetworkService',
      'class',
      'func',
      'TestApp'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Debug Query: "${query}"`);
      console.log('─'.repeat(50));
      
      const debugResult = await swiftLSP.debugWorkspaceSymbolQuery(query);
      
      console.log(`📊 Results: ${debugResult.results.length} symbols found`);
      console.log(`⏱️ Duration: ${debugResult.debugInfo.timing.duration}ms`);
      console.log(`🎯 Success: ${debugResult.success}`);
      
      if (debugResult.results.length > 0) {
        console.log('📝 Found Symbols:');
        debugResult.results.forEach((symbol, index) => {
          console.log(`  ${index + 1}. ${symbol.name} (${symbol.kind})`);
          if (symbol.location) {
            console.log(`     Location: ${symbol.location.uri}`);
          }
        });
      }
      
      // 通信ログの概要
      const commLog = debugResult.debugInfo.communicationLog;
      if (commLog && commLog.length > 0) {
        console.log(`\n📡 LSP Communication (${commLog.length} entries):`);
        commLog.forEach((entry, index) => {
          const icon = entry.type === 'request' ? '🔄' : 
                      entry.type === 'response' ? '✅' : 
                      entry.type === 'error' ? '❌' : '📤';
          console.log(`  ${icon} ${entry.type.toUpperCase()}: ${entry.method || 'unknown'}`);
          
          if (entry.type === 'response' && entry.data) {
            const hasData = Array.isArray(entry.data) ? entry.data.length > 0 : !!entry.data;
            console.log(`     Has Data: ${hasData}`);
          }
          
          if (entry.type === 'error') {
            console.log(`     Error: ${entry.data?.error || 'Unknown error'}`);
          }
        });
      }
      
      console.log(''); // 空行
    }

    // 最終的な統計情報
    console.log('\n📈 Final Statistics:');
    console.log('─'.repeat(30));
    
    const allLogs = swiftLSP.exportLSPCommunicationLog();
    const requestCount = allLogs.filter(log => log.type === 'request').length;
    const responseCount = allLogs.filter(log => log.type === 'response').length;
    const errorCount = allLogs.filter(log => log.type === 'error').length;
    const notificationCount = allLogs.filter(log => log.type === 'notification').length;
    
    console.log(`📊 Total Requests: ${requestCount}`);
    console.log(`📊 Total Responses: ${responseCount}`);
    console.log(`📊 Total Errors: ${errorCount}`);
    console.log(`📊 Total Notifications: ${notificationCount}`);
    
    // LSP状態の最終確認
    const finalState = swiftLSP.getState();
    console.log('\n🏁 Final LSP State:');
    console.log(JSON.stringify(finalState, null, 2));

    // 切断
    console.log('\n🔌 Disconnecting...');
    await swiftLSP.disconnect();
    console.log('✅ Disconnected successfully!');

  } catch (error) {
    console.error('💥 Debug session failed:', error);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  debugSwiftLSP().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}