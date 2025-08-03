#!/usr/bin/env node

/**
 * シンプルなLSPテストスクリプト
 * debug_lsp.jsで成功したパターンを再現
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testTypescriptLSP() {
  console.log('🔍 TypeScript LSP 直接テスト開始...');
  
  const workspaceRoot = process.cwd();
  console.log(`📁 ワークスペース: ${workspaceRoot}`);
  
  // TypeScript LSPプロセスを起動
  const lsp = spawn('typescript-language-server', ['--stdio'], {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let requestId = 0;
  const pendingRequests = new Map();
  
  // メッセージ送信
  function sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      pendingRequests.set(id, { resolve, reject });
      
      const message = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
      
      console.log(`📤 送信: ${method} (ID: ${id})`);
      lsp.stdin.write(header + message, 'utf8');
      
      // 30秒タイムアウト
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 30000);
    });
  }
  
  // 通知送信
  function sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    const message = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
    
    console.log(`📡 通知: ${method}`);
    lsp.stdin.write(header + message, 'utf8');
  }
  
  // 応答処理
  let buffer = '';
  lsp.stdout.on('data', (data) => {
    buffer += data.toString('utf8');
    
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      
      const header = buffer.slice(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      
      if (!contentLengthMatch) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      
      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      
      if (buffer.length < messageStart + contentLength) {
        break;
      }
      
      const messageContent = buffer.slice(messageStart, messageStart + contentLength);
      buffer = buffer.slice(messageStart + contentLength);
      
      try {
        const message = JSON.parse(messageContent);
        console.log(`📥 受信:`, { id: message.id, method: message.method, hasError: !!message.error });
        
        if (message.id !== undefined && pendingRequests.has(message.id)) {
          const pending = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          
          if (message.error) {
            pending.reject(new Error(`LSP Error: ${message.error.message}`));
          } else {
            pending.resolve(message.result);
          }
        }
      } catch (error) {
        console.error('メッセージパースエラー:', error);
      }
    }
  });
  
  lsp.stderr.on('data', (data) => {
    console.error('LSP stderr:', data.toString());
  });
  
  try {
    // 初期化
    console.log('🚀 LSP初期化中...');
    const initResult = await sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${workspaceRoot}`,
      capabilities: {
        textDocument: {
          documentSymbol: { dynamicRegistration: false }
        },
        workspace: {
          symbol: { dynamicRegistration: false }
        }
      }
    });
    
    console.log('✅ 初期化成功:', !!initResult.capabilities);
    
    sendNotification('initialized', {});
    console.log('✅ 初期化完了通知送信');
    
    // Logger.tsファイルを検索
    const loggerFile = path.join(workspaceRoot, 'src/services/logger.ts');
    if (fs.existsSync(loggerFile)) {
      console.log(`📄 テストファイル: ${loggerFile}`);
      
      // ファイルを明示的に開く
      const fileUri = `file://${loggerFile}`;
      const fileContent = fs.readFileSync(loggerFile, 'utf8');
      
      console.log(`📖 ファイル内容: ${fileContent.length} 文字`);
      console.log(`🔍 class Logger検索: ${fileContent.includes('class Logger') ? '発見' : '未発見'}`);
      
      // textDocument/didOpen通知を送信
      sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: fileUri,
          languageId: 'typescript',
          version: 1,
          text: fileContent
        }
      });
      
      console.log('📂 ファイルを開きました、1秒待機...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const symbols = await sendRequest('textDocument/documentSymbol', {
        textDocument: { uri: fileUri }
      });
      
      console.log(`🎯 シンボル発見: ${symbols.length}件`);
      symbols.forEach((symbol, index) => {
        console.log(`  ${index + 1}. ${symbol.name} (種類: ${symbol.kind})`);
      });
      
      if (symbols.length > 0) {
        console.log('🎉 LSP通信成功！');
      } else {
        console.log('⚠️ シンボルが見つかりません');
      }
      
      // ファイルを閉じる
      sendNotification('textDocument/didClose', {
        textDocument: { uri: fileUri }
      });
    } else {
      console.log('❌ logger.tsファイルが見つかりません');
    }
    
  } catch (error) {
    console.error('❌ テスト失敗:', error.message);
  } finally {
    lsp.kill();
    console.log('🔚 テスト完了');
  }
}

testTypescriptLSP().catch(console.error);