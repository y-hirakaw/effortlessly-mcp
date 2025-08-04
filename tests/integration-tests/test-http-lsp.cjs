#!/usr/bin/env node

/**
 * HTTP LSP統合テストスクリプト
 */

const { spawn } = require('child_process');

async function testHttpLSP() {
  console.log('🧪 HTTP LSP統合テスト開始...');
  
  // LSP Proxy Serverが起動しているかテスト
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      const health = await response.json();
      console.log('✅ LSP Proxy Server is running:', health.status);
      
      // シンボル検索テスト
      const searchResponse = await fetch('http://localhost:3001/symbols/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Logger',
          languages: ['typescript']
        })
      });
      
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        console.log(`🎯 Symbol search result: ${searchResult.total} symbols found`);
        
        if (searchResult.symbols && searchResult.symbols.length > 0) {
          console.log('✅ HTTP LSP integration test PASSED');
          searchResult.symbols.slice(0, 3).forEach((symbol, i) => {
            console.log(`  ${i + 1}. ${symbol.name} (${symbol.kind})`);
          });
        } else {
          console.log('⚠️ No symbols found, but HTTP communication works');
        }
      } else {
        console.log('❌ Symbol search failed:', searchResponse.status);
      }
      
    } else {
      console.log('❌ LSP Proxy Server health check failed');
    }
    
  } catch (error) {
    console.log('❌ LSP Proxy Server not available:', error.message);
    console.log('');
    console.log('📝 To start the LSP Proxy Server:');
    console.log('   1. Open a new terminal');
    console.log('   2. Run: node build/lsp-proxy-standalone.js');
    console.log('   3. Wait for "LSP Proxy Server started successfully"');
    console.log('   4. Run this test again');
  }
}

testHttpLSP().catch(console.error);