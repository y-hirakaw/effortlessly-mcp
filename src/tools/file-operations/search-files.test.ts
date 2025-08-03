import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { searchFilesTool } from './search-files.js';

describe('search_files tool', () => {
  let tempDir: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'effortlessly-search-test-'));
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  it('ファイル名パターンで検索する', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'console.log("Hello");');
    await fs.writeFile(path.join(tempDir, 'test.js'), 'console.log("World");');
    await fs.writeFile(path.join(tempDir, 'readme.md'), '# README');

    // .tsファイルを検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.ts',
      recursive: false,
    });

    expect(result.total_found).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('test.ts');
    expect(result.results[0].type).toBe('file');
    expect(result.search_info.files_scanned).toBe(3);
  });

  it('ファイル内容で検索する', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'Hello World\nGoodbye World');
    await fs.writeFile(path.join(tempDir, 'file2.txt'), 'Hello Universe\nGoodbye Galaxy');
    await fs.writeFile(path.join(tempDir, 'file3.txt'), 'No match here');

    // "World"を検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      content_pattern: 'World',
      include_content: true,
      recursive: false,
    });

    expect(result.total_found).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('file1.txt');
    expect(result.results[0].matches).toHaveLength(2); // 2行にマッチ
    expect(result.results[0].matches![0].line_number).toBe(1);
    expect(result.results[0].matches![0].line_content).toBe('Hello World');
    expect(result.results[0].matches![1].line_number).toBe(2);
    expect(result.results[0].matches![1].line_content).toBe('Goodbye World');
  });

  it('ファイル名とファイル内容の両方で検索する', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'config.json'), '{"name": "test"}');
    await fs.writeFile(path.join(tempDir, 'data.json'), '{"value": 123}');
    await fs.writeFile(path.join(tempDir, 'config.txt'), '{"name": "test"}');

    // .jsonファイルで"name"を含むものを検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.json',
      content_pattern: 'name',
      include_content: true,
      recursive: false,
    });

    expect(result.total_found).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('config.json');
    expect(result.results[0].matches).toHaveLength(1);
  });

  it('再帰的に検索する', async () => {
    // ネストした構造を作成
    const subDir = path.join(tempDir, 'subdir');
    const nestedDir = path.join(subDir, 'nested');
    await fs.mkdir(subDir);
    await fs.mkdir(nestedDir);

    await fs.writeFile(path.join(tempDir, 'root.ts'), 'root file');
    await fs.writeFile(path.join(subDir, 'sub.ts'), 'sub file');
    await fs.writeFile(path.join(nestedDir, 'nested.ts'), 'nested file');

    // 再帰的に.tsファイルを検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.ts',
      recursive: true,
    });

    expect(result.total_found).toBe(3);
    expect(result.results.map(r => r.name).sort()).toEqual(['nested.ts', 'root.ts', 'sub.ts']);
  });

  it('最大深度を制限する', async () => {
    // ネストした構造を作成
    const subDir = path.join(tempDir, 'subdir');
    const nestedDir = path.join(subDir, 'nested');
    await fs.mkdir(subDir);
    await fs.mkdir(nestedDir);

    await fs.writeFile(path.join(tempDir, 'root.ts'), 'root file');
    await fs.writeFile(path.join(subDir, 'sub.ts'), 'sub file');
    await fs.writeFile(path.join(nestedDir, 'nested.ts'), 'nested file');

    // 深度1で検索（root + subdir まで）
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.ts',
      recursive: true,
      max_depth: 1,
    });

    expect(result.total_found).toBe(2);
    expect(result.results.map(r => r.name).sort()).toEqual(['root.ts', 'sub.ts']);
  });

  it('大文字小文字を区別しない検索', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'TEST.TS'), 'Hello WORLD');

    // 小文字パターンで検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.ts',
      content_pattern: 'hello',
      case_sensitive: false,
      include_content: true,
      recursive: false,
    });

    expect(result.total_found).toBe(1);
    expect(result.results[0].name).toBe('TEST.TS');
    expect(result.results[0].matches).toHaveLength(1);
  });

  it('大文字小文字を区別する検索', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello WORLD');

    // 大文字小文字を区別して検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      content_pattern: 'hello', // 小文字
      case_sensitive: true,
      recursive: false,
    });

    expect(result.total_found).toBe(0); // マッチしない
  });

  it('最大結果数を制限する', async () => {
    // 多数のファイルを作成
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(path.join(tempDir, `file${i}.txt`), 'content');
    }

    // 最大3件で検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.txt',
      max_results: 3,
      recursive: false,
    });

    expect(result.total_found).toBe(10); // 実際に見つかった数
    expect(result.results).toHaveLength(3); // 制限された結果数
  });

  it('存在しないディレクトリでエラーをスロー', async () => {
    const nonExistentDir = path.join(tempDir, 'non-existent');

    await expect(
      searchFilesTool.execute({
        directory: nonExistentDir,
        file_pattern: '*',
      })
    ).rejects.toThrow('ディレクトリが見つからないかアクセスできません');
  });

  it('ファイルパスを指定した場合はエラーをスロー', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'content');

    await expect(
      searchFilesTool.execute({
        directory: filePath,
        file_pattern: '*',
      })
    ).rejects.toThrow('指定されたパスはディレクトリではありません');
  });

  it('ディレクトリも検索対象に含む', async () => {
    // サブディレクトリを作成
    await fs.mkdir(path.join(tempDir, 'testdir'));
    await fs.mkdir(path.join(tempDir, 'otherdir'));

    // ディレクトリ名パターンで検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: 'test*',
      recursive: false,
    });

    expect(result.total_found).toBe(1);
    expect(result.results[0].name).toBe('testdir');
    expect(result.results[0].type).toBe('directory');
  });

  it('正規表現パターンでファイル内容を検索する', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'email: test@example.com\nphone: 123-456-7890');

    // メールアドレスパターンで検索
    const result = await searchFilesTool.execute({
      directory: tempDir,
      content_pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      include_content: true,
      recursive: false,
    });

    expect(result.total_found).toBe(1);
    expect(result.results[0].matches).toHaveLength(1);
    expect(result.results[0].matches![0].line_content).toBe('email: test@example.com');
    expect(result.results[0].matches![0].match_start).toBe(7);
    expect(result.results[0].matches![0].match_end).toBe(23);
  });

  it('検索情報が正しく返される', async () => {
    // テストファイルを作成
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

    const result = await searchFilesTool.execute({
      directory: tempDir,
      file_pattern: '*.txt',
      content_pattern: 'content',
      recursive: true,
      max_depth: 5,
    });

    expect(result.search_info.directory).toBe(tempDir);
    expect(result.search_info.file_pattern).toBe('*.txt');
    expect(result.search_info.content_pattern).toBe('content');
    expect(result.search_info.recursive).toBe(true);
    expect(result.search_info.max_depth).toBe(5);
    expect(result.search_info.files_scanned).toBe(1);
    expect(result.search_info.directories_scanned).toBe(1);
  });
});