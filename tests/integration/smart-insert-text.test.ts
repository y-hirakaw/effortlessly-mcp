import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { SmartInsertTextTool } from '../../src/tools/file-operations/smart-insert-text';

describe('SmartInsertTextTool Integration', () => {
  const testDir = path.join(__dirname, '../test-temp');
  let smartInsertTool: SmartInsertTextTool;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    smartInsertTool = new SmartInsertTextTool();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('line_number position', () => {
    it('should insert text at specific line number', async () => {
      const testFile = path.join(testDir, 'line-insert.txt');
      const initialContent = 'Line 1\nLine 2\nLine 3\nLine 4';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'Inserted at line 3',
        position_type: 'line_number',
        line_number: 3
      });

      expect(result.success).toBe(true);
      expect(result.text_inserted).toBe(true);
      expect(result.insert_position?.line_number).toBe(3);

      const finalContent = await fs.readFile(testFile, 'utf-8');
      const lines = finalContent.split('\n');
      expect(lines[2]).toBe('Inserted at line 3');
      expect(lines[3]).toBe('Line 3');
    });

    it('should handle insertion at file start', async () => {
      const testFile = path.join(testDir, 'start-insert.txt');
      const initialContent = 'Original first line\nSecond line';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'New first line',
        position_type: 'line_number',
        line_number: 1
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      const lines = finalContent.split('\n');
      expect(lines[0]).toBe('New first line');
      expect(lines[1]).toBe('Original first line');
    });

    it('should handle insertion at file end', async () => {
      const testFile = path.join(testDir, 'end-insert.txt');
      const initialContent = 'First line\nSecond line';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'Last line',
        position_type: 'line_number',
        line_number: 3
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      const lines = finalContent.split('\n');
      expect(lines[2]).toBe('Last line');
    });
  });

  describe('relative position', () => {
    it('should insert after specific text', async () => {
      const testFile = path.join(testDir, 'after-insert.txt');
      const initialContent = 'function test() {\n  let x = 1;\n  return x;\n}';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: '  console.log("debug");',
        position_type: 'after_text',
        reference_text: 'let x = 1;'
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toContain('let x = 1;\n  console.log("debug");\n  return x;');
    });

    it('should insert before specific text', async () => {
      const testFile = path.join(testDir, 'before-insert.txt');
      const initialContent = 'function test() {\n  return x;\n}';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: '  let x = 1;',
        position_type: 'before_text',
        reference_text: 'return x;'
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toContain('{\n  let x = 1;\n  return x;');
    });
  });

  describe('start and end positions', () => {
    it('should insert at file start', async () => {
      const testFile = path.join(testDir, 'start-position.js');
      const initialContent = 'function main() {\n  console.log("Hello");\n}';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: '#!/usr/bin/env node\n"use strict";',
        position_type: 'start'
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      const lines = finalContent.split('\n');
      expect(lines[0]).toBe('#!/usr/bin/env node');
      expect(lines[1]).toBe('"use strict";');
      expect(lines[2]).toBe('function main() {');
    });

    it('should insert at file end', async () => {
      const testFile = path.join(testDir, 'end-position.js');
      const initialContent = 'function test() {\n  return true;\n}';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: '\nmodule.exports = { test };',
        position_type: 'end'
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent.endsWith('}\n\nmodule.exports = { test };')).toBe(true);
    });
  });

  describe('new file creation', () => {
    it('should create new file when file does not exist', async () => {
      const testFile = path.join(testDir, 'new-file.js');

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'console.log("Hello World");',
        position_type: 'start'
      });

      expect(result.success).toBe(true);
      expect(result.is_new_file).toBe(true);
      expect(result.original_line_count).toBe(1); // Empty file has 1 line
      expect(result.new_line_count).toBe(2); // Empty line + inserted content

      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toBe('console.log("Hello World");\n');
    });

    it('should handle multiline content in new file', async () => {
      const testFile = path.join(testDir, 'multiline-new.js');
      const content = 'function greet(name) {\n  console.log(`Hello, ${name}!`);\n}\n\ngreet("World");';

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: content,
        position_type: 'start'
      });

      expect(result.success).toBe(true);
      expect(result.is_new_file).toBe(true);
      expect(result.new_line_count).toBe(6); // 5 lines of content + 1 empty line

      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toBe(content + '\n');
    });
  });

  describe('auto-indent feature', () => {
    it('should auto-indent inserted code', async () => {
      const testFile = path.join(testDir, 'indent-test.js');
      const initialContent = 'function test() {\n  if (true) {\n    console.log("start");\n  }\n}';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'console.log("middle");',
        position_type: 'after_text',
        reference_text: 'console.log("start");',
        auto_indent: true
      });

      expect(result.success).toBe(true);
      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toContain('    console.log("start");\n    console.log("middle");');
    });
  });

  describe('backup creation', () => {
    it('should create backup when specified', async () => {
      const testFile = path.join(testDir, 'backup-test.txt');
      const initialContent = 'Original content';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'New line',
        position_type: 'end',
        create_backup: true
      });

      expect(result.success).toBe(true);
      expect(result.backup_path).toBeDefined();
      
      if (result.backup_path) {
        const backupContent = await fs.readFile(result.backup_path, 'utf-8');
        expect(backupContent).toBe(initialContent);
      }
    });
  });

  describe('preview mode', () => {
    it('should not modify file in preview mode', async () => {
      const testFile = path.join(testDir, 'preview-test.txt');
      const initialContent = 'Original content';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'This should not be inserted',
        position_type: 'end',
        preview_mode: true
      });

      expect(result.success).toBe(true);
      expect(result.text_inserted).toBe(false);

      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toBe(initialContent);
    });
  });

  describe('error handling', () => {
    it('should handle invalid line number', async () => {
      const testFile = path.join(testDir, 'invalid-line.txt');
      const initialContent = 'Line 1\nLine 2';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'Invalid insertion',
        position_type: 'line_number',
        line_number: 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Line number 100 is beyond file length');
    });

    it('should handle missing reference text', async () => {
      const testFile = path.join(testDir, 'missing-ref.txt');
      const initialContent = 'Some content';
      await fs.writeFile(testFile, initialContent);

      const result = await smartInsertTool.execute({
        file_path: testFile,
        text: 'New text',
        position_type: 'after_text',
        reference_text: 'Non-existent text'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reference text not found');
    });
  });
});