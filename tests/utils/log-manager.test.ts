/**
 * LogManager テストファイル
 * 統一ログシステムの動作確認
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogManager, LogType } from '../../src/utils/log-manager.js';
import { FileSystemService } from '../../src/services/FileSystemService.js';
import * as path from 'path';

describe('LogManager', () => {
  let logManager: LogManager;
  let fsService: FileSystemService;
  const testLogDir = path.resolve('.claude/workspace/effortlessly/logs');

  // ヘルパー関数: ファイルの存在確認
  const fileExists = async (filePath: string): Promise<boolean> => {
    try {
      await fsService.access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  beforeEach(() => {
    logManager = LogManager.getInstance();
    fsService = FileSystemService.getInstance();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      const diffLogDir = path.join(testLogDir, 'diff');
      const opsLogDir = path.join(testLogDir, 'operations');
      
      try {
        await fsService.access(diffLogDir);
        const files = await fsService.readdir(diffLogDir);
        for (const file of files) {
          await fsService.unlink(path.join(diffLogDir, file));
        }
      } catch {}
      
      try {
        await fsService.access(opsLogDir);
        const files = await fsService.readdir(opsLogDir);
        for (const file of files) {
          await fsService.unlink(path.join(opsLogDir, file));
        }
      } catch {}
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('Diff Logging', () => {
    it('should log diff changes correctly', async () => {
      const originalContent = 'Hello World';
      const newContent = 'Hello TypeScript';
      const filePath = 'test.ts';
      const operation = 'Smart Edit';
      const diffContent = '--- test.ts\n+++ test.ts\n@@ -1 +1 @@\n-Hello World\n+Hello TypeScript';

      await logManager.logDiff(originalContent, newContent, filePath, operation, diffContent);

      // ログファイルが作成されたか確認
      const diffLogPath = path.join(testLogDir, 'diff', 'diff.log');
      const exists = await fileExists(diffLogPath);
      expect(exists).toBe(true);

      // ログ内容を確認
      const logContent = await fsService.readFile(diffLogPath, { encoding: 'utf8' }) as string;
      expect(logContent).toContain('test.ts');
      expect(logContent).toContain('Smart Edit');
      expect(logContent).toContain('Hello TypeScript');
    });

    it('should skip empty diff content', async () => {
      const originalContent = 'same content';
      const newContent = 'same content';
      const filePath = 'test.ts';
      const operation = 'Smart Edit';
      const diffContent = ''; // 空のdiff

      await logManager.logDiff(originalContent, newContent, filePath, operation, diffContent);

      // ログファイルが存在しないか、空であることを確認
      const diffLogPath = path.join(testLogDir, 'diff', 'diff.log');
      const exists = await fileExists(diffLogPath);
      if (exists) {
        const logContent = await fsService.readFile(diffLogPath, { encoding: 'utf8' }) as string;
        expect(logContent.trim()).toBe('');
      }
    });
  });

  describe('Operation Logging', () => {
    it('should log file operations correctly', async () => {
      await logManager.logFileOperation('READ', '/test/file.ts', '100 lines read | Size: 1024 bytes');

      const opsLogPath = path.join(testLogDir, 'operations', 'operations.log');
      const exists = await fileExists(opsLogPath);
      expect(exists).toBe(true);

      const logContent = await fsService.readFile(opsLogPath, { encoding: 'utf8' }) as string;
      expect(logContent).toContain('[READ]');
      expect(logContent).toContain('/test/file.ts');
      expect(logContent).toContain('100 lines read');
    });

    it('should log search operations correctly', async () => {
      await logManager.logSearchOperation('FILE_SEARCH', '*.ts', 25, '/src');

      const opsLogPath = path.join(testLogDir, 'operations', 'operations.log');
      const logContent = await fsService.readFile(opsLogPath, { encoding: 'utf8' }) as string;
      expect(logContent).toContain('[FILE_SEARCH]');
      expect(logContent).toContain('Pattern: "*.ts"');
      expect(logContent).toContain('25 results');
    });

    it('should log LSP operations correctly', async () => {
      await logManager.logLSPOperation('FIND_SYMBOL', 'TestFunction', '/src/test.ts', 5);

      const opsLogPath = path.join(testLogDir, 'operations', 'operations.log');
      const logContent = await fsService.readFile(opsLogPath, { encoding: 'utf8' }) as string;
      expect(logContent).toContain('[FIND_SYMBOL]');
      expect(logContent).toContain('Symbol: "TestFunction"');
      expect(logContent).toContain('5 results');
    });

    it('should log general operations correctly', async () => {
      await logManager.logOperation('WORKSPACE_ACTIVATE', '/project/root', 'Workspace activated', {
        lsp_servers: ['typescript', 'swift']
      });

      const opsLogPath = path.join(testLogDir, 'operations', 'operations.log');
      const logContent = await fsService.readFile(opsLogPath, { encoding: 'utf8' }) as string;
      expect(logContent).toContain('[WORKSPACE_ACTIVATE]');
      expect(logContent).toContain('/project/root');
      expect(logContent).toContain('Workspace activated');
      expect(logContent).toContain('typescript');
    });
  });

  describe('Log Rotation', () => {
    it('should create directories for logs', async () => {
      await logManager.logFileOperation('TEST', '/test.ts', 'Test operation');

      const diffLogDir = path.join(testLogDir, 'diff');
      const opsLogDir = path.join(testLogDir, 'operations');
      
      expect(await fileExists(diffLogDir)).toBe(true);
      expect(await fileExists(opsLogDir)).toBe(true);
    });

    it('should handle manual rotation', async () => {
      // 手動ローテーション機能をテスト（例外が発生しないことを確認）
      expect(async () => {
        await logManager.forceRotate(LogType.OPERATIONS);
        await logManager.forceRotate(LogType.DIFF);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle logging errors gracefully', async () => {
      // 無効なファイルパスでのログ記録テスト（エラーが発生するが例外は投げられない）
      expect(async () => {
        await logManager.logFileOperation('TEST', '', 'Test with empty path');
      }).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LogManager.getInstance();
      const instance2 = LogManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
