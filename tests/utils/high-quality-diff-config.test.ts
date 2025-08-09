/**
 * 高品質diff設定機能のテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HighQualityDiff } from '../../src/utils/high-quality-diff.js';
import * as fs from 'fs';
import * as path from 'path';

describe('HighQualityDiff設定機能', () => {
  const testConfigDir = '.claude/workspace/effortlessly/config';
  const testConfigPath = path.join(testConfigDir, 'diff-display.yaml');
  let originalConfig: string | null = null;
  let highQualityDiff: HighQualityDiff;

  beforeEach(() => {
    highQualityDiff = new HighQualityDiff();
    
    // 既存の設定ファイルをバックアップ
    if (fs.existsSync(testConfigPath)) {
      originalConfig = fs.readFileSync(testConfigPath, 'utf-8');
    }
    
    // テスト用ディレクトリを作成
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 設定ファイルを復元
    if (originalConfig !== null) {
      fs.writeFileSync(testConfigPath, originalConfig);
    } else if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('デフォルト設定', () => {
    it('設定ファイルが存在しない場合、デフォルト値を使用', () => {
      // 設定ファイルを削除
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }

      const smallFile = 'Line 1\nLine 2\nLine 3';
      const largeFile = Array(600).fill('line').map((line, i) => `${line} ${i + 1}`).join('\n');
      const modifiedSmall = 'Line 1\nLine 2 CHANGED\nLine 3';

      // 小さなファイルは詳細diff
      const smallDiff = highQualityDiff.generateDiff(smallFile, modifiedSmall, 'small.txt');
      expect(smallDiff).toContain('--- small.txt');
      expect(smallDiff).toContain('+++ small.txt');
      expect(smallDiff).toContain('-Line 2');
      expect(smallDiff).toContain('+Line 2 CHANGED');

      // 大きなファイルで大きな変更（600行変更）をするとサマリー表示
      const largeChangedFile = largeFile.split('\n').map((line, i) => 
        i % 2 === 0 ? `${line} CHANGED` : line
      ).join('\n'); // 300行変更（> 500行閾値）
      const largeDiff = highQualityDiff.generateDiff(largeFile, largeChangedFile, 'large.txt');
      expect(largeDiff).toContain('Large change:');
      expect(largeDiff).toContain('Use git diff for detailed view');
    });
  });

  describe('カスタム設定', () => {
    it('厳しい閾値設定（20行）でサマリー表示', () => {
      // 厳しい設定を作成
      const strictConfig = `
max_lines_for_detailed_diff: 20

display_options:
  default_context_lines: 2
  use_colors: false
`;
      fs.writeFileSync(testConfigPath, strictConfig);

      const mediumFile = Array(50).fill('line').map((line, i) => `${line} ${i + 1}`).join('\n');
      // 25行変更（> 20行閾値）でサマリー表示
      const modifiedMedium = mediumFile.split('\n').map((line, i) => 
        i < 25 ? `${line} CHANGED` : line
      ).join('\n');

      const diff = highQualityDiff.generateDiff(mediumFile, modifiedMedium, 'medium.txt');
      
      // 25行変更なので20行閾値でサマリー表示になるはず
      expect(diff).toContain('Large change:');
      expect(diff).toContain('50 → 50 lines');
    });

    it('緩い閾値設定（1000行）で詳細表示', () => {
      // 緩い設定を作成
      const lenientConfig = `
max_lines_for_detailed_diff: 1000

display_options:
  default_context_lines: 5
  use_colors: false
`;
      fs.writeFileSync(testConfigPath, lenientConfig);

      const largeFile = Array(600).fill('line').map((line, i) => `${line} ${i + 1}`).join('\n');
      const modifiedLarge = largeFile.replace('line 300', 'line 300 CHANGED');

      const diff = highQualityDiff.generateDiff(largeFile, modifiedLarge, 'large.txt');
      
      // 600行だが1000行閾値なので詳細表示になるはず
      expect(diff).toContain('--- large.txt');
      expect(diff).toContain('+++ large.txt');
      expect(diff).toContain('-line 300');
      expect(diff).toContain('+line 300 CHANGED');
    });
  });

  describe('表示オプション', () => {
    it('カスタムコンテキスト行数を適用', () => {
      const customConfig = `
max_lines_for_detailed_diff: 500

display_options:
  default_context_lines: 1
  use_colors: false
`;
      fs.writeFileSync(testConfigPath, customConfig);

      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const modified = 'Line 1\nLine 2\nLine 3 CHANGED\nLine 4\nLine 5';

      const diff = highQualityDiff.generateDiff(content, modified, 'test.txt', {});
      
      // デフォルトコンテキスト行数が適用されているか確認
      expect(diff).toContain('Line 2');
      expect(diff).toContain('Line 4');
    });

    it('色なし設定を適用', () => {
      const noColorConfig = `
max_lines_for_detailed_diff: 500

display_options:
  default_context_lines: 3
  use_colors: false
`;
      fs.writeFileSync(testConfigPath, noColorConfig);

      const content = 'Line 1\nLine 2';
      const modified = 'Line 1\nLine 2 CHANGED';

      const diff = highQualityDiff.generateDiff(content, modified, 'test.txt');
      
      // ANSIカラーコードが含まれていないことを確認
      expect(diff).not.toMatch(/\x1b\[[0-9;]*m/);
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なYAMLファイルでもデフォルト設定で動作', () => {
      // 無効なYAMLを作成
      const invalidYaml = `
max_lines_for_detailed_diff: invalid_number
malformed yaml content [
`;
      fs.writeFileSync(testConfigPath, invalidYaml);

      const smallFile = 'Line 1\nLine 2';
      const modified = 'Line 1\nLine 2 CHANGED';

      // エラーが発生せずデフォルト設定で動作することを確認
      expect(() => {
        const diff = highQualityDiff.generateDiff(smallFile, modified, 'test.txt');
        expect(diff).toContain('--- test.txt');
      }).not.toThrow();
    });

    it('部分的な設定ファイルでもデフォルト値でマージ', () => {
      // display_optionsのみの設定
      const partialConfig = `
display_options:
  default_context_lines: 2
`;
      fs.writeFileSync(testConfigPath, partialConfig);

      const largeFile = Array(600).fill('line').join('\n');
      // 600行すべて変更（> 500行閾値）でサマリー表示
      const modified = largeFile.split('\n').map(line => `${line} CHANGED`).join('\n');

      const diff = highQualityDiff.generateDiff(largeFile, modified, 'test.txt');
      
      // max_lines_for_detailed_diffはデフォルト値（500）が使われるため、
      // 600行変更でサマリー表示になるはず
      expect(diff).toContain('Large change:');
    });
  });
});