import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { listDirectoryTool, FileType } from './list-directory.js';

describe('list_directory tool', () => {
  let tempDir: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'effortlessly-test-'));
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  it('ディレクトリの内容を正しく一覧表示する', async () => {
    // テストファイルとディレクトリを作成
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(tempDir, 'file2.js'), 'content2');
    await fs.mkdir(path.join(tempDir, 'subdir'));
    await fs.writeFile(path.join(tempDir, 'subdir', 'file3.md'), 'content3');

    // ツールを実行
    const result = await listDirectoryTool.execute({
      directory_path: tempDir,
      recursive: false,
    });

    // 結果を検証
    expect(result.total_count).toBe(3); // file1.txt, file2.js, subdir
    expect(result.directory).toBe(tempDir);
    
    const names = result.entries.map(e => e.name).sort();
    expect(names).toEqual(['file1.txt', 'file2.js', 'subdir']);

    // ファイルタイプの確認
    const file1 = result.entries.find(e => e.name === 'file1.txt');
    expect(file1?.type).toBe(FileType.FILE);
    expect(file1?.size).toBeGreaterThan(0);

    const subdir = result.entries.find(e => e.name === 'subdir');
    expect(subdir?.type).toBe(FileType.DIRECTORY);
  });

  it('再帰的にディレクトリを一覧表示する', async () => {
    // ネストしたディレクトリ構造を作成
    await fs.mkdir(path.join(tempDir, 'dir1'));
    await fs.mkdir(path.join(tempDir, 'dir1', 'dir2'));
    await fs.writeFile(path.join(tempDir, 'root.txt'), 'root');
    await fs.writeFile(path.join(tempDir, 'dir1', 'file1.txt'), 'content1');
    await fs.writeFile(path.join(tempDir, 'dir1', 'dir2', 'file2.txt'), 'content2');

    // 再帰的に実行
    const result = await listDirectoryTool.execute({
      directory_path: tempDir,
      recursive: true,
    });

    // 結果を検証
    expect(result.total_count).toBe(5); // root.txt, dir1, dir1/file1.txt, dir1/dir2, dir1/dir2/file2.txt
    
    const names = result.entries.map(e => e.name);
    expect(names).toContain('root.txt');
    expect(names).toContain('file1.txt');
    expect(names).toContain('file2.txt');
  });

  it('パターンでファイルをフィルタする', async () => {
    // 様々な拡張子のファイルを作成
    await fs.writeFile(path.join(tempDir, 'test1.txt'), 'content');
    await fs.writeFile(path.join(tempDir, 'test2.js'), 'content');
    await fs.writeFile(path.join(tempDir, 'test3.txt'), 'content');
    await fs.writeFile(path.join(tempDir, 'readme.md'), 'content');

    // .txtファイルのみをフィルタ
    const result = await listDirectoryTool.execute({
      directory_path: tempDir,
      recursive: false,
      pattern: '\\.txt$',
    });

    // 結果を検証
    expect(result.total_count).toBe(2);
    const names = result.entries.map(e => e.name).sort();
    expect(names).toEqual(['test1.txt', 'test3.txt']);
  });

  it('存在しないディレクトリの場合はエラーをスロー', async () => {
    const nonExistentPath = path.join(tempDir, 'non-existent');

    await expect(
      listDirectoryTool.execute({
        directory_path: nonExistentPath,
        recursive: false,
      })
    ).rejects.toThrow('ディレクトリが見つかりません');
  });

  it('ファイルを指定した場合はエラーをスロー', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'content');

    await expect(
      listDirectoryTool.execute({
        directory_path: filePath,
        recursive: false,
      })
    ).rejects.toThrow('指定されたパスはディレクトリではありません');
  });

  it('空のディレクトリを正しく処理する', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    await fs.mkdir(emptyDir);

    const result = await listDirectoryTool.execute({
      directory_path: emptyDir,
      recursive: false,
    });

    expect(result.total_count).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it('相対パスを正しく解決する', async () => {
    // 現在のディレクトリを変更
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      // サブディレクトリを作成
      await fs.mkdir('subdir');
      await fs.writeFile('subdir/file.txt', 'content');

      // 相対パスでツールを実行
      const result = await listDirectoryTool.execute({
        directory_path: './subdir',
        recursive: false,
      });

      expect(result.total_count).toBe(1);
      expect(result.entries[0].name).toBe('file.txt');
    } finally {
      // 元のディレクトリに戻す
      process.chdir(originalCwd);
    }
  });

  it('ファイルの詳細情報を含む', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    const testContent = 'Hello, World!';
    await fs.writeFile(testFile, testContent);

    const result = await listDirectoryTool.execute({
      directory_path: tempDir,
      recursive: false,
    });

    const entry = result.entries[0];
    expect(entry.name).toBe('test.txt');
    expect(entry.size).toBe(testContent.length);
    expect(entry.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO形式
    
    // Unix系システムではパーミッションも確認
    if (process.platform !== 'win32') {
      expect(entry.permissions).toBeDefined();
      expect(entry.permissions).toMatch(/^\d{3}$/); // 3桁の8進数
    }
  });

  it('パターンが無効な正規表現の場合はエラーをスロー', async () => {
    await expect(
      listDirectoryTool.execute({
        directory_path: tempDir,
        recursive: false,
        pattern: '[[invalid regex',
      })
    ).rejects.toThrow();
  });
});