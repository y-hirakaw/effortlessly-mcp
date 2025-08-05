import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SmartInsertTextTool } from './smart-insert-text.js';

describe('SmartInsertTextTool', () => {
  let tempDir: string;
  let testFilePath: string;
  let tool: SmartInsertTextTool;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-insert-test-'));
    testFilePath = path.join(tempDir, 'test.txt');
    tool = new SmartInsertTextTool();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  describe('基本的な挿入機能', () => {
    it('行番号指定でテキストを挿入する', async () => {
      const testContent = 'Line 1\nLine 2\nLine 3';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Inserted Line',
        position_type: 'line_number',
        line_number: 2
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.text_inserted).toBe(true);
      expect(resultData.insert_position.line_number).toBe(2);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Line 1\nInserted Line\nLine 2\nLine 3');
    });

    it('ファイルの開始位置にテキストを挿入する', async () => {
      const testContent = 'Existing line';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'First line',
        position_type: 'start'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.insert_position.line_number).toBe(1);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('First line\nExisting line');
    });

    it('ファイルの終端にテキストを挿入する', async () => {
      const testContent = 'Existing line';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Last line',
        position_type: 'end'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.insert_position.line_number).toBe(2);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Existing line\nLast line');
    });
  });

  describe('相対位置による挿入', () => {
    it('指定したテキストの後に挿入する', async () => {
      const testContent = 'Line A\nTarget line\nLine C';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'After target',
        position_type: 'after_text',
        reference_text: 'Target line'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.insert_position.line_number).toBe(3);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Line A\nTarget line\nAfter target\nLine C');
    });

    it('指定したテキストの前に挿入する', async () => {
      const testContent = 'Line A\nTarget line\nLine C';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Before target',
        position_type: 'before_text',
        reference_text: 'Target line'
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.insert_position.line_number).toBe(2);
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Line A\nBefore target\nTarget line\nLine C');
    });

    it('参照テキストが見つからない場合エラーになる', async () => {
      const testContent = 'Line 1\nLine 2';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Insert text',
        position_type: 'after_text',
        reference_text: 'nonexistent'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('参照テキストが見つかりません');
    });
  });

  describe('自動インデント機能', () => {
    it('auto_indent=true で前の行のインデントを適用する', async () => {
      const testContent = '  function test() {\n    return true;\n  }';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'console.log("debug");',
        position_type: 'line_number',
        line_number: 3,
        auto_indent: true
      });

      expect(result.isError).toBeUndefined();
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('  function test() {\n    return true;\n    console.log("debug");\n  }');
    });

    it('auto_indent=false でインデントを適用しない', async () => {
      const testContent = '  function test() {\n    return true;\n  }';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'console.log("debug");',
        position_type: 'line_number',
        line_number: 3,
        auto_indent: false
      });

      expect(result.isError).toBeUndefined();
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('  function test() {\n    return true;\nconsole.log("debug");\n  }');
    });
  });

  describe('プレビューモード', () => {
    it('preview_mode=true で実際の変更を行わない', async () => {
      const testContent = 'Original content';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Inserted text',
        position_type: 'end',
        preview_mode: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.preview_mode).toBe(true);
      expect(resultData.text_inserted).toBe(true);
      expect(resultData.preview_content).toBe('Original content\nInserted text');
      
      // 実際のファイルは変更されていない
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe(testContent);
    });
  });

  describe('新規ファイル作成', () => {
    it('create_new_file=true で新規ファイルを作成する', async () => {
      const newFilePath = path.join(tempDir, 'new-file.txt');

      const result = await tool.execute({
        file_path: newFilePath,
        text: 'New file content',
        position_type: 'start',
        create_new_file: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.is_new_file).toBe(true);
      expect(resultData.backup_path).toBeUndefined();
      
      expect(await fs.readFile(newFilePath, 'utf-8')).toBe('New file content\n');
    });

    it('既存ディレクトリ内の新規ファイルは自動作成される（smart-insert-text）', async () => {
      const newFilePath = path.join(tempDir, 'nonexistent.txt');

      const result = await tool.execute({
        file_path: newFilePath,
        text: 'Some text',
        position_type: 'start',
        create_new_file: false
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.is_new_file).toBe(true);
      
      expect(await fs.readFile(newFilePath, 'utf-8')).toBe('Some text\n');
    });
  });

  describe('バックアップ機能', () => {
    it('create_backup=true でバックアップファイルを作成する', async () => {
      const testContent = 'Original content';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Inserted text',
        position_type: 'end',
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
        text: 'Inserted text',
        position_type: 'end',
        create_backup: false
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.backup_path).toBeUndefined();
    });
  });

  describe('パラメータ検証', () => {
    it('line_number指定時にline_numberが未定義だとエラーになる', async () => {
      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Some text',
        position_type: 'line_number'
        // line_numberが未定義
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('line_numberパラメータが必要です');
    });

    it('参照テキスト指定時にreference_textが未定義だとエラーになる', async () => {
      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Some text',
        position_type: 'after_text'
        // reference_textが未定義
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('reference_textパラメータが必要です');
    });

    it('行番号が範囲外だとエラーになる', async () => {
      const testContent = 'Line 1\nLine 2';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Some text',
        position_type: 'line_number',
        line_number: 100 // 範囲外
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('指定された行番号がファイルの行数を超えています');
    });
  });

  describe('複数行挿入', () => {
    it('改行を含むテキストを正しく挿入する', async () => {
      const testContent = 'Line 1\nLine 2';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const multiLineText = 'Inserted Line A\nInserted Line B\nInserted Line C';
      const result = await tool.execute({
        file_path: testFilePath,
        text: multiLineText,
        position_type: 'line_number',
        line_number: 2
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.new_line_count).toBe(5); // 元2行 + 挿入3行
      
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      expect(fileContent).toBe('Line 1\nInserted Line A\nInserted Line B\nInserted Line C\nLine 2');
    });
  });

  describe('ファイルサイズ制限', () => {
    it('max_file_size を超えるファイルでエラーになる', async () => {
      const largeContent = 'A'.repeat(1000);
      await fs.writeFile(testFilePath, largeContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        text: 'Insert text',
        position_type: 'end',
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
        text: 'Some text',
        position_type: 'start'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('指定されたパスはディレクトリです');
    });
  });
});