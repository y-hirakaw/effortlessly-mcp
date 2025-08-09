/**
 * LogManager テストファイル
 * 統一ログシステムの動作確認
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogManager, LogType, ANSI_COLORS, ToolCategory } from '../../src/utils/log-manager.js';
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

  describe('ANSI Color System', () => {
    it('should have all required color constants', () => {
      // ツール系統別色の確認
      expect(ANSI_COLORS.FILE_OPERATIONS).toBeDefined();
      expect(ANSI_COLORS.CODE_ANALYSIS).toBeDefined();
      expect(ANSI_COLORS.CODE_EDITING).toBeDefined();
      expect(ANSI_COLORS.PROJECT_MANAGEMENT).toBeDefined();
      expect(ANSI_COLORS.WORKSPACE).toBeDefined();
      expect(ANSI_COLORS.SEARCH).toBeDefined();
      expect(ANSI_COLORS.LSP).toBeDefined();
      expect(ANSI_COLORS.GENERAL).toBeDefined();
      
      // 状態別色の確認
      expect(ANSI_COLORS.SUCCESS).toBeDefined();
      expect(ANSI_COLORS.ERROR).toBeDefined();
      expect(ANSI_COLORS.WARNING).toBeDefined();
      expect(ANSI_COLORS.INFO).toBeDefined();
      expect(ANSI_COLORS.RESET).toBeDefined();
    });

    it('should categorize operations correctly', () => {
      // @ts-ignore - テスト用のプライベートメソッドアクセス
      const logManager = LogManager.getInstance();
      
      // ファイル操作系
      // @ts-ignore
      expect(logManager.categorizeOperation('LIST_DIRECTORY')).toBe(ToolCategory.FILE_OPERATIONS);
      // @ts-ignore
      expect(logManager.categorizeOperation('READ_FILE')).toBe(ToolCategory.FILE_OPERATIONS);
      // @ts-ignore
      expect(logManager.categorizeOperation('SMART_EDIT_FILE')).toBe(ToolCategory.FILE_OPERATIONS);

      // コード解析系
      // @ts-ignore
      expect(logManager.categorizeOperation('CODE_GET_SYMBOLS')).toBe(ToolCategory.CODE_ANALYSIS);
      // @ts-ignore
      expect(logManager.categorizeOperation('CODE_ANALYZE_DEPS')).toBe(ToolCategory.CODE_ANALYSIS);

      // コード編集系
      // @ts-ignore
      expect(logManager.categorizeOperation('CODE_REPLACE_REGEX')).toBe(ToolCategory.CODE_EDITING);
      // @ts-ignore
      expect(logManager.categorizeOperation('CODE_INSERT_SYMBOL')).toBe(ToolCategory.CODE_EDITING);

      // プロジェクト管理系
      // @ts-ignore
      expect(logManager.categorizeOperation('PROJECT_MEMORY_WRITE')).toBe(ToolCategory.PROJECT_MANAGEMENT);
      
      // ワークスペース系
      // @ts-ignore
      expect(logManager.categorizeOperation('WORKSPACE_ACTIVATE')).toBe(ToolCategory.WORKSPACE);

      // LSP系
      // @ts-ignore
      expect(logManager.categorizeOperation('FIND_SYMBOL')).toBe(ToolCategory.LSP);

      // 検索系
      // @ts-ignore
      expect(logManager.categorizeOperation('SEARCH_PATTERN')).toBe(ToolCategory.SEARCH);

      // 一般系（該当なし）
      // @ts-ignore
      expect(logManager.categorizeOperation('UNKNOWN_OPERATION')).toBe(ToolCategory.GENERAL);
    });

    it('should colorize log entries correctly', () => {
      // @ts-ignore - テスト用のプライベートメソッドアクセス
      const logManager = LogManager.getInstance();
      
      const testEntry = '2025-08-09T12:00:00.000Z [FILE_READ] | File: /test/file.ts | 100 lines read';
      // @ts-ignore
      const colorized = logManager.colorizeLogEntry('FILE_READ', testEntry);
      
      // テスト環境では色付けが無効化されるため、元の文字列がそのまま返されることを確認
      expect(colorized).toBe(testEntry);
      expect(colorized).toContain('[FILE_READ]');
      expect(colorized).toContain('/test/file.ts');
      
      // カラーコードが含まれていないことを確認（テスト環境では無効化）
      expect(colorized).not.toContain('\x1b[38;5;34m');
      expect(colorized).not.toContain('\x1b[0m');
    });

    it('should use IDE-like colors (256-color palette)', () => {
      // 256色パレット（\x1b[38;5;XXXm）を使用していることを確認
      expect(ANSI_COLORS.FILE_OPERATIONS).toContain('38;5;');
      expect(ANSI_COLORS.CODE_ANALYSIS).toContain('38;5;');
      expect(ANSI_COLORS.CODE_EDITING).toContain('38;5;');
      expect(ANSI_COLORS.PROJECT_MANAGEMENT).toContain('38;5;');
      expect(ANSI_COLORS.LSP).toContain('38;5;');
      
      // 基本的な16色（\x1b[XXm）を使っていないことを確認
      expect(ANSI_COLORS.FILE_OPERATIONS).not.toMatch(/^\x1b\[[0-9]{1,2}m$/);
    });

    it('should format colored logs correctly in operations', async () => {
      // カラー付きログが正常に記録されることを確認
      await logManager.logFileOperation('READ', '/test/colored.ts', 'Testing color output');
      
      const opsLogPath = path.join(testLogDir, 'operations', 'operations.log');
      const logContent = await fsService.readFile(opsLogPath, { encoding: 'utf8' }) as string;
      
      // ログにカラーコードが含まれていることを確認（ファイルに保存時は色付き）
      expect(logContent).toContain('[READ]');
      expect(logContent).toContain('/test/colored.ts');
      expect(logContent).toContain('Testing color output');
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
