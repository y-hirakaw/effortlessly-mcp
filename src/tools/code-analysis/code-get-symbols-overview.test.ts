/**
 * code-get-symbols-overview.test.ts
 * code_get_symbols_overview ツールのテスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { codeGetSymbolsOverviewTool } from './code-get-symbols-overview.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { LSPManager } from '../../services/lsp/index.js';
import fs from 'fs/promises';
// import path from 'path';

// モック設定
vi.mock('../project-management/workspace-manager.js');
vi.mock('../../services/lsp/index.js');
vi.mock('fs/promises');
vi.mock('../../services/logger.js', () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}));

describe('code_get_symbols_overview', () => {
  const mockWorkspace = {
    root_path: '/test/workspace',
    name: 'test-workspace'
  };

  // デフォルトパラメータヘルパー
  function getDefaultParams(overrides: any = {}) {
    return {
      relative_path: 'default_path',
      include_private: false,
      depth: 1,
      max_files: 100,
      include_test_files: true,
      ...overrides
    };
  }

  const mockLSPManager = {
    getInstance: vi.fn(),
    getClient: vi.fn(),
    registerClient: vi.fn()
  };

  const mockWorkspaceManager = {
    getInstance: vi.fn(),
    getCurrentWorkspace: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // WorkspaceManager モック
    vi.mocked(WorkspaceManager.getInstance).mockReturnValue(mockWorkspaceManager as any);
    mockWorkspaceManager.getCurrentWorkspace.mockResolvedValue(mockWorkspace);
    
    // LSPManager モック
    vi.mocked(LSPManager.getInstance).mockReturnValue(mockLSPManager as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基本機能テスト', () => {
    it('アクティブなワークスペースが必要', async () => {
      mockWorkspaceManager.getCurrentWorkspace.mockResolvedValue(null);

      await expect(
        codeGetSymbolsOverviewTool.execute(getDefaultParams({
          relative_path: 'src/'
        }))
      ).rejects.toThrow('No active workspace');
    });

    it('存在しないパスでエラー', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(
        codeGetSymbolsOverviewTool.execute(getDefaultParams({
          relative_path: 'nonexistent/'
        }))
      ).rejects.toThrow('Path not found: nonexistent/');
    });

    it('空のディレクトリで空の結果を返す', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'empty/'
      }));

      expect(result.files).toEqual([]);
      expect(result.summary.total_files).toBe(0);
      expect(result.summary.total_symbols).toBe(0);
    });
  });

  describe('ファイル処理テスト', () => {
    it('単一TypeScriptファイルを処理', async () => {
      const mockFileContent = 'class TestClass {\n  method() {}\n}';
      
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);

      // TypeScript LSP モック
      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([
          {
            name: 'TestClass',
            kind: 5, // Class
            location: {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 2, character: 1 }
              }
            }
          }
        ])
      };

      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'test.ts'
      }));

      expect(result.files).toHaveLength(1);
      expect(result.files[0].relative_path).toBe('test.ts');
      expect(result.files[0].language).toBe('typescript');
      expect(result.files[0].symbols).toHaveLength(1);
      expect(result.files[0].symbols[0].name).toBe('TestClass');
      expect(result.summary.total_files).toBe(1);
      expect(result.summary.total_symbols).toBe(1);
    });

    it('複数ファイルのディレクトリを処理', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      
      // ディレクトリ構造をモック
      vi.mocked(fs.readdir).mockImplementation(async (dirPath: any) => {
        if (dirPath.includes('src')) {
          return [
            { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
            { name: 'file2.js', isFile: () => true, isDirectory: () => false }
          ] as any;
        }
        return [];
      });

      vi.mocked(fs.readFile).mockResolvedValue('function test() {}');

      // TypeScript LSP モック
      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([
          {
            name: 'test',
            kind: 12, // Function
            location: {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 18 }
              }
            }
          }
        ])
      };

      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'src/'
      }));

      expect(result.files).toHaveLength(2);
      expect(result.summary.total_files).toBe(2);
      expect(result.summary.languages).toContain('typescript');
      expect(result.summary.languages).toContain('javascript');
    });
  });

  describe('言語サポートテスト', () => {
    it('TypeScriptファイルを正しく検出', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([])
      };
      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'component.tsx'
      }));

      expect(result.files[0].language).toBe('typescript');
    });

    it('Swiftファイルを正しく検出', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      const mockSwiftLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        searchSymbols: vi.fn().mockResolvedValue([])
      };
      mockLSPManager.getClient.mockReturnValue(mockSwiftLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'ViewController.swift'
      }));

      expect(result.files[0].language).toBe('swift');
    });

    it('未サポート言語を正しく処理', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'config.json'
      }));

      expect(result.files).toHaveLength(0);
    });
  });

  describe('オプションテスト', () => {
    beforeEach(() => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');
    });

    it('テストファイルを除外', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'component.ts', isFile: () => true, isDirectory: () => false },
        { name: 'component.test.ts', isFile: () => true, isDirectory: () => false }
      ] as any);

      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([])
      };
      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'src/',
        include_test_files: false
      }));

      expect(result.files).toHaveLength(1);
      expect(result.files[0].relative_path).toBe('src/component.ts');
    });

    it('最大ファイル数制限', async () => {
      const manyFiles = Array.from({ length: 50 }, (_, i) => ({
        name: `file${i}.ts`,
        isFile: () => true,
        isDirectory: () => false
      }));

      vi.mocked(fs.readdir).mockResolvedValue(manyFiles as any);

      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([])
      };
      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'src/',
        max_files: 5
      }));

      expect(result.files.length).toBeLessThanOrEqual(5);
    });
  });

  describe('統計情報テスト', () => {
    it('シンボル分布統計を正しく計算', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([
          {
            name: 'TestClass',
            kind: 5, // Class
            location: { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }
          },
          {
            name: 'testMethod',
            kind: 6, // Method
            location: { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } } }
          }
        ])
      };
      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'test.ts'
      }));

      expect(result.summary.symbol_distribution.Class).toBe(1);
      expect(result.summary.symbol_distribution.Method).toBe(1);
      expect(result.summary.total_symbols).toBe(2);
    });

    it('最大ファイル情報を正しく提供', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'small.ts', isFile: () => true, isDirectory: () => false },
        { name: 'large.ts', isFile: () => true, isDirectory: () => false }
      ] as any);

      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        if (filePath.includes('large.ts')) {
          return 'line1\nline2\nline3\nline4\nline5';
        }
        return 'line1';
      });

      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockImplementation(async (filePath: any) => {
          if (filePath.includes('large.ts')) {
            return [
              { name: 'Symbol1', kind: 5, location: { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } } },
              { name: 'Symbol2', kind: 6, location: { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } } } }
            ];
          }
          return [
            { name: 'SmallSymbol', kind: 5, location: { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } } }
          ];
        })
      };
      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'src/'
      }));

      expect(result.summary.largest_files[0].file).toBe('src/large.ts');
      expect(result.summary.largest_files[0].symbols).toBe(2);
    });
  });

  describe('エラーハンドリング', () => {
    it('LSP接続失敗時にフォールバック', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      // LSPクライアントは利用不可
      mockLSPManager.getClient.mockReturnValue(null);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'test.ts'
      }));

      expect(result.files[0].symbols).toEqual([]);
    });

    it('ファイル読み取り失敗を適切に処理', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'good.ts', isFile: () => true, isDirectory: () => false },
        { name: 'bad.ts', isFile: () => true, isDirectory: () => false }
      ] as any);

      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        if (filePath.includes('bad.ts')) {
          throw new Error('Permission denied');
        }
        return 'content';
      });

      const mockTSLSP = {
        isAvailable: vi.fn().mockResolvedValue(true),
        connect: vi.fn(),
        getFileSymbols: vi.fn().mockResolvedValue([])
      };
      mockLSPManager.getClient.mockReturnValue(mockTSLSP);

      const result = await codeGetSymbolsOverviewTool.execute(getDefaultParams({
        relative_path: 'src/'
      }));

      expect(result.files).toHaveLength(1);
      expect(result.files[0].relative_path).toBe('src/good.ts');
    });
  });
});