import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import { 
  workspaceSetupTool,
  WorkspaceSetupTool
} from './index.js';
import { WorkspaceManager } from './workspace-manager.js';
import { ValidationError } from '../../types/errors.js';

// 依存関係をモック
vi.mock('fs/promises');
vi.mock('os');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

describe('Workspace Tools', () => {
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('workspaceSetupTool', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
    });

    describe('metadata', () => {
      it('正しいメタデータを持つ', () => {
        expect(workspaceSetupTool.metadata.name).toBe('workspace_setup');
        expect(workspaceSetupTool.metadata.description).toContain('ワークスペースをセットアップ');
        expect(workspaceSetupTool.metadata.parameters.workspace_path).toBeDefined();
        expect(workspaceSetupTool.metadata.parameters.workspace_path.required).toBe(true);
      });
    });

    describe('execute', () => {
      it('有効な入力でワークスペースを活性化する', async () => {
        // 設定ファイル読み込みのモック
        mockFs.readFile.mockResolvedValue(`
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

        const input = {
          workspace_path: mockProjectPath,
          name: 'test-workspace',
          index_enabled: true,
        };

        const result = await workspaceSetupTool.execute(input);

        expect(result.success).toBe(true);
        expect(result.workspace.name).toBe('test-workspace');
        expect(result.workspace.root_path).toBe(mockProjectPath);
        expect(result.message).toContain('活性化しました');
      });

      it('workspace_pathが未指定でValidationErrorを投げる', async () => {
        const input = {};

        await expect(workspaceSetupTool.execute(input as any))
          .rejects.toThrow(ValidationError);
      });

      it('存在しないパスでエラーを投げる', async () => {
        mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

        const input = {
          workspace_path: '/nonexistent',
        };

        await expect(workspaceSetupTool.execute(input))
          .rejects.toThrow('指定されたディレクトリが存在しません');
      });

      it('カスタム設定を適用する', async () => {
        // 設定ファイル読み込みのモック
        mockFs.readFile.mockResolvedValue(`
workspace:
  name: custom-workspace
  root_path: ${mockProjectPath}
  created_at: "2024-01-01T00:00:00.000Z"
  last_accessed: "2024-01-01T00:00:00.000Z"
  settings:
    index_enabled: false

    auto_save_logs: false
    log_retention_days: 60
    follow_symlinks: false
`);

        const input = {
          workspace_path: mockProjectPath,
          name: 'custom-workspace',
          index_enabled: false,

          auto_save_logs: false,
          log_retention_days: 60,
        };

        const result = await workspaceSetupTool.execute(input);

        expect(result.success).toBe(true);
        expect(result.workspace.settings.index_enabled).toBe(false);

        expect(result.workspace.settings.auto_save_logs).toBe(false);
        expect(result.workspace.settings.log_retention_days).toBe(60);
      });
    });
  });

  describe('Tool Classes', () => {
    describe('WorkspaceSetupTool', () => {
      it('正しいメタデータを持つ', () => {
        const tool = new WorkspaceSetupTool();
        expect(tool.metadata.name).toBe('workspace_setup');
        expect(tool.metadata.description).toContain('ワークスペースをセットアップ');
      });

      it('execute メソッドが動作する', async () => {
        mockFs.stat.mockResolvedValue({
          isDirectory: () => true,
        } as any);
        
        // 設定ファイル読み込みのモック
        mockFs.readFile.mockResolvedValue(`
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

        const tool = new WorkspaceSetupTool();
        const args = {
          workspace_path: mockProjectPath,
          name: 'test-workspace',
        };

        const result = await tool.execute(args);
        expect(result.isError).toBeFalsy();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        
        // JSON結果をパース
        const data = JSON.parse(result.content[0].text);
        expect(data.success).toBe(true);
        expect(data.workspace.name).toBe('test-workspace');
      });
    });


  });
});