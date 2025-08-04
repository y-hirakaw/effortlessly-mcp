#!/usr/bin/env node

/**
 * Manual LSP Test
 * SourceKit-LSPとの直接通信をテスト
 */

const { spawn } = require('child_process');
const path = require('path');

async function testLSPDirectly() {
  console.log('🚀 Manual LSP Test Starting...');
  console.log('================================\n');

  const workspaceRoot = process.cwd();
  console.log(`📂 Workspace: ${workspaceRoot}`);

  // SourceKit-LSPを起動
  console.log('🔌 Starting SourceKit-LSP...');
  
  const sourceKitPath = '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp';
  const lspProcess = spawn(sourceKitPath, [], {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let messageId = 1;

  // SourceKit-LSPからの応答を監視
  lspProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📥 LSP Response:');
    console.log(output);
    console.log('---');
  });

  lspProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.log('⚠️ LSP Error:');
    console.log(error);
    console.log('---');
  });

  // LSPメッセージを送信する関数
  function sendLSPMessage(method, params = {}, id = null) {
    const message = {
      jsonrpc: '2.0',
      method,
      params,
      ...(id !== null && { id })
    };
    
    const messageStr = JSON.stringify(message);
    const messageWithHeaders = `Content-Length: ${Buffer.byteLength(messageStr)}\\r\\n\\r\\n${messageStr}`;
    
    console.log(`📤 Sending LSP Message: ${method}${id ? ` (ID: ${id})` : ''}`);
    console.log(messageStr);
    console.log('---');
    
    lspProcess.stdin.write(messageWithHeaders);
  }

  // 1. Initialize request
  console.log('\\n1️⃣ Sending initialize request...');
  sendLSPMessage('initialize', {
    processId: process.pid,
    rootUri: `file://${workspaceRoot}`,
    capabilities: {
      workspace: {
        symbol: {
          symbolKind: {
            valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
          }
        }
      }
    }
  }, messageId++);

  // 初期化を待つ
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 2. Initialized notification
  console.log('\\n2️⃣ Sending initialized notification...');
  sendLSPMessage('initialized', {});

  // 初期化完了を待つ
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. workspace/symbol query
  console.log('\\n3️⃣ Sending workspace/symbol query...');
  sendLSPMessage('workspace/symbol', {
    query: 'DataManager'
  }, messageId++);

  // 応答を待つ
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 4. より広範なクエリ
  console.log('\\n4️⃣ Sending broader workspace/symbol query...');
  sendLSPMessage('workspace/symbol', {
    query: 'class'
  }, messageId++);

  // 応答を待つ
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 5. 空のクエリ（全シンボル）
  console.log('\\n5️⃣ Sending empty workspace/symbol query (all symbols)...');
  sendLSPMessage('workspace/symbol', {
    query: ''
  }, messageId++);

  // 応答を待つ
  await new Promise(resolve => setTimeout(resolve, 10000));

  // プロセス終了
  console.log('\\n🔌 Terminating LSP process...');
  lspProcess.kill();
  
  console.log('✅ Manual LSP test completed');
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// テスト実行
testLSPDirectly().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});