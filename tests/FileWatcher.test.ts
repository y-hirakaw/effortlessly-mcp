import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FileWatcher, FileChangeEvent } from '../src/services/FileWatcher.js';

describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;
  const testDir = path.join(process.cwd(), 'test-temp');
  const testFile = path.join(testDir, 'test.txt');

  beforeEach(async () => {
    // テスト用ディレクトリ作成
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // FileWatcherインスタンス作成
    fileWatcher = new FileWatcher({
      awaitWriteFinish: false,  // テストを高速化
      interval: 50,
      binaryInterval: 100
    });
  });

  afterEach(async () => {
    // FileWatcherを停止
    if (fileWatcher) {
      await fileWatcher.stop();
    }

    // テストディレクトリをクリーンアップ
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should watch a directory and detect file creation', async () => {
    const events: FileChangeEvent[] = [];
    
    fileWatcher.on('add', (event: FileChangeEvent) => {
      events.push(event);
    });

    await fileWatcher.watch(testDir);
    
    // ファイルを作成
    fs.writeFileSync(testFile, 'Hello, World!');
    
    // イベントが発火するまで待つ
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('add');
    expect(events[0].path).toBe(testFile);
    expect(events[0].hash).toBeTruthy();
  });

  it('should detect file changes', async () => {
    // 先にファイルを作成
    fs.writeFileSync(testFile, 'Initial content');
    
    const changeEvents: FileChangeEvent[] = [];
    
    fileWatcher.on('change', (event: FileChangeEvent) => {
      if (event.type === 'change') {
        changeEvents.push(event);
      }
    });

    await fileWatcher.watch(testDir);
    
    // 初期スキャンが完了するまで待つ
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // ファイルを変更
    fs.writeFileSync(testFile, 'Modified content');
    
    // イベントが発火するまで待つ
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(changeEvents.length).toBeGreaterThan(0);
    expect(changeEvents[0].type).toBe('change');
    expect(changeEvents[0].path).toBe(testFile);
  });

  it('should detect file deletion', async () => {
    // 先にファイルを作成
    fs.writeFileSync(testFile, 'To be deleted');
    
    const unlinkEvents: FileChangeEvent[] = [];
    
    fileWatcher.on('unlink', (event: FileChangeEvent) => {
      unlinkEvents.push(event);
    });

    await fileWatcher.watch(testDir);
    
    // 初期スキャンが完了するまで待つ
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // ファイルを削除
    fs.unlinkSync(testFile);
    
    // イベントが発火するまで待つ（より長く待つ）
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(unlinkEvents.length).toBeGreaterThan(0);
    expect(unlinkEvents[0].type).toBe('unlink');
    expect(unlinkEvents[0].path).toBe(testFile);
  });

  it('should handle multiple file operations', async () => {
    const allEvents: FileChangeEvent[] = [];
    
    fileWatcher.on('change', (event: FileChangeEvent) => {
      allEvents.push(event);
    });

    await fileWatcher.watch(testDir);
    
    // 複数のファイル操作を実行
    const file1 = path.join(testDir, 'file1.txt');
    const file2 = path.join(testDir, 'file2.txt');
    const file3 = path.join(testDir, 'file3.txt');
    
    fs.writeFileSync(file1, 'File 1');
    fs.writeFileSync(file2, 'File 2');
    fs.writeFileSync(file3, 'File 3');
    
    // イベントが発火するまで待つ
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(allEvents.length).toBeGreaterThanOrEqual(3);
    
    const addEvents = allEvents.filter(e => e.type === 'add');
    expect(addEvents.length).toBeGreaterThanOrEqual(3);
  });



  it('should provide correct statistics', async () => {
    await fileWatcher.watch(testDir);
    
    // ファイルを追加
    fs.writeFileSync(testFile, 'Test content');
    
    // イベントが処理されるまで待つ
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const stats = fileWatcher.getStats();
    
    expect(stats.isWatching).toBe(true);
    expect(stats.watchedPaths).toBe(1);
    expect(stats.cachedFiles).toBeGreaterThan(0);
    expect(stats.pendingChanges).toBe(0);
  });

  it('should debounce rapid changes', async () => {
    const events: FileChangeEvent[] = [];
    
    fileWatcher.on('change', (event: FileChangeEvent) => {
      if (event.type === 'change') {
        events.push(event);
      }
    });

    // 先にファイルを作成
    fs.writeFileSync(testFile, 'Initial');
    
    await fileWatcher.watch(testDir);
    
    // 初期スキャンが完了するまで待つ
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 高速に連続して変更
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(testFile, `Content ${i}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    // デバウンスが効いて最後の変更だけが記録されるまで待つ
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // デバウンスにより、イベント数は変更回数より少ないはず
    expect(events.length).toBeLessThan(5);
  });


});