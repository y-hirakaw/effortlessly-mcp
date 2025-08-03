import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getFileMetadataTool, FileType } from './get-file-metadata.js';

describe('get_file_metadata tool', () => {
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

  it('ファイルのメタデータを正しく取得する', async () => {
    // テストファイルを作成
    const testFilePath = path.join(tempDir, 'test.txt');
    const testContent = 'Hello, World!';
    await fs.writeFile(testFilePath, testContent);

    // ツールを実行
    const result = await getFileMetadataTool.execute({
      file_path: testFilePath,
    });

    // 結果を検証
    expect(result.path).toBe(testFilePath);
    expect(result.name).toBe('test.txt');
    expect(result.type).toBe(FileType.FILE);
    expect(result.size).toBe(testContent.length);
    expect(result.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO形式
    expect(result.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO形式
    expect(result.accessed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO形式
    expect(result.is_readable).toBe(true);
    expect(result.is_writable).toBe(true);

    // Unix系システムではパーミッションも確認
    if (process.platform !== 'win32') {
      expect(result.permissions).toBeDefined();
      expect(result.permissions).toMatch(/^\d{3}$/); // 3桁の8進数
      expect(result.owner).toBeDefined();
      expect(result.owner?.uid).toBeTypeOf('number');
      expect(result.owner?.gid).toBeTypeOf('number');
    }
  });

  it('ディレクトリのメタデータを正しく取得する', async () => {
    // テストディレクトリを作成
    const testDirPath = path.join(tempDir, 'testdir');
    await fs.mkdir(testDirPath);

    // ツールを実行
    const result = await getFileMetadataTool.execute({
      file_path: testDirPath,
    });

    // 結果を検証
    expect(result.path).toBe(testDirPath);
    expect(result.name).toBe('testdir');
    expect(result.type).toBe(FileType.DIRECTORY);
    expect(result.size).toBeGreaterThanOrEqual(0);
    expect(result.is_readable).toBe(true);
    expect(result.is_executable).toBe(true); // ディレクトリは実行可能
  });

  it('存在しないファイルの場合はエラーをスロー', async () => {
    const nonExistentPath = path.join(tempDir, 'non-existent.txt');

    await expect(
      getFileMetadataTool.execute({
        file_path: nonExistentPath,
      })
    ).rejects.toThrow('ファイルが見つかりません');
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
      const result = await getFileMetadataTool.execute({
        file_path: './relative.txt',
      });

      expect(result.name).toBe('relative.txt');
      expect(result.size).toBe(testContent.length);
      // 相対パスが正しく解決されていることを確認（絶対パスになっているか）
      expect(path.isAbsolute(result.path)).toBe(true);
      expect(result.path.endsWith('relative.txt')).toBe(true);
    } finally {
      // 元のディレクトリに戻す
      process.chdir(originalCwd);
    }
  });

  it('空のファイルのメタデータを正しく取得する', async () => {
    // 空のファイルを作成
    const emptyFilePath = path.join(tempDir, 'empty.txt');
    await fs.writeFile(emptyFilePath, '');

    const result = await getFileMetadataTool.execute({
      file_path: emptyFilePath,
    });

    expect(result.size).toBe(0);
    expect(result.type).toBe(FileType.FILE);
  });

  it('実行可能ファイルを正しく識別する', async () => {
    if (process.platform === 'win32') {
      // Windowsでは実行可能性の検査をスキップ
      return;
    }

    // 実行可能ファイルを作成
    const executablePath = path.join(tempDir, 'executable.sh');
    await fs.writeFile(executablePath, '#!/bin/bash\necho "hello"');
    await fs.chmod(executablePath, 0o755);

    const result = await getFileMetadataTool.execute({
      file_path: executablePath,
    });

    expect(result.is_executable).toBe(true);
    expect(result.permissions).toBe('755');
  });

  it('読み取り専用ファイルを正しく識別する', async () => {
    if (process.platform === 'win32') {
      // Windowsでは権限設定が異なるためスキップ
      return;
    }

    // 読み取り専用ファイルを作成
    const readOnlyPath = path.join(tempDir, 'readonly.txt');
    await fs.writeFile(readOnlyPath, 'readonly content');
    await fs.chmod(readOnlyPath, 0o444);

    const result = await getFileMetadataTool.execute({
      file_path: readOnlyPath,
    });

    expect(result.is_readable).toBe(true);
    expect(result.is_writable).toBe(false);
    expect(result.permissions).toBe('444');
  });

  it('シンボリックリンクを正しく識別する', async () => {
    if (process.platform === 'win32') {
      // Windowsではシンボリックリンクの作成権限が必要なためスキップ
      return;
    }

    // 元ファイルとシンボリックリンクを作成
    const originalPath = path.join(tempDir, 'original.txt');
    const linkPath = path.join(tempDir, 'link.txt');
    
    await fs.writeFile(originalPath, 'original content');
    await fs.symlink(originalPath, linkPath);

    const result = await getFileMetadataTool.execute({
      file_path: linkPath,
    });

    // statはリンク先を解決するため、ファイルタイプはFILEになる
    expect(result.type).toBe(FileType.FILE);
    expect(result.name).toBe('link.txt');
  });

  it('ファイル名に特殊文字が含まれている場合も正しく処理する', async () => {
    // 特殊文字を含むファイル名
    const specialFileName = 'test file with spaces & symbols.txt';
    const specialFilePath = path.join(tempDir, specialFileName);
    await fs.writeFile(specialFilePath, 'content');

    const result = await getFileMetadataTool.execute({
      file_path: specialFilePath,
    });

    expect(result.name).toBe(specialFileName);
    expect(result.path).toBe(specialFilePath);
  });

  it('日時情報が正しい形式で返される', async () => {
    const testFilePath = path.join(tempDir, 'datetime-test.txt');
    await fs.writeFile(testFilePath, 'content');

    const result = await getFileMetadataTool.execute({
      file_path: testFilePath,
    });

    // ISO 8601形式の検証
    expect(result.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(result.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(result.accessed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // 日付の妥当性確認
    expect(new Date(result.created).getTime()).toBeGreaterThan(0);
    expect(new Date(result.modified).getTime()).toBeGreaterThan(0);
    expect(new Date(result.accessed).getTime()).toBeGreaterThan(0);
  });
});