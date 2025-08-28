import { describe, it, expect } from 'vitest';
import { WorkspaceConfigValidator } from './workspace-config.js';
import { WorkspaceConfig, WorkspaceSettings } from './types.js';

describe('WorkspaceConfigValidator', () => {
  const validConfig: WorkspaceConfig = {
    name: 'test-workspace',
    root_path: '/home/user/project',
    created_at: '2024-01-01T00:00:00.000Z',
    last_accessed: '2024-01-01T00:00:00.000Z',
    settings: {
      index_enabled: true,

      auto_save_logs: true,
      log_retention_days: 30,
    },
  };

  describe('validateConfig', () => {
    it('有効な設定を正常に検証する', () => {
      expect(() => WorkspaceConfigValidator.validateConfig(validConfig)).not.toThrow();
      
      const result = WorkspaceConfigValidator.validateConfig(validConfig);
      // 主要プロパティが保持されているかチェック
      expect(result.name).toBe(validConfig.name);
      expect(result.root_path).toBe(validConfig.root_path);
      expect(result.settings.index_enabled).toBe(true);

      expect(result.settings.follow_symlinks).toBe(false);
      // max_file_sizeはデフォルト値が設定される
      expect(result.settings.max_file_size).toBe(1048576); // 1MB
      // excluded_patternsもデフォルト値が設定される
      expect(result.settings.excluded_patterns).toEqual(['*.env', '*.key', '*.pem', 'node_modules/**', '.git/**']);
    });

    it('無効な名前で失敗する', () => {
      const invalidConfig = { ...validConfig, name: '' };
      expect(() => WorkspaceConfigValidator.validateConfig(invalidConfig)).toThrow();
    });

    it('無効なルートパスで失敗する', () => {
      const invalidConfig = { ...validConfig, root_path: '' };
      expect(() => WorkspaceConfigValidator.validateConfig(invalidConfig)).toThrow();
    });

    it('無効な日時形式で失敗する', () => {
      const invalidConfig = { ...validConfig, created_at: 'invalid-date' };
      expect(() => WorkspaceConfigValidator.validateConfig(invalidConfig)).toThrow();
    });

    it('無効なログ保持日数で失敗する', () => {
      const invalidConfig = {
        ...validConfig,
        settings: { ...validConfig.settings, log_retention_days: 0 },
      };
      expect(() => WorkspaceConfigValidator.validateConfig(invalidConfig)).toThrow();
    });

    it('デフォルト値を設定する', () => {
      const minimalConfig = {
        name: 'test',
        root_path: '/path',
        created_at: '2024-01-01T00:00:00.000Z',
        last_accessed: '2024-01-01T00:00:00.000Z',
        settings: {},
      };

      const result = WorkspaceConfigValidator.validateConfig(minimalConfig);
      
      expect(result.settings.index_enabled).toBe(true);

      expect(result.settings.auto_save_logs).toBe(true);
      expect(result.settings.log_retention_days).toBe(30);
      expect(result.settings.follow_symlinks).toBe(false);
    });
  });

  describe('validatePartialSettings', () => {
    it('部分的な設定を正常に検証する', () => {
      const partialSettings = {
        index_enabled: false,
        log_retention_days: 60,
      };

      const result = WorkspaceConfigValidator.validatePartialSettings(partialSettings);
      
      expect(result.index_enabled).toBe(false);
      expect(result.log_retention_days).toBe(60);

    });

    it('空のオブジェクトを許可する', () => {
      const result = WorkspaceConfigValidator.validatePartialSettings({});
      expect(result).toEqual({});
    });

    it('無効な型で失敗する', () => {
      const invalidSettings = {
        index_enabled: 'not-boolean',
      };
      
      expect(() => WorkspaceConfigValidator.validatePartialSettings(invalidSettings)).toThrow();
    });
  });

  describe('validateWorkspaceName', () => {
    it('有効なワークスペース名を受け入れる', () => {
      const validNames = [
        'test',
        'test-project',
        'test_project',
        'project123',
        'a',
        'a'.repeat(100), // 最大長
      ];

      validNames.forEach(name => {
        expect(() => WorkspaceConfigValidator.validateWorkspaceName(name)).not.toThrow();
        expect(WorkspaceConfigValidator.validateWorkspaceName(name)).toBe(name);
      });
    });

    it('無効なワークスペース名を拒否する', () => {
      const invalidNames = [
        '', // 空文字
        'a'.repeat(101), // 長すぎる
        'test project', // スペース
        'test@project', // 特殊文字
        'test.project', // ドット
        'test/project', // スラッシュ
        'プロジェクト', // 日本語
      ];

      invalidNames.forEach(name => {
        expect(() => WorkspaceConfigValidator.validateWorkspaceName(name)).toThrow();
      });
    });
  });

  describe('validateRootPath', () => {
    it('有効なルートパスを受け入れる', () => {
      const validPaths = [
        '/home/user/project',
        '/absolute/path',
        'C:\\Windows\\Projects', // Windows風パス
      ];

      validPaths.forEach(path => {
        expect(() => WorkspaceConfigValidator.validateRootPath(path)).not.toThrow();
        expect(WorkspaceConfigValidator.validateRootPath(path)).toBe(path);
      });
    });

    it('無効なルートパスを拒否する', () => {
      const invalidPaths = [
        '', // 空文字
        '   ', // 空白のみ
        '../relative/path', // 相対パス
        '~/home/path', // チルダ記法
        'relative/path', // 相対パス
      ];

      invalidPaths.forEach(path => {
        expect(() => WorkspaceConfigValidator.validateRootPath(path)).toThrow();
      });
    });

    it('前後の空白を削除する', () => {
      const pathWithSpaces = '  /home/user/project  ';
      const result = WorkspaceConfigValidator.validateRootPath(pathWithSpaces);
      expect(result).toBe('/home/user/project');
    });
  });

  describe('createDefaultSettings', () => {
    it('デフォルト設定を生成する', () => {
      const defaults = WorkspaceConfigValidator.createDefaultSettings();
      
      expect(defaults).toEqual({
        index_enabled: true,

        auto_save_logs: true,
        log_retention_days: 30,
        max_file_size: 1048576,
        excluded_patterns: ['*.env', '*.key', '*.pem', 'node_modules/**', '.git/**'],
        follow_symlinks: false,
      });
    });
  });

  describe('mergeWithDefaults', () => {
    it('デフォルト値と設定をマージする', () => {
      const customSettings: Partial<WorkspaceSettings> = {
        index_enabled: false,
        log_retention_days: 60,
      };

      const result = WorkspaceConfigValidator.mergeWithDefaults(customSettings);
      
      // カスタム値が適用される
      expect(result.index_enabled).toBe(false);
      expect(result.log_retention_days).toBe(60);
      
      // デフォルト値が保持される

      expect(result.auto_save_logs).toBe(true);
      expect(result.follow_symlinks).toBe(false);
    });

    it('空の設定でデフォルト値を返す', () => {
      const result = WorkspaceConfigValidator.mergeWithDefaults({});
      const defaults = WorkspaceConfigValidator.createDefaultSettings();
      
      expect(result).toEqual(defaults);
    });

    it('配列の上書きを正しく処理する', () => {
      const customSettings: Partial<WorkspaceSettings> = {

        excluded_patterns: ['*.tmp'],
      };

      const result = WorkspaceConfigValidator.mergeWithDefaults(customSettings);
      

      expect(result.excluded_patterns).toEqual(['*.tmp']);
    });
  });
});