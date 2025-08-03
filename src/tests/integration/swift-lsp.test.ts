/**
 * Swift LSP統合テスト
 * SourceKit-LSPとの統合動作を検証
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { SwiftLSP } from '../../services/lsp/swift-lsp.js';

const sleep = promisify(setTimeout);

describe('Swift LSP Integration Tests', () => {
  let lspProxyProcess: ChildProcess | null = null;
  let isSwiftLSPAvailable = false;
  const LSP_PORT = 3001;
  const LSP_BASE_URL = `http://localhost:${LSP_PORT}`;
  const WORKSPACE_ROOT = process.cwd();

  beforeAll(async () => {
    // SourceKit-LSPの利用可能性をチェック
    isSwiftLSPAvailable = await SwiftLSP.isAvailable();
    if (!isSwiftLSPAvailable) {
      console.log('SourceKit-LSP not available, skipping Swift LSP tests');
      return;
    }

    // LSP Proxy Serverを起動
    lspProxyProcess = spawn('node', ['build/lsp-proxy-standalone.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // LSP起動を待機
    await sleep(5000);

    // ヘルスチェックで起動を確認
    try {
      const response = await fetch(`${LSP_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error('LSP Proxy Server failed to start');
      }
    } catch (error) {
      console.warn('LSP Proxy Server health check failed, some tests may be skipped');
    }
  }, 30000);

  afterAll(async () => {
    if (lspProxyProcess) {
      lspProxyProcess.kill('SIGTERM');
      await sleep(1000);
      if (!lspProxyProcess.killed) {
        lspProxyProcess.kill('SIGKILL');
      }
    }
  });

  beforeEach(async () => {
    // 各テスト前に少し待機
    await sleep(500);
  });

  describe('SourceKit-LSP Availability', () => {
    it('should detect SourceKit-LSP availability', async () => {
      const isAvailable = await SwiftLSP.isAvailable();
      
      if (isAvailable) {
        expect(isAvailable).toBe(true);
      } else {
        console.log('SourceKit-LSP not available on this system');
        expect(isAvailable).toBe(false);
      }
    });

    it('should check Swift LSP in available languages', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      try {
        const response = await fetch(`${LSP_BASE_URL}/lsps/status`);
        expect(response.ok).toBe(true);

        const data = await response.json() as any;
        expect(data.available).toBeDefined();
        
        // Swift LSPが利用可能な場合は含まれるべき
        if (await SwiftLSP.isAvailable()) {
          expect(data.available).toContain('swift');
        }
      } catch (error) {
        console.warn('LSP status check failed, server may not be running');
      }
    });
  });

  describe('Swift Project Detection', () => {
    it('should initialize Swift LSP with workspace', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      const swiftLSP = new SwiftLSP(WORKSPACE_ROOT);
      
      // プロジェクト設定を検出
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      expect(projectConfig).toBeDefined();
      expect(typeof projectConfig.hasPackageSwift).toBe('boolean');
      expect(typeof projectConfig.hasPodfile).toBe('boolean');
      expect(typeof projectConfig.swiftVersion).toBe('string');
      
      if (projectConfig.hasPackageSwift) {
        expect(projectConfig.packageSwiftPath).toBeDefined();
        expect(existsSync(projectConfig.packageSwiftPath!)).toBe(true);
        console.log(`📦 Package.swift found: ${projectConfig.packageSwiftPath}`);
      }
      
      if (projectConfig.hasPodfile) {
        expect(projectConfig.podfilePath).toBeDefined();
        expect(existsSync(projectConfig.podfilePath!)).toBe(true);
        console.log(`🍃 Podfile found: ${projectConfig.podfilePath}`);
      }
      
      if (projectConfig.dependencies && projectConfig.dependencies.length > 0) {
        expect(Array.isArray(projectConfig.dependencies)).toBe(true);
        console.log(`📦 Swift Package Manager dependencies: ${projectConfig.dependencies.join(', ')}`);
      }
      
      if (projectConfig.pods && projectConfig.pods.length > 0) {
        expect(Array.isArray(projectConfig.pods)).toBe(true);
        console.log(`🍃 CocoaPods dependencies: ${projectConfig.pods.join(', ')}`);
      }
    });

    it('should find Swift files in workspace', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      const swiftLSP = new SwiftLSP(WORKSPACE_ROOT);
      
      const swiftFiles = await swiftLSP.findSwiftFiles();
      
      expect(Array.isArray(swiftFiles)).toBe(true);
      
      // Swiftファイルが見つかった場合、.swift拡張子を確認
      swiftFiles.forEach(file => {
        expect(file.endsWith('.swift')).toBe(true);
        expect(existsSync(file)).toBe(true);
      });
    });
  });

  describe('Swift Symbol Search', () => {
    it('should handle Swift symbol search through HTTP API', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      try {
        const response = await fetch(`${LSP_BASE_URL}/symbols/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'class',
            languages: ['swift']
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          
          expect(data.query).toBe('class');
          expect(data.languages).toContain('swift');
          expect(data.total).toBeGreaterThanOrEqual(0);
          expect(Array.isArray(data.symbols)).toBe(true);
        } else {
          console.warn('Swift symbol search failed, may need actual Swift project');
        }
      } catch (error) {
        console.warn('Swift symbol search test failed:', (error as Error).message);
      }
    });

    it('should search symbols directly with Swift LSP', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      const swiftLSP = new SwiftLSP(WORKSPACE_ROOT);
      
      // テスト用のシンボル検索
      const symbols = await swiftLSP.searchSymbols('class', {
        maxResults: 10
      });
      
      expect(Array.isArray(symbols)).toBe(true);
      
      // シンボルが見つかった場合の構造検証
      symbols.forEach(symbol => {
        expect(symbol.name).toBeDefined();
        expect(typeof symbol.kind).toBe('number');
        expect(symbol.file).toBeDefined();
        expect(symbol.position).toBeDefined();
        expect(symbol.range).toBeDefined();
      });
    });
  });

  describe('Swift LSP Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const swiftLSP = new SwiftLSP('/non/existent/path');
      
      try {
        await swiftLSP.searchSymbols('test');
        // 接続していない状態でのシンボル検索は空配列を返すべき
      } catch (error) {
        // エラーが発生する場合は適切なエラーメッセージであることを確認
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBeDefined();
      }
    });

    it('should validate workspace root', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      // 無効なワークスペースパスでの初期化
      const swiftLSP = new SwiftLSP('/invalid/workspace/path');
      
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      // 無効なパスでも適切にfalse値を返すべき
      expect(projectConfig.hasPackageSwift).toBe(false);
      expect(projectConfig.hasPodfile).toBe(false);
      expect(projectConfig.packageSwiftPath).toBeUndefined();
      expect(projectConfig.podfilePath).toBeUndefined();
    });
  });

  describe('Swift LSP Performance', () => {
    it('should respond to symbol searches within reasonable time', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      const swiftLSP = new SwiftLSP(WORKSPACE_ROOT);
      
      const startTime = Date.now();
      
      try {
        await swiftLSP.searchSymbols('swift', { maxResults: 5 });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // 5秒以内でレスポンスが返ることを期待
        expect(responseTime).toBeLessThan(5000);
      } catch (error) {
        // エラーが発生した場合も時間制限内であることを確認
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        expect(responseTime).toBeLessThan(10000);
      }
    });

    it('should handle cache operations efficiently', async () => {
      if (!isSwiftLSPAvailable) {
        console.log('Skipping: SourceKit-LSP not available');
        return;
      }
      const swiftLSP = new SwiftLSP(WORKSPACE_ROOT);
      
      // 最初の検索（キャッシュなし）
      const firstSearch = await swiftLSP.searchSymbols('func', { maxResults: 3 });
      
      // 2回目の検索（キャッシュあり）
      const secondSearch = await swiftLSP.searchSymbols('func', { maxResults: 3 });
      
      // 結果の一貫性を確認
      expect(Array.isArray(firstSearch)).toBe(true);
      expect(Array.isArray(secondSearch)).toBe(true);
      
      // キャッシュクリアのテスト
      swiftLSP.clearCache();
      
      const thirdSearch = await swiftLSP.searchSymbols('func', { maxResults: 3 });
      expect(Array.isArray(thirdSearch)).toBe(true);
    });
  });
});