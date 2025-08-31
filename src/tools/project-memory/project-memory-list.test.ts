import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import { ProjectMemoryListTool } from './project-memory-list.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';

// 依存関係をモック
vi.mock('fs/promises');
vi.mock('os');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

describe('ProjectMemoryListTool Bug Investigation', () => {
  const mockHomeDir = '/mock/home';
  const mockProjectPath = '/mock/project';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // os.homedirのモック
    mockOs.homedir.mockReturnValue(mockHomeDir);
    
    // WorkspaceManagerのsingleton instanceをリセット
    (WorkspaceManager as any).instance = undefined;
    
    // 基本的なfsモック
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Tag Filtering Bug', () => {
    beforeEach(async () => {
      // ワークスペース設定ファイル読み込みのモック
      mockFs.readFile.mockImplementation((filePath: any) => {
        if (filePath.includes('workspace.yml')) {
          return Promise.resolve(`
workspace:
  name: test-workspace
  root_path: ${mockProjectPath}
  created_at: "2024-01-01T00:00:00.000Z"
  last_accessed: "2024-01-01T00:00:00.000Z"
  settings:
    index_enabled: true
    auto_save_logs: true
    log_retention_days: 30
    follow_symlinks: false
`);
        }
        if (filePath.includes('memories-index.json')) {
          return Promise.resolve(JSON.stringify({
            version: "1.0",
            lastUpdated: "2024-01-01T00:00:00.000Z",
            memories: {
              "test-memory-1": {
                name: "Test Memory 1",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
                tags: ["workspace", "test"],
                size: 100,
                checksum: "abc123",
                category: "knowledge"
              },
              "test-memory-2": {
                name: "Test Memory 2", 
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
                tags: ["analysis", "test"],
                size: 200,
                checksum: "def456",
                category: "knowledge"
              }
            }
          }));
        }
        return Promise.resolve('');
      });

      // ワークスペースを正しく初期化
      const workspaceManager = WorkspaceManager.getInstance();
      await workspaceManager.activateWorkspace(mockProjectPath, {
        name: 'test-workspace',
        settings: {
          index_enabled: true,
          auto_save_logs: true,
          log_retention_days: 30
        }
      });
    });

    it('should correctly filter memories by tags', async () => {
      const tool = new ProjectMemoryListTool();
      
      // パラメータを指定してテスト
      const result = await tool.execute({
        filter_tags: ["workspace"],
        include_statistics: false
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      
      // デバッグ情報を出力
      console.log('Test result data:', {
        success: data.success,
        memoriesCount: data.memories?.length,
        filteredCount: data.summary?.filtered_count,
        totalCount: data.summary?.total_count,
        filterTags: data.filter?.tags
      });

      // バグの検証: フィルタリングが正常に動作するか
      expect(data.success).toBe(true);
      expect(data.filter.tags).toEqual(["workspace"]); // ここがバグ: 現在は [] になっている
      expect(data.summary.filtered_count).toBe(1); // 現在は 2 になっている
      expect(data.memories).toHaveLength(1); // 現在は 2 になっている
      expect(data.memories[0].tags).toContain("workspace");
    });

    it('should return all memories when no filter is provided', async () => {
      const tool = new ProjectMemoryListTool();
      
      const result = await tool.execute({
        include_statistics: false
      });

      expect(result.isError).toBeFalsy();
      const data = JSON.parse(result.content[0].text);
      
      expect(data.success).toBe(true);
      expect(data.filter.tags).toEqual([]); // これは正常
      expect(data.summary.total_count).toBe(2);
      expect(data.summary.filtered_count).toBe(2);
      expect(data.memories).toHaveLength(2);
    });
  });
});