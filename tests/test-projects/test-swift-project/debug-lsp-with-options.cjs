#!/usr/bin/env node

/**
 * LSP Debug with Options
 * SourceKit-LSPに明示的なオプションを指定してテスト
 */

const { spawn } = require('child_process');
const path = require('path');

async function debugLSPWithOptions() {
  console.log('🔍 LSP Debug with Options Starting...');
  console.log('=====================================\n');

  const workspaceRoot = process.cwd();
  console.log(`📂 Workspace: ${workspaceRoot}`);

  // .buildディレクトリの存在確認
  const fs = require('fs');
  const buildPath = path.join(workspaceRoot, '.build');
  const buildExists = fs.existsSync(buildPath);
  console.log(`🏗️ .build directory exists: ${buildExists}`);
  
  if (buildExists) {
    const buildContents = fs.readdirSync(buildPath);
    console.log(`📁 .build contents: ${buildContents.join(', ')}`);
  }

  // Package.swiftの存在確認
  const packageSwiftPath = path.join(workspaceRoot, 'Package.swift');
  const packageExists = fs.existsSync(packageSwiftPath);
  console.log(`📦 Package.swift exists: ${packageExists}`);

  // SourceKit-LSPを明示的なオプションで起動
  console.log('🔌 Starting SourceKit-LSP with explicit options...');
  
  const sourceKitPath = '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp';
  const lspArgs = [
    '--configuration', 'debug',
    '--default-workspace-type', 'swiftPM',
    '--scratch-path', buildPath
  ];
  
  console.log(`🚀 Starting: ${sourceKitPath} ${lspArgs.join(' ')}`);
  
  const lspProcess = spawn(sourceKitPath, lspArgs, {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SOURCEKIT_LOGGING: '3'  // より詳細なログ
    }
  });

  let messageId = 1;
  let responseBuffer = '';
  let initializeCompleted = false;
  let totalResponses = 0;

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

  // 標準出力からの応答を監視
  lspProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    responseBuffer += chunk;
    totalResponses++;
    
    console.log(`📥 Raw LSP Output #${totalResponses} (${chunk.length} bytes):`);
    console.log(chunk);
    
    // LSPメッセージをパース
    while (responseBuffer.includes('\\r\\n\\r\\n')) {
      const headerEndIndex = responseBuffer.indexOf('\\r\\n\\r\\n');
      const headers = responseBuffer.substring(0, headerEndIndex);
      
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
            console.log('✅ Parsed JSON:', JSON.stringify(parsedMessage, null, 2));
            
            // initialize応答を検出  
            if (parsedMessage.id === 1 && parsedMessage.result) {
              initializeCompleted = true;
              console.log('🎉 Initialize completed successfully!');
            }
            
          } catch (parseError) {
            console.error('❌ Failed to parse JSON:', parseError.message);
          }
          console.log('---\\n');
        } else {
          break;
        }
      } else {
        console.log('⚠️ No Content-Length found, raw data:', headers);
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
    console.log('JSON:', messageStr);
    console.log('---');
    
    lspProcess.stdin.write(messageWithHeaders);
  }

  try {
    // プロセス起動を少し待つ
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Initialize request (より詳細な capabilities)
    console.log('\\n1️⃣ Sending initialize request...');
    sendLSPMessage('initialize', {
      processId: process.pid,
      rootPath: workspaceRoot,
      rootUri: `file://${workspaceRoot}`,
      capabilities: {
        workspace: {
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true
          },
          didChangeConfiguration: {
            dynamicRegistration: true
          },
          didChangeWatchedFiles: {
            dynamicRegistration: true
          },
          symbol: {
            dynamicRegistration: true,
            symbolKind: {
              valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
            }
          },
          executeCommand: {
            dynamicRegistration: true
          }
        },
        textDocument: {
          publishDiagnostics: {
            relatedInformation: true
          },
          synchronization: {
            dynamicRegistration: true,
            willSave: true,
            willSaveWaitUntil: true,
            didSave: true
          },
          completion: {
            dynamicRegistration: true,
            contextSupport: true,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ["markdown", "plaintext"]
            }
          }
        }
      },
      initializationOptions: {},
      trace: 'verbose'
    }, messageId++);

    // 初期化応答を待つ
    let attempts = 0;
    while (!initializeCompleted && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      console.log(`⏳ Waiting for initialize response... (${attempts}/15)`);
    }

    if (!initializeCompleted) {
      console.log('❌ Initialize failed or timed out');
      console.log(`📊 Total responses received: ${totalResponses}`);
      return;
    }

    // 2. Initialized notification
    console.log('\\n2️⃣ Sending initialized notification...');
    sendLSPMessage('initialized', {});

    // 少し待つ
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. workspace/symbol query
    console.log('\\n3️⃣ Sending workspace/symbol query...');
    sendLSPMessage('workspace/symbol', {
      query: 'DataManager'
    }, messageId++);

    // 応答を待つ
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
  
  console.log(`✅ Debug session completed. Total responses: ${totalResponses}`);
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
debugLSPWithOptions().catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});