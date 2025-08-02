import { describe, it, expect } from 'vitest';
import { isPathSafe, isFileSizeValid, emailSchema, pathSchema } from './validation.js';

describe('validation utilities', () => {
  describe('isPathSafe', () => {
    it('should accept safe paths', () => {
      expect(isPathSafe('src/index.ts')).toBe(true);
      expect(isPathSafe('/home/user/project/file.ts')).toBe(true);
      expect(isPathSafe('C:\\Users\\project\\file.ts')).toBe(true);
    });

    it('should reject paths with traversal attempts', () => {
      expect(isPathSafe('../secret.txt')).toBe(false);
      expect(isPathSafe('../../etc/passwd')).toBe(false);
      expect(isPathSafe('~/ssh/id_rsa')).toBe(false);
    });
  });

  describe('isFileSizeValid', () => {
    it('should accept valid file sizes', () => {
      expect(isFileSizeValid(0)).toBe(true);
      expect(isFileSizeValid(1024)).toBe(true);
      expect(isFileSizeValid(1048576)).toBe(true); // 1MB
    });

    it('should reject invalid file sizes', () => {
      expect(isFileSizeValid(-1)).toBe(false);
      expect(isFileSizeValid(1048577)).toBe(false); // > 1MB
    });

    it('should respect custom max size', () => {
      expect(isFileSizeValid(2048, 1024)).toBe(false);
      expect(isFileSizeValid(512, 1024)).toBe(true);
    });
  });

  describe('emailSchema', () => {
    it('should validate correct emails', () => {
      expect(() => emailSchema.parse('user@example.com')).not.toThrow();
      expect(() => emailSchema.parse('test.user+tag@domain.co.uk')).not.toThrow();
    });

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid')).toThrow();
      expect(() => emailSchema.parse('@example.com')).toThrow();
      expect(() => emailSchema.parse('user@')).toThrow();
    });
  });

  describe('pathSchema', () => {
    it('should validate safe paths', () => {
      expect(() => pathSchema.parse('src/index.ts')).not.toThrow();
      expect(() => pathSchema.parse('/absolute/path.ts')).not.toThrow();
    });

    it('should reject unsafe paths', () => {
      expect(() => pathSchema.parse('../traversal')).toThrow();
      expect(() => pathSchema.parse('~/home')).toThrow();
    });
  });
});