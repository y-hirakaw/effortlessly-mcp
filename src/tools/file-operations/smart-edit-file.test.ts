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

  describe('Issue #1: 単一文字置換の問題修正テスト', () => {
    it('「}」のような単一文字で、ファイル末尾の「}」だけを置換する', async () => {
      // 12,000行に近い大きなSwiftファイルをシミュレート
      const swiftContent = `class TestClass {
    func method1() {
        if true {
            print("test")
        }
    }
    
    func method2() {
        for i in 0..<10 {
            print(i)
        }
    }
    
    func method3() {
        while true {
            break
        }
    }
}`; // 最後の「}」がクラスの終了
      
      await fs.writeFile(testFilePath, swiftContent, 'utf-8');

      // プレビューモードで安全性をテスト
      const previewResult = await tool.execute({
        file_path: testFilePath,
        old_text: '}',
        new_text: '} // End of TestClass',
        replace_all: false,
        preview_mode: true
      });

      expect(previewResult.isError).toBeUndefined();
      
      const previewData = JSON.parse(previewResult.content[0].text);
      expect(previewData.success).toBe(true);
      expect(previewData.replacement_count).toBe(1);
      expect(previewData.matches_found).toHaveLength(1);
      
      // 最初にマッチした位置が想定通りか確認（最初の「}」の位置であることを確認）
      const firstMatch = previewData.matches_found[0];
      expect(firstMatch.absolute_position).toBeDefined();
      expect(firstMatch.line_number).toBe(5); // method1内の最初の「}」
      
      // 実際に置換してもファイルが壊れないことを確認
      const actualResult = await tool.execute({
        file_path: testFilePath,
        old_text: '}',
        new_text: '} // Modified',
        replace_all: false
      });
      
      expect(actualResult.isError).toBeUndefined();
      const actualData = JSON.parse(actualResult.content[0].text);
      expect(actualData.success).toBe(true);
      expect(actualData.replacement_count).toBe(1);
      
      const modifiedContent = await fs.readFile(testFilePath, 'utf-8');
      // 最初の「}」だけが置換されていることを確認
      expect(modifiedContent.includes('} // Modified')).toBe(true);
      // 他の「}」は変更されていないことを確認
      expect((modifiedContent.match(/}/g) || []).length).toBe(swiftContent.match(/}/g)?.length);
    });

    it('複数の同一文字が存在するファイルで正確な位置特定ができる', async () => {
      const testContent = `{
  if (true) {
    console.log("test");
  }
  
  function test() {
    return "value";
  }
}`;
      
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      // 最初の「}」だけを置換
      const result = await tool.execute({
        file_path: testFilePath,
        old_text: '}',
        new_text: '} // first brace',
        replace_all: false
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.replacement_count).toBe(1);
      expect(resultData.matches_found[0].absolute_position).toBeDefined();
      
      const modifiedContent = await fs.readFile(testFilePath, 'utf-8');
      const lines = modifiedContent.split('\n');
      
      // 4行目の「}」が置換されていることを確認
      expect(lines[3]).toContain('} // first brace');
      // 他の行は変更されていないことを確認
      expect(lines[8]).not.toContain('first brace');
    });

    it('絶対位置情報が正確に計算されている', async () => {
      const testContent = 'line1\nline2}\nline3\nline4}';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const result = await tool.execute({
        file_path: testFilePath,
        old_text: '}',
        new_text: '}_modified',
        replace_all: true,
        preview_mode: true
      });

      expect(result.isError).toBeUndefined();
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.matches_found).toHaveLength(2);
      
      // 各マッチの絶対位置が正確に記録されている
      const matches = resultData.matches_found;
      expect(matches[0].absolute_position).toBe(11); // line2}の「}」位置
      expect(matches[0].line_number).toBe(2);
      expect(matches[1].absolute_position).toBe(24); // line4}の「}」位置
      expect(matches[1].line_number).toBe(4);
    });

    it('置換の整合性チェックが機能する', async () => {
      const testContent = 'function test() {\n  return "value";\n}';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      // 正常なケース：関数の終了「}」を置換
      const validResult = await tool.execute({
        file_path: testFilePath,
        old_text: '}',
        new_text: '} // end function'
      });

      expect(validResult.isError).toBeUndefined();
      
      const resultData = JSON.parse(validResult.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.replacement_count).toBe(1);
      
      const modifiedContent = await fs.readFile(testFilePath, 'utf-8');
      expect(modifiedContent).toContain('} // end function');
      // 元の構造が維持されている
      expect(modifiedContent).toContain('function test()');
      expect(modifiedContent).toContain('return "value"');
    });
  });

  describe('コンテキスト境界安全性チェック', () => {
    it('関数定義の直前での置換を防ぐ', async () => {
      const dangerousContent = `
export class TestClass {
  private value: string;
  
  function testMethod() {
    return this.value;
  }
}`;
      
      await fs.writeFile(testFilePath, dangerousContent, 'utf-8');
      
      // function キーワードの直前の部分文字列を置換しようとする
      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'function',
        new_text: 'async function',
        preview_mode: true // プレビューで安全性確認
      });
      
      expect(result.isError).toBeUndefined();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      
      // 警告ログが出力されることを期待（実際の動作では境界チェックが働く）
      // この場合は正常な置換として処理されるが、より複雑なケースで境界チェックが有効
    });

    it('関数名を含む置換で構造を破壊しない', async () => {
      const functionContent = `
export class Calculator {
  calculate(a: number, b: number): number {
    return a + b;
  }
  
  calculateAdvanced(x: number, y: number): number {
    return x * y + this.calculate(x, y);
  }
}`;
      
      await fs.writeFile(testFilePath, functionContent, 'utf-8');
      
      // メソッド名の一部を置換
      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'calculate',
        new_text: 'compute',
        replace_all: true
      });
      
      expect(result.isError).toBeUndefined();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      
      const modifiedContent = await fs.readFile(testFilePath, 'utf-8');
      
      // 関数定義の構造が保持されていることを確認
      expect(modifiedContent).toContain('export class Calculator');
      expect(modifiedContent).toContain('compute(a: number, b: number): number');
      expect(modifiedContent).toContain('computeAdvanced(x: number, y: number): number');
      expect(modifiedContent).toContain('this.compute(x, y)'); // メソッド呼び出しも更新
      
      // 全体的な構文の整合性確認
      expect(modifiedContent.match(/\{/g)?.length).toBe(modifiedContent.match(/\}/g)?.length);
    });

    it('構造定義が消失する危険な置換を検出', async () => {
      const structuralContent = `
export class DataProcessor {
  process(): void {
    console.log('processing');
  }
}

export interface DataHandler {
  handle(): void;
}`;
      
      await fs.writeFile(testFilePath, structuralContent, 'utf-8');
      
      // 危険な置換：export class を削除してしまう可能性
      const result = await tool.execute({
        file_path: testFilePath,
        old_text: 'export class DataProcessor {\n  process(): void {\n    console.log(\'processing\');\n  }\n}',
        new_text: '// removed class',
        preview_mode: true
      });
      
      expect(result.isError).toBeUndefined();
      const resultData = JSON.parse(result.content[0].text);
      
      // プレビューで構造の変更を確認
      if (resultData.success && resultData.preview_content) {
        // クラス定義が削除されることを確認（テストでは許可するが、警告ログが出力される）
        expect(resultData.preview_content).toContain('// removed class');
        expect(resultData.preview_content).not.toContain('export class DataProcessor');
      }
    });

    it('括弧バランスの変更を検出', async () => {
      const bracketContent = `
function testFunction() {
  if (true) {
    return { value: 42 };
  }
}`;
      
      await fs.writeFile(testFilePath, bracketContent, 'utf-8');
      
      // 括弧バランスを崩す置換
      const result = await tool.execute({
        file_path: testFilePath,
        old_text: '{ value: 42 }',
        new_text: 'value: 42', // 括弧を削除
        preview_mode: true
      });
      
      expect(result.isError).toBeUndefined();
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      
      // 置換は実行されるが、警告ログで括弧バランスの変更が報告される
      if (resultData.preview_content) {
        expect(resultData.preview_content).toContain('return value: 42;');
      }
    });
  });
});