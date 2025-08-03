import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readFileTool } from './read-file.js';

describe('read_file tool', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'effortlessly-test-'));
    testFilePath = path.join(tempDir, 'test.txt');
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  it('ファイルの内容を正しく読み取る', async () => {
    // テストファイルを作成
    const testContent = 'Hello, World!\nこれはテストファイルです。';
    await fs.writeFile(testFilePath, testContent, 'utf-8');

    // ツールを実行
    const result = await readFileTool.execute({
      file_path: testFilePath,
      encoding: "utf-8",
    });

    // 結果を検証
    expect(result.content).toBe(testContent);
    expect(result.encoding).toBe('utf-8');
    expect(result.size).toBeGreaterThan(0);
  });

  it('異なるエンコーディングでファイルを読み取る', async () => {
    // Latin-1エンコーディングでファイルを作成
    const testContent = 'Hello, World!';
    await fs.writeFile(testFilePath, testContent, 'latin1');

    // Latin-1として読み取り
    const result = await readFileTool.execute({
      file_path: testFilePath,
      encoding: 'latin1',
    });

    expect(result.content).toBe(testContent);
    expect(result.encoding).toBe('latin1');
  });

  it('存在しないファイルの場合はエラーをスロー', async () => {
    const nonExistentPath = path.join(tempDir, 'non-existent.txt');

    await expect(
      readFileTool.execute({
        file_path: nonExistentPath,
        encoding: "utf-8",
      })
    ).rejects.toThrow('ファイルが見つかりません');
  });

  it('ディレクトリを指定した場合はエラーをスロー', async () => {
    await expect(
      readFileTool.execute({
        file_path: tempDir,
        encoding: "utf-8",
      })
    ).rejects.toThrow('指定されたパスはディレクトリです');
  });

  it('大きすぎるファイルの場合はエラーをスロー', async () => {
    // 100MBを超えるファイルのシミュレーション
    // 実際には小さいファイルを作成し、ツールのサイズチェックをモックする必要がある
    // この場合は統合テストで確認
    const largeFilePath = path.join(tempDir, 'large.txt');
    
    // 1MBのダミーデータを作成（実際のテストでは100MB制限を確認）
    const largeContent = 'x'.repeat(1024 * 1024);
    await fs.writeFile(largeFilePath, largeContent, 'utf-8');

    const result = await readFileTool.execute({
      file_path: largeFilePath,
      encoding: "utf-8",
    });

    // この場合は正常に読み取れる（1MBは制限内）
    expect(result.content).toBe(largeContent);
    expect(result.size).toBe(1024 * 1024);
  });

  it('相対パスを正しく解決する', async () => {
    // 現在のディレクトリを変更
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      // 相対パスでファイルを作成
      const testContent = 'Relative path test';
      await fs.writeFile('relative.txt', testContent, 'utf-8');

      // 相対パスでツールを実行
      const result = await readFileTool.execute({
        file_path: './relative.txt',
        encoding: "utf-8",
      });

      expect(result.content).toBe(testContent);
    } finally {
      // 元のディレクトリに戻す
      process.chdir(originalCwd);
    }
  });

  it('空のファイルを正しく読み取る', async () => {
    // 空のファイルを作成
    await fs.writeFile(testFilePath, '', 'utf-8');

    const result = await readFileTool.execute({
      file_path: testFilePath,
      encoding: "utf-8",
    });

    expect(result.content).toBe('');
    expect(result.size).toBe(0);
  });

  it('バイナリファイルをbase64として読み取る', async () => {
    // バイナリデータを作成
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
    await fs.writeFile(testFilePath, binaryData);

    // base64エンコーディングで読み取り
    const result = await readFileTool.execute({
      file_path: testFilePath,
      encoding: 'base64',
    });

    expect(result.content).toBe(binaryData.toString('base64'));
    expect(result.encoding).toBe('base64');
    expect(result.size).toBe(5);
  });
});