#!/usr/bin/env node

/**
 * LSP Response Debug Script
 * SourceKit-LSPからの応答を詳細にデバッグ
 */

const { spawn } = require('child_process');
const path = require('path');

async function debugLSPResponse() {
  console.log('🔍 LSP Response Debug Starting...');
  console.log('===================================\n');

  const workspaceRoot = process.cwd();
  console.log(`📂 Workspace: ${workspaceRoot}`);

  // SourceKit-LSPを起動（より詳細なログ出力）
  console.log('🔌 Starting SourceKit-LSP with debug mode...');
  
  const sourceKitPath = '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp';
  const lspProcess = spawn(sourceKitPath, [], {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let messageId = 1;
  let responseBuffer = '';
  let initializeCompleted = false;

  // プロセスの状態監視
  lspProcess.on('spawn', () => {
    console.log('✅ SourceKit-LSP process spawned successfully');
  });

  lspProcess.on('error', (error) => {
    console.error('💥 Process spawn error:', error);
  });

  lspProcess.on('exit', (code, signal) => {
    console.log(`🔚 SourceKit-LSP process exited with code ${code}, signal ${signal}`);
  });

  // 標準出力からの応答を監視（LSPプロトコル形式）
  lspProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    responseBuffer += chunk;
    
    console.log(`📥 Raw LSP Output (${chunk.length} bytes):`, chunk);
    
    // LSPメッセージをパース
    while (responseBuffer.includes('\\r\\n\\r\\n')) {
      const headerEndIndex = responseBuffer.indexOf('\\r\\n\\r\\n');
      const headers = responseBuffer.substring(0, headerEndIndex);
      
      // Content-Lengthを抽出
      const contentLengthMatch = headers.match(/Content-Length: (\\d+)/);
      if (contentLengthMatch) {
        const contentLength = parseInt(contentLengthMatch[1]);
        const messageStart = headerEndIndex + 4;
        
        if (responseBuffer.length >= messageStart + contentLength) {
          const messageContent = responseBuffer.substring(messageStart, messageStart + contentLength);
          responseBuffer = responseBuffer.substring(messageStart + contentLength);
          
          console.log('\\n📨 Parsed LSP Message:');
          console.log('Headers:', headers);
          console.log('Content:', messageContent);
          
          try {
            const parsedMessage = JSON.parse(messageContent);
            console.log('Parsed JSON:', JSON.stringify(parsedMessage, null, 2));
            
            // initialize応答を検出
            if (parsedMessage.id === 1 && parsedMessage.result) {
              initializeCompleted = true;
              console.log('✅ Initialize completed successfully');
            }
            
          } catch (parseError) {
            console.error('❌ Failed to parse JSON:', parseError.message);
          }
          console.log('---\\n');
        } else {
          // まだ完全なメッセージが受信されていない
          break;
        }
      } else {
        console.log('⚠️ No Content-Length found in headers:', headers);
        break;
      }
    }
  });

  // 標準エラー出力を監視
  lspProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.log('⚠️ LSP Stderr:', error);
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
    
    console.log(`\\n📤 Sending LSP Message: ${method}${id ? ` (ID: ${id})` : ''}`);
    console.log('Full message with headers:');
    console.log(messageWithHeaders.replace(/\\r\\n/g, '\\\\r\\\\n'));
    console.log('---');
    
    lspProcess.stdin.write(messageWithHeaders);
  }

  // 段階的にテスト実行
  try {
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

    // 初期化応答を待つ
    let attempts = 0;
    while (!initializeCompleted && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      console.log(`⏳ Waiting for initialize response... (${attempts}/30)`);
    }

    if (!initializeCompleted) {
      console.log('❌ Initialize failed or timed out');
      lspProcess.kill();
      return;
    }

    // 2. Initialized notification
    console.log('\\n2️⃣ Sending initialized notification...');
    sendLSPMessage('initialized', {});

    // 少し待つ
    console.log('⏳ Waiting for LSP to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. workspace/symbol query
    console.log('\\n3️⃣ Sending workspace/symbol query...');
    sendLSPMessage('workspace/symbol', {
      query: 'DataManager'
    }, messageId++);

    // 応答を待つ
    console.log('⏳ Waiting for workspace/symbol response...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } finally {
    // プロセス終了
    console.log('\\n🔌 Terminating LSP process...');
    lspProcess.kill('SIGTERM');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!lspProcess.killed) {
      console.log('🔥 Force killing LSP process...');
      lspProcess.kill('SIGKILL');  
    }
  }
  
  console.log('✅ Debug session completed');
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
debugLSPResponse().catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});