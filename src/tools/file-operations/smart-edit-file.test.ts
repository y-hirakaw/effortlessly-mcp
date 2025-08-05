import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SmartEditFileTool } from './smart-edit-file.js';

describe('SmartEditFileTool', () => {
  let tempDir: string;
  let testFilePath: string;
  let tool: SmartEditFileTool;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-edit-test-'));
    testFilePath = path.join(tempDir, 'test.txt');
    tool = new SmartEditFileTool();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('基本的な置換機能', () => {
    it('単純な文字列置換が正しく動作する', async () => {
      const testContent = 'Hello World\nThis is a test file\nHello again';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'Hello',
        new_text: 'Hi'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.changes_made).toBe(true);
      expect(resultData.replacement_count).toBe(1);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Hi World\nThis is a test file\nHello again');
    });

    it('新規ファイルを作成できる', async () => {
      const newFilePath = path.join(tempDir, 'new-file.txt');

      const result = await tool.execute({
        file_path: newFilePath,
        old_text: '',
        new_text: 'Hello New File!',
        create_new_file: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.is_new_file).toBe(true);
      expect(resultData.backup_path).toBeUndefined();
      
      expect(await fs.readFile(newFilePath, 'utf-8')).toBe('Hello New File!');
    });

    it('既存ディレクトリ内の新規ファイルは自動作成される', async () => {
      const newFilePath = path.join(tempDir, 'auto-created.txt');

      const result = await tool.execute({
        file_path: newFilePath,
        old_text: '',
        new_text: 'Auto-created content'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.is_new_file).toBe(true);
      
      expect(await fs.readFile(newFilePath, 'utf-8')).toBe('Auto-created content');
    });

    it('存在しないディレクトリの場合はcreate_new_file=trueが必要', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent-dir');
      const newFilePath = path.join(nonExistentDir, 'file.txt');

      const result = await tool.execute({
        file_path: newFilePath,
        old_text: '',
        new_text: 'content',
        create_new_file: false
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ファイルまたは親ディレクトリが存在しません');
    });
  });

  describe('高度な置換機能', () => {
    it('replace_all オプションで複数箇所を置換する', async () => {
      const testContent = 'Hello World\nHello again\nHello everyone';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'Hello',
        new_text: 'Hi',
        replace_all: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.replacement_count).toBe(3);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Hi World\nHi again\nHi everyone');
    });

    it('case_sensitive=false で大文字小文字を無視する', async () => {
      const testContent = 'Hello world\nhello WORLD\nHELLO world';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'hello',
        new_text: 'hi',
        case_sensitive: false,
        replace_all: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.replacement_count).toBe(3);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('hi world\nhi WORLD\nhi world');
    });

    it('置換対象が見つからない場合', async () => {
      const testContent = 'This is a test file';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'nonexistent',
        new_text: 'replaced'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.changes_made).toBe(false);
      expect(resultData.replacement_count).toBe(0);
      expect(resultData.message).toContain('置換対象の文字列が見つかりませんでした');
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe(testContent); // 変更されていない
    });
  });

  describe('プレビューモード', () => {
    it('preview_mode=true で実際の変更を行わない', async () => {
      const testContent = 'Hello World\nThis is a test';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'Hello',
        new_text: 'Hi',
        preview_mode: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.preview_mode).toBe(true);
      expect(resultData.changes_made).toBe(true);
      expect(resultData.replacement_count).toBe(1);
      expect(resultData.preview_content).toBe('Hi World\nThis is a test');
      
      // 実際のファイルは変更されていない
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe(testContent);
    });
  });

  describe('バックアップ機能', () => {
    it('create_backup=true でバックアップファイルを作成する', async () => {
      const testContent = 'Original content';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'Original',
        new_text: 'Modified',
        create_backup: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.backup_path).toBeDefined();
      expect(resultData.backup_path).toContain('.claude/workspace/effortlessly/backups');
      
      // バックアップファイルが存在し、元の内容を含んでいる
      const backupContent = await fs.readFile(resultData.backup_path!, 'utf-8');
      expect(backupContent).toBe(testContent);
    });

    it('create_backup=false でバックアップを作成しない', async () => {
      const testContent = 'Test content';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'Test',
        new_text: 'Modified',
        create_backup: false
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.backup_path).toBeUndefined();
    });
  });

  describe('ファイルサイズ制限', () => {
    it('max_file_size を超えるファイルでエラーになる', async () => {
      const largeContent = 'A'.repeat(1000);
      await fs.writeFile(testFilePath, largeContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'A',
        new_text: 'B',
        max_file_size: 500 // 500 bytes limit
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ファイルサイズが制限を超えています');
    });
  });

  describe('ディレクトリ処理', () => {
    it('ディレクトリを指定するとエラーになる', async () => {
      const dirPath = path.join(tempDir, 'test-dir');
      await fs.mkdir(dirPath);

      const result = await tool.execute({
        file_path: dirPath,
        old_text: 'test',
        new_text: 'replace'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('指定されたパスはディレクトリです');
    });
  });
});