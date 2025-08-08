import { describe, it, expect, beforeEach } from 'vitest';
import { HighQualityDiff, highQualityDiff } from '../../src/utils/high-quality-diff';

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
      const oldContent = 'line\n'.repeat(30);
      const newContent = 'new line\n'.repeat(40);

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