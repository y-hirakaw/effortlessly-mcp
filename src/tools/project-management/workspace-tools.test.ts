import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import { 
  workspaceActivateTool,
  workspaceGetInfoTool,
  workspaceListAllTool,
  WorkspaceActivateTool,
  WorkspaceGetInfoTool,
  WorkspaceListAllTool
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

  describe('workspaceActivateTool', () => {
    beforeEach(() => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
    });

    describe('metadata', () => {
      it('正しいメタデータを持つ', () => {
        expect(workspaceActivateTool.metadata.name).toBe('workspace_activate');
        expect(workspaceActivateTool.metadata.description).toContain('ワークスペースを活性化');
        expect(workspaceActivateTool.metadata.parameters.workspace_path).toBeDefined();
        expect(workspaceActivateTool.metadata.parameters.workspace_path.required).toBe(true);
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
    lsp_servers: []
    auto_save_logs: true
    log_retention_days: 30
    follow_symlinks: false
`);

        const input = {
          workspace_path: mockProjectPath,
          name: 'test-workspace',
          index_enabled: true,
        };

        const result = await workspaceActivateTool.execute(input);

        expect(result.success).toBe(true);
        expect(result.workspace.name).toBe('test-workspace');
        expect(result.workspace.root_path).toBe(mockProjectPath);
        expect(result.message).toContain('活性化しました');
      });

      it('workspace_pathが未指定でValidationErrorを投げる', async () => {
        const input = {};

        await expect(workspaceActivateTool.execute(input as any))
          .rejects.toThrow(ValidationError);
      });

      it('存在しないパスでエラーを投げる', async () => {
        mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

        const input = {
          workspace_path: '/nonexistent',
        };

        await expect(workspaceActivateTool.execute(input))
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
    lsp_servers: ["rust", "go"]
    auto_save_logs: false
    log_retention_days: 60
    follow_symlinks: false
`);

        const input = {
          workspace_path: mockProjectPath,
          name: 'custom-workspace',
          index_enabled: false,
          lsp_servers: ['rust', 'go'],
          auto_save_logs: false,
          log_retention_days: 60,
        };

        const result = await workspaceActivateTool.execute(input);

        expect(result.success).toBe(true);
        expect(result.workspace.settings.index_enabled).toBe(false);
        expect(result.workspace.settings.lsp_servers).toEqual(['rust', 'go']);
        expect(result.workspace.settings.auto_save_logs).toBe(false);
        expect(result.workspace.settings.log_retention_days).toBe(60);
      });
    });
  });

  describe('workspaceGetInfoTool', () => {
    describe('metadata', () => {
      it('正しいメタデータを持つ', () => {
        expect(workspaceGetInfoTool.metadata.name).toBe('workspace_get_info');
        expect(workspaceGetInfoTool.metadata.description).toContain('現在アクティブな');
        expect(Object.keys(workspaceGetInfoTool.metadata.parameters)).toHaveLength(0);
      });
    });

    describe('execute', () => {
      it('アクティブなワークスペースがない場合の応答', async () => {
        const result = await workspaceGetInfoTool.execute();

        expect(result.hasActiveWorkspace).toBe(false);
        expect(result.workspace).toBeUndefined();
        expect(result.message).toContain('アクティブなワークスペースがありません');
      });

      it('アクティブなワークスペースがある場合の応答', async () => {
        // 先にワークスペースを活性化
        mockFs.stat.mockResolvedValue({
          isDirectory: () => true,
        } as any);
        
        // 設定ファイル読み込みのモック
        mockFs.readFile.mockResolvedValue(`
workspace:
  name: active-workspace
  root_path: ${mockProjectPath}
  created_at: "2024-01-01T00:00:00.000Z"
  last_accessed: "2024-01-01T00:00:00.000Z"
  settings:
    index_enabled: true
    lsp_servers: []
    auto_save_logs: true
    log_retention_days: 30
    follow_symlinks: false
`);

        await workspaceActivateTool.execute({
          workspace_path: mockProjectPath,
          name: 'active-workspace',
        });

        const result = await workspaceGetInfoTool.execute();

        expect(result.hasActiveWorkspace).toBe(true);
        expect(result.workspace).toBeDefined();
        expect(result.workspace?.name).toBe('active-workspace');
        expect(result.workspace?.status).toBe('active');
        expect(result.message).toContain('アクティブなワークスペース: active-workspace');
      });
    });
  });

  describe('workspaceListAllTool', () => {
    describe('metadata', () => {
      it('正しいメタデータを持つ', () => {
        expect(workspaceListAllTool.metadata.name).toBe('workspace_list_all');
        expect(workspaceListAllTool.metadata.description).toContain('すべてのワークスペース');
        expect(Object.keys(workspaceListAllTool.metadata.parameters)).toHaveLength(0);
      });
    });

    describe('execute', () => {
      it('空のワークスペース一覧を返す', async () => {
        const result = await workspaceListAllTool.execute();

        expect(result.workspaces).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.activeWorkspace).toBeUndefined();
        expect(result.message).toContain('登録されているワークスペースがありません');
      });

      it('複数のワークスペースを含む一覧を返す', async () => {
        // 統合config.yamlファイルをモック
        mockFs.readFile.mockImplementation((filePath) => {
          if (filePath.toString().includes('config.yaml')) {
            return Promise.resolve(`
workspaces:
  current: null
  configurations:
    workspace1:
      root_path: /path/to/workspace1
      name: workspace1
      created_at: "2024-01-01T00:00:00.000Z"
      last_accessed: "2024-01-01T00:00:00.000Z"
      status: inactive
      file_count: 100
    workspace2:
      root_path: /path/to/workspace2
      name: workspace2
      created_at: "2024-01-02T00:00:00.000Z"
      last_accessed: "2024-01-02T00:00:00.000Z"
      status: inactive
      file_count: 150

lsp_servers:
  proxy_server:
    enabled: true
    host: localhost
    port: 3001
    auto_start: true


logging:
  audit:
    enabled: true
    level: info
    retention_days: 30
    max_file_size: "10MB"
  error:
    enabled: true
    level: error
    retention_days: 7
    max_file_size: "5MB"
  debug:
    enabled: false
    level: debug
    retention_days: 3
    max_file_size: "2MB"
`);
          }
          return Promise.reject(new Error('File not found'));
        });

        const result = await workspaceListAllTool.execute();

        expect(result.workspaces).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.message).toContain('2個のワークスペースが登録されています');
        
        // 最新アクセス順にソートされている
        expect(result.workspaces[0].name).toBe('workspace2');
        expect(result.workspaces[1].name).toBe('workspace1');
      });

      it('アクティブなワークスペースを識別する', async () => {
        // ワークスペースを活性化
        mockFs.stat.mockResolvedValue({
          isDirectory: () => true,
        } as any);

        // 統合config.yamlファイルのモック設定（activateWorkspace用）
        mockFs.readFile.mockImplementation((filePath) => {
          if (filePath.toString().includes('config.yaml')) {
            return Promise.resolve(`
workspaces:
  current: active-workspace
  configurations:
    active-workspace:
      root_path: ${mockProjectPath}
      name: active-workspace
      created_at: "2024-01-01T00:00:00.000Z"
      last_accessed: "2024-01-01T00:00:00.000Z"
      status: active
      file_count: 100

lsp_servers:
  proxy_server:
    enabled: true
    host: localhost
    port: 3001
    auto_start: true


logging:
  audit:
    enabled: true
    level: info
    retention_days: 30
    max_file_size: "10MB"
  error:
    enabled: true
    level: error
    retention_days: 7
    max_file_size: "5MB"
  debug:
    enabled: false
    level: debug
    retention_days: 3
    max_file_size: "2MB"
`);
          }
          return Promise.reject(new Error('File not found'));
        });

        await workspaceActivateTool.execute({
          workspace_path: mockProjectPath,
          name: 'active-workspace',
        });

        const result = await workspaceListAllTool.execute();

        expect(result.activeWorkspace).toBe('active-workspace');
        expect(result.workspaces[0].status).toBe('active');
      });
    });
  });

  describe('Tool Classes', () => {
    describe('WorkspaceActivateTool', () => {
      it('正しいメタデータを持つ', () => {
        const tool = new WorkspaceActivateTool();
        expect(tool.metadata.name).toBe('workspace_activate');
        expect(tool.metadata.description).toContain('ワークスペースを活性化');
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
    lsp_servers: []
    auto_save_logs: true
    log_retention_days: 30
    follow_symlinks: false
`);

        const tool = new WorkspaceActivateTool();
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

    describe('WorkspaceGetInfoTool', () => {
      it('正しいメタデータを持つ', () => {
        const tool = new WorkspaceGetInfoTool();
        expect(tool.metadata.name).toBe('workspace_get_info');
        expect(tool.metadata.description).toContain('現在アクティブな');
      });

      it('execute メソッドが動作する', async () => {
        const tool = new WorkspaceGetInfoTool();
        const result = await tool.execute({});
        expect(result.isError).toBeFalsy();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        
        // JSON結果をパース
        const data = JSON.parse(result.content[0].text);
        expect(data.hasActiveWorkspace).toBe(false);
      });
    });

    describe('WorkspaceListAllTool', () => {
      it('正しいメタデータを持つ', () => {
        const tool = new WorkspaceListAllTool();
        expect(tool.metadata.name).toBe('workspace_list_all');
        expect(tool.metadata.description).toContain('すべてのワークスペース');
      });

      it('execute メソッドが動作する', async () => {
        const tool = new WorkspaceListAllTool();
        const result = await tool.execute({});
        expect(result.isError).toBeFalsy();
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        
        // JSON結果をパース
        const data = JSON.parse(result.content[0].text);
        expect(data.workspaces).toEqual([]);
      });
    });
  });
});