import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { OverrideTextTool } from './override-text.js';

describe('OverrideTextTool', () => {
  let tool: OverrideTextTool;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    tool = new OverrideTextTool();
    
    // Create a temporary directory for testing
    testDir = path.join(process.cwd(), 'test-temp', `override-text-test-${Date.now()}`);
    testFile = path.join(testDir, 'test.txt');
    
    // 確実にディレクトリを作成
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      // 確実にディレクトリを再作成
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
      console.error('Cleanup error:', error);
    }
  });

  describe('メタデータ', () => {
    it('正しいメタデータを持つ', () => {
      expect(tool.metadata.name).toBe('override_text');
      expect(tool.metadata.description).toContain('完全上書きまたは新規ファイル作成');
      expect(tool.metadata.parameters.file_path).toBeDefined();
      expect(tool.metadata.parameters.text).toBeDefined();
    });
  });

  describe('新規ファイル作成', () => {
    it('新規ファイルを正常に作成できる', async () => {
      const testContent = 'Hello, World!';
      
      const result = await tool.execute({
        file_path: testFile,
        text: testContent,
        allow_new_file: true
      });

      expect(result.isError).toBeFalsy();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.operation).toBe('create');
      expect(resultData.new_size).toBe(Buffer.byteLength(testContent, 'utf-8'));

      // ファイルが実際に作成されているか確認
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(testContent);
    });

    it('allow_new_file=falseで存在しないファイルの場合エラーになる', async () => {
      const result = await tool.execute({
        file_path: testFile,
        text: 'test content',
        allow_new_file: false
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ファイルが見つかりません');
    });

    it('ディレクトリを自動作成してファイルを作成できる', async () => {
      const deepPath = path.join(testDir, 'deep', 'nested', 'path', 'test.txt');
      const testContent = 'Deep nested file';
      
      const result = await tool.execute({
        file_path: deepPath,
        text: testContent,
        allow_new_file: true
      });

      expect(result.isError).toBeFalsy();
      
      const fileContent = await fs.readFile(deepPath, 'utf-8');
      expect(fileContent).toBe(testContent);
    });
  });

  describe('既存ファイル上書き', () => {
    beforeEach(async () => {
      // テスト用の既存ファイルを作成
      await fs.writeFile(testFile, 'Original content', 'utf-8');
    });

    it('既存ファイルを正常に上書きできる', async () => {
      const newContent = 'New content after override';
      
      const result = await tool.execute({
        file_path: testFile,
        text: newContent,
        create_backup: false // バックアップなしでテスト
      });

      expect(result.isError).toBeFalsy();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.operation).toBe('override');
      expect(resultData.original_size).toBe(Buffer.byteLength('Original content', 'utf-8'));
      expect(resultData.new_size).toBe(Buffer.byteLength(newContent, 'utf-8'));

      // ファイルが実際に更新されているか確認
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(newContent);
    });

    it('バックアップファイルが作成される', async () => {
      const newContent = 'New content with backup';
      
      const result = await tool.execute({
        file_path: testFile,
        text: newContent,
        create_backup: true
      });

      expect(result.isError).toBeFalsy();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.backup_path).toBeDefined();
      expect(resultData.backup_path).toMatch(/\.backup$/);

      // バックアップファイルが存在し、元の内容が保存されているか確認
      const backupContent = await fs.readFile(resultData.backup_path, 'utf-8');
      expect(backupContent).toBe('Original content');
    });

    it('セキュリティ警告が生成される', async () => {
      // beforeEachで既存ファイルが作成されているはず
      const result = await tool.execute({
        file_path: testFile,
        text: 'New content',
        create_backup: false
      });

      expect(result.isError).toBeFalsy();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.security_warning).toBeDefined();
      expect(resultData.security_warning).toContain('高リスク操作');
    });
  });

  describe('プレビューモード', () => {
    it('プレビューモードでは実際の変更を行わない', async () => {
      await fs.writeFile(testFile, 'Original', 'utf-8');
      const newContent = 'Preview content';
      
      const result = await tool.execute({
        file_path: testFile,
        text: newContent,
        preview_mode: true
      });

      expect(result.isError).toBeFalsy();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.preview_mode).toBe(true);
      expect(resultData.preview_content).toBe(newContent);

      // 元ファイルは変更されていないはず
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe('Original');
    });

    it('新規ファイルのプレビューも可能', async () => {
      const newContent = 'New file preview';
      
      const result = await tool.execute({
        file_path: testFile,
        text: newContent,
        preview_mode: true,
        allow_new_file: true
      });

      expect(result.isError).toBeFalsy();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.preview_mode).toBe(true);
      expect(resultData.operation).toBe('create');
      expect(resultData.preview_content).toBe(newContent);

      // ファイルは実際には作成されていないはず
      try {
        await fs.access(testFile);
        throw new Error('ファイルが作成されてしまった');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('ディレクトリを指定した場合エラーになる', async () => {
      const result = await tool.execute({
        file_path: testDir, // ディレクトリを指定
        text: 'test content'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('指定されたパスはディレクトリです');
    });

    it('ファイルサイズ制限を超える場合エラーになる', async () => {
      const largeContent = 'x'.repeat(1000);
      
      const result = await tool.execute({
        file_path: testFile,
        text: largeContent,
        max_file_size: 500 // 500バイト制限
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('サイズが制限を超えています');
    });

    it('既存の大きなファイルサイズ制限エラー', async () => {
      // 大きなファイルを作成
      const largeContent = 'x'.repeat(2000);
      await fs.writeFile(testFile, largeContent, 'utf-8');
      
      const result = await tool.execute({
        file_path: testFile,
        text: 'small content',
        max_file_size: 1000 // 1000バイト制限
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ファイルサイズが制限を超えています');
    });

    it('不正なファイルパスでエラーハンドリング', async () => {
      const result = await tool.execute({
        file_path: '', // 空パス
        text: 'test content'
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('機密ファイル保護', () => {
    it('.envファイルに対してconfirm_override警告', async () => {
      const envFile = path.join(testDir, '.env');
      await fs.writeFile(envFile, 'OLD_VAR=old_value', 'utf-8');
      
      const result = await tool.execute({
        file_path: envFile,
        text: 'NEW_VAR=new_value',
        confirm_override: false
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('機密ファイル上書き保護');
    });

    it('confirm_override=trueで機密ファイル上書き可能', async () => {
      const envFile = path.join(testDir, '.env');
      await fs.writeFile(envFile, 'OLD_VAR=old_value', 'utf-8');
      
      const result = await tool.execute({
        file_path: envFile,
        text: 'NEW_VAR=new_value',
        confirm_override: true,
        create_backup: false
      });

      expect(result.isError).toBeFalsy();
      
      const fileContent = await fs.readFile(envFile, 'utf-8');
      expect(fileContent).toBe('NEW_VAR=new_value');
    });
  });

  describe('文字エンコーディング', () => {
    it('UTF-8文字を正しく処理できる', async () => {
      const japaneseContent = 'こんにちは、世界！\n日本語テスト文字列';
      
      const result = await tool.execute({
        file_path: testFile,
        text: japaneseContent,
        allow_new_file: true
      });

      expect(result.isError).toBeFalsy();
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(japaneseContent);
    });

    it('バイト数計算が正確', async () => {
      const multibyteContent = '日本語 🚀 UTF-8';
      const expectedBytes = Buffer.byteLength(multibyteContent, 'utf-8');
      
      const result = await tool.execute({
        file_path: testFile,
        text: multibyteContent,
        allow_new_file: true
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.new_size).toBe(expectedBytes);
    });
  });

  describe('エッジケース', () => {
    it('空文字列での上書き', async () => {
      // 既存ファイルを作成
      await fs.writeFile(testFile, 'Some content', 'utf-8');
      
      const result = await tool.execute({
        file_path: testFile,
        text: '', // 空文字列
        create_backup: false
      });

      expect(result.isError).toBeFalsy();
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe('');
    });

    it('非常に長い行を含むコンテンツ', async () => {
      const longLine = 'x'.repeat(10000);
      const content = `line1\n${longLine}\nline3`;
      
      const result = await tool.execute({
        file_path: testFile,
        text: content,
        allow_new_file: true
      });

      expect(result.isError).toBeFalsy();
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });
});
