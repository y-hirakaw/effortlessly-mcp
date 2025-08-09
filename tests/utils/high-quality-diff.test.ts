import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HighQualityDiff, highQualityDiff } from '../../src/utils/high-quality-diff';
import * as fs from 'fs';
import * as path from 'path';

describe('HighQualityDiff', () => {
  let diffInstance: HighQualityDiff;
  
  beforeEach(() => {
    diffInstance = new HighQualityDiff();
  });

  describe('generateDiff', () => {
    it('should generate basic edit diff', () => {
      const result = diffInstance.generateDiff(
        'Hello World',
        'Hello TypeScript',
        'test.txt'
      );

      expect(result).toContain('--- test.txt');
      expect(result).toContain('+++ test.txt');
      expect(result).toContain('-Hello World');
      expect(result).toContain('+Hello TypeScript');
    });

    it('should handle multiline content', () => {
      const oldContent = 'Line 1\nLine 2\nLine 3';
      const newContent = 'Line 1\nModified Line 2\nLine 3';

      const result = diffInstance.generateDiff(
        oldContent,
        newContent,
        'multiline.txt'
      );

      expect(result).toContain('-Line 2');
      expect(result).toContain('+Modified Line 2');
      expect(result).toContain('Line 1');
      // Note: Line 3 may not appear in compact diff output
    });

    it('should handle empty content (new file)', () => {
      const result = diffInstance.generateDiff(
        '',
        'New content',
        'empty.txt'
      );

      expect(result).toContain('--- /dev/null');
      expect(result).toContain('+++ empty.txt');
      expect(result).toContain('+New content');
    });

    it('should handle file deletion', () => {
      const result = diffInstance.generateDiff(
        'Content to delete',
        '',
        'deleted.txt'
      );

      expect(result).toContain('--- deleted.txt');
      expect(result).toContain('+++ /dev/null');
      expect(result).toContain('-Content to delete');
    });

    it('should handle no changes', () => {
      const result = diffInstance.generateDiff(
        'same content',
        'same content',
        'unchanged.txt'
      );

      expect(result).toBe('');
    });

    it('should handle large changes with summary', () => {
      const oldContent = 'line\n'.repeat(1000);
      const newContent = 'new line\n'.repeat(1200);

      const result = diffInstance.generateDiff(
        oldContent,
        newContent,
        'large.txt'
      );

      expect(result).toContain('@@ Large change:');
      expect(result).toContain('[Use git diff for detailed view]');
    });
  });

  describe('generateSimpleLineDiff', () => {
    it('should generate simple line-by-line diff', () => {
      const oldContent = 'Hello\nWorld';
      const newContent = 'Hello\nUniverse';

      const result = diffInstance.generateSimpleLineDiff(oldContent, newContent);

      // Test that it contains the correct lines (may include ANSI codes)
      expect(result).toContain('Hello');
      expect(result).toContain('-World');
      expect(result).toContain('+Universe');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters', () => {
      const content = 'const regex = /[.*+?^${}()|[\\]\\\\]/g;';
      const result = diffInstance.generateDiff(
        '',
        content,
        'regex.js'
      );

      expect(result).toContain('+const regex = /[.*+?^${}()|[\\]\\\\]/g;');
    });

    it('should handle unicode characters', () => {
      const content = 'console.log("こんにちは世界! 🌍");';
      const result = diffInstance.generateDiff(
        '',
        content,
        'unicode.js'
      );

      expect(result).toContain('+console.log("こんにちは世界! 🌍");');
    });

    it('should handle very long lines', () => {
      const longLine = 'a'.repeat(1000);
      const result = diffInstance.generateDiff(
        '',
        longLine,
        'long.txt'
      );

      expect(result).toContain(`+${longLine}`);
    });
  });

  describe('diff threshold logic', () => {
    const configPath = path.resolve('.claude/workspace/effortlessly/config/diff-display.yaml');
    const testConfigDir = path.dirname(configPath);
    let originalConfig: string | null = null;

    beforeEach(() => {
      // Backup original config if it exists
      if (fs.existsSync(configPath)) {
        originalConfig = fs.readFileSync(configPath, 'utf-8');
      }
      // Ensure config directory exists
      fs.mkdirSync(testConfigDir, { recursive: true });
    });

    afterEach(() => {
      // Restore original config or remove test config
      if (originalConfig) {
        fs.writeFileSync(configPath, originalConfig);
      } else if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      originalConfig = null;
    });

    it('should use diff change amount instead of file size for threshold', () => {
      // 大きなファイルでも少しの変更ならば詳細diff表示
      const largeContent = 'line\n'.repeat(1000); // 1000行のファイル
      const smallChange = largeContent.replace('line', 'modified'); // 1行だけ変更

      const result = diffInstance.generateDiff(
        largeContent,
        smallChange,
        'large.txt'
      );

      // 変更量が少ないので詳細diff表示されるべき
      expect(result).toContain('--- large.txt');
      expect(result).toContain('+++ large.txt');
      expect(result).toContain('+modified'); // 追加行として表示される
      expect(result).toContain('-line'); // 削除行として表示される
    });

    it('should use summary for large changes regardless of file size', () => {
      const config = `
# Test configuration
enabled: true
max_lines_for_detailed_diff: 10
`;
      fs.writeFileSync(configPath, config);

      // 小さなファイルでも大量変更があればサマリー表示
      const oldContent = 'line1\nline2\nline3\nline4\nline5\n';
      const newContent = 'newline1\nnewline2\nnewline3\nnewline4\nnewline5\nnewline6\nnewline7\nnewline8\nnewline9\nnewline10\nnewline11\nnewline12\n';

      const result = diffInstance.generateDiff(
        oldContent,
        newContent,
        'small.txt'
      );

      // 変更量が多いのでサマリー表示されるべき
      expect(result).toContain('@@ Large change:');
      expect(result).toContain('[Use git diff for detailed view]');
    });
  });

  describe('enabled configuration', () => {
    const configPath = path.resolve('.claude/workspace/effortlessly/config/diff-display.yaml');
    const testConfigDir = path.dirname(configPath);
    let originalConfig: string | null = null;

    beforeEach(() => {
      // Backup original config if it exists
      if (fs.existsSync(configPath)) {
        originalConfig = fs.readFileSync(configPath, 'utf-8');
      }
      // Ensure config directory exists
      fs.mkdirSync(testConfigDir, { recursive: true });
    });

    afterEach(() => {
      // Restore original config or remove test config
      if (originalConfig) {
        fs.writeFileSync(configPath, originalConfig);
      } else if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      originalConfig = null;
    });

    it('should generate diff when enabled is true (default)', () => {
      const config = `
# Test configuration
enabled: true
max_lines_for_detailed_diff: 500
display_options:
  default_context_lines: 3
  use_colors: false
`;
      fs.writeFileSync(configPath, config);

      const result = diffInstance.generateDiff(
        'old content',
        'new content',
        'test.txt'
      );

      expect(result).toContain('--- test.txt');
      expect(result).toContain('+++ test.txt');
      expect(result).toContain('-old content');
      expect(result).toContain('+new content');
    });

    it('should return empty string when enabled is false', () => {
      const config = `
# Test configuration
enabled: false
max_lines_for_detailed_diff: 500
display_options:
  default_context_lines: 3
  use_colors: false
`;
      fs.writeFileSync(configPath, config);

      const result = diffInstance.generateDiff(
        'old content',
        'new content',
        'test.txt'
      );

      expect(result).toBe('');
    });

    it('should generate diff when enabled is not specified (defaults to true)', () => {
      const config = `
# Test configuration without enabled field
max_lines_for_detailed_diff: 500
display_options:
  default_context_lines: 3
  use_colors: false
`;
      fs.writeFileSync(configPath, config);

      const result = diffInstance.generateDiff(
        'old content',
        'new content',
        'test.txt'
      );

      expect(result).toContain('--- test.txt');
      expect(result).toContain('+++ test.txt');
      expect(result).toContain('-old content');
      expect(result).toContain('+new content');
    });

    it('should work with enabled false even for large files', () => {
      const config = `
# Test configuration
enabled: false
max_lines_for_detailed_diff: 10
`;
      fs.writeFileSync(configPath, config);

      const largeContent = 'line\n'.repeat(100);
      const result = diffInstance.generateDiff(
        largeContent,
        largeContent + 'new line\n',
        'large.txt'
      );

      expect(result).toBe('');
    });

    it('should work with enabled false even for new files', () => {
      const config = `
# Test configuration  
enabled: false
`;
      fs.writeFileSync(configPath, config);

      const result = diffInstance.generateDiff(
        '',
        'new file content',
        'new.txt'
      );

      expect(result).toBe('');
    });

    it('should work with enabled false even for deleted files', () => {
      const config = `
# Test configuration
enabled: false
`;
      fs.writeFileSync(configPath, config);

      const result = diffInstance.generateDiff(
        'content to delete',
        '',
        'deleted.txt'
      );

      expect(result).toBe('');
    });
  });

  describe('singleton instance', () => {
    it('should use singleton instance correctly', () => {
      const result = highQualityDiff.generateDiff(
        'old',
        'new',
        'test.txt'
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('--- test.txt');
      expect(result).toContain('+++ test.txt');
    });
  });
});