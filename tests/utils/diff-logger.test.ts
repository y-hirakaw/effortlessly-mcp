import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiffLogger } from '../../src/utils/diff-logger';
import { FileSystemService } from '../../src/services/FileSystemService';
import { Logger } from '../../src/services/logger';

// Mock dependencies
vi.mock('../../src/services/FileSystemService');
vi.mock('../../src/services/logger');
vi.mock('../../src/utils/high-quality-diff', () => ({
  highQualityDiff: {
    generateDiff: vi.fn()
  },
  HighQualityDiff: vi.fn()
}));

const mockFileSystemService = {
  mkdir: vi.fn(),
  appendFile: vi.fn(),
};

const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
};

const mockHighQualityDiff = {
  generateDiff: vi.fn()
};

describe('DiffLogger', () => {
  let diffLogger: DiffLogger;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock FileSystemService singleton
    (FileSystemService.getInstance as any) = vi.fn().mockReturnValue(mockFileSystemService);
    
    // Mock Logger singleton
    (Logger.getInstance as any) = vi.fn().mockReturnValue(mockLogger);
    
    // Mock high-quality-diff
    const { highQualityDiff } = await import('../../src/utils/high-quality-diff');
    (highQualityDiff.generateDiff as any) = mockHighQualityDiff.generateDiff;
    
    diffLogger = DiffLogger.getInstance();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = DiffLogger.getInstance();
      const instance2 = DiffLogger.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('logPreciseDiff', () => {
    it('should log precise diff with standard format', async () => {
      mockFileSystemService.mkdir.mockResolvedValue(undefined);
      mockFileSystemService.appendFile.mockResolvedValue(undefined);
      mockHighQualityDiff.generateDiff.mockReturnValue('--- test.txt\n+++ test.txt\n@@ -1,1 +1,1 @@\n-old line\n+new line');

      await diffLogger.logPreciseDiff(
        'old line\n',
        'new line\n',
        'test.txt',
        'Smart Edit'
      );

      expect(mockFileSystemService.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.claude/workspace/effortlessly/logs'),
        { recursive: true }
      );
      expect(mockFileSystemService.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('diff.log'),
        expect.stringContaining('File: test.txt (Smart Edit)'),
        { encoding: 'utf8' }
      );
      expect(mockHighQualityDiff.generateDiff).toHaveBeenCalledWith(
        'old line\n',
        'new line\n',
        'test.txt',
        { contextLines: 3, useColors: true }
      );
    });

    it('should handle empty diff (no changes)', async () => {
      mockFileSystemService.mkdir.mockResolvedValue(undefined);
      mockHighQualityDiff.generateDiff.mockReturnValue(''); // Empty diff

      await diffLogger.logPreciseDiff(
        'same content',
        'same content',
        'test.txt',
        'Smart Edit'
      );

      expect(mockFileSystemService.mkdir).toHaveBeenCalled();
      // appendFile should not be called for empty diff
      expect(mockFileSystemService.appendFile).not.toHaveBeenCalled();
      expect(mockHighQualityDiff.generateDiff).toHaveBeenCalledWith(
        'same content',
        'same content',
        'test.txt',
        { contextLines: 3, useColors: true }
      );
    });

    it('should handle file system errors gracefully', async () => {
      mockFileSystemService.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(diffLogger.logPreciseDiff(
        'old',
        'new',
        'test.txt',
        'Smart Edit'
      )).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log precise diff:',
        expect.any(Error)
      );
    });
  });

  describe('logInsertDiff', () => {
    it('should log insert diff with specialized format', async () => {
      mockFileSystemService.mkdir.mockResolvedValue(undefined);
      mockFileSystemService.appendFile.mockResolvedValue(undefined);

      await diffLogger.logInsertDiff(
        'original content\nline 2\nline 3',
        'inserted line',
        { line_number: 2, column: 0 },
        'test-insert.txt',
        'line_number'
      );

      expect(mockFileSystemService.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.claude/workspace/effortlessly/logs'),
        { recursive: true }
      );
      expect(mockFileSystemService.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('diff.log'),
        expect.stringContaining('File: test-insert.txt (Smart Insert)'),
        { encoding: 'utf8' }
      );
    });

    it('should handle insert with reference text', async () => {
      mockFileSystemService.mkdir.mockResolvedValue(undefined);
      mockFileSystemService.appendFile.mockResolvedValue(undefined);

      await diffLogger.logInsertDiff(
        'function test() {\n  return true;\n}',
        '  console.log("debug");',
        { line_number: 2, column: 0 },
        'script.js',
        'after_text',
        'function test() {'
      );

      expect(mockFileSystemService.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('diff.log'),
        expect.stringContaining('after_text "function test() {"'),
        { encoding: 'utf8' }
      );
    });

    it('should handle file system errors in insert diff', async () => {
      mockFileSystemService.appendFile.mockRejectedValue(new Error('Write failed'));

      await expect(diffLogger.logInsertDiff(
        'content',
        'inserted',
        { line_number: 1, column: 0 },
        'test.txt',
        'line_number'
      )).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log insert diff:',
        expect.any(Error)
      );
    });
  });

  describe('generateInsertSpecificDiff', () => {
    it('should generate correct diff format for line insertion', async () => {
      const originalContent = 'line 1\nline 2\nline 3\nline 4';
      const insertedText = 'inserted line';
      const insertPosition = { line_number: 3, column: 0 };

      // Test private method through public method call
      mockFileSystemService.mkdir.mockResolvedValue(undefined);
      mockFileSystemService.appendFile.mockResolvedValue(undefined);

      await diffLogger.logInsertDiff(
        originalContent,
        insertedText,
        insertPosition,
        'test.txt',
        'line_number'
      );

      expect(mockFileSystemService.appendFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('@@ Insert: +1 lines at line 3 @@'),
        expect.any(Object)
      );
    });
  });

  describe('logNewFileCreation', () => {
    it('should log new file creation', () => {
      const filePath = 'new-file.txt';
      const content = 'Hello World';
      const operation = 'Smart Insert';

      diffLogger.logNewFileCreation(filePath, content, operation);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`File: ${filePath} (${operation} - New File)`)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[NEW FILE CREATED]')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Content:\n${content}`)
      );
    });
  });
});