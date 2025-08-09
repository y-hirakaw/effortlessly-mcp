/**
 * 高品質なdiff生成ユーティリティ
 * diffパッケージを使用してgit diffライクな出力を生成
 * 設定ファイルによる閾値カスタマイズ対応
 */

import { createPatch, diffLines } from 'diff';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface DiffOptions {
  contextLines?: number;
  useColors?: boolean;
  showLineNumbers?: boolean;
}

interface DiffConfig {
  enabled?: boolean;
  max_lines_for_detailed_diff: number;
  display_options: {
    default_context_lines: number;
  };
}

export class HighQualityDiff {
  private readonly COLORS = {
    RED: '\x1b[31m',    // 削除行 (赤)
    GREEN: '\x1b[32m',  // 追加行 (緑)
    CYAN: '\x1b[36m',   // ファイル名 (シアン)
    YELLOW: '\x1b[33m', // 行番号情報 (黄)
    RESET: '\x1b[0m'    // リセット
  };

  private config: DiffConfig | null = null;
  private configLoadTime: number = 0;
  private readonly CONFIG_CACHE_DURATION = 60000; // 1分間キャッシュ

  /**
   * 設定ファイルをロード（キャッシュ付き）
   */
  public loadConfig(): DiffConfig {
    const now = Date.now();
    
    // キャッシュが有効な場合は既存の設定を返す
    if (this.config && (now - this.configLoadTime) < this.CONFIG_CACHE_DURATION) {
      return this.config;
    }

    // デフォルト設定
    const defaultConfig: DiffConfig = {
      enabled: true,
      max_lines_for_detailed_diff: 500,
      display_options: {
        default_context_lines: 3
      }
    };

    try {
      // 2つの設定ファイルパスを試行（テスト環境と実環境に対応）
      const configPaths = [
        path.resolve('.claude/workspace/effortlessly/config/diff-display.yaml'), // テスト環境用
        path.resolve('.claude/workspace/effortlessly/config.yaml') // 実環境用
      ];
      
      let userConfig: Partial<DiffConfig> | undefined;
      
      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          const configFile = fs.readFileSync(configPath, 'utf-8');
          const configData = yaml.load(configFile) as any;
          
          // diff-display.yamlの場合は直接DiffConfigとして読み込み
          if (configPath.includes('diff-display.yaml')) {
            userConfig = configData as Partial<DiffConfig>;
          } else {
            // config.yamlの場合はlogging.diffセクションから読み込み
            userConfig = configData?.logging?.diff as Partial<DiffConfig>;
          }
          break; // 最初に見つかった設定ファイルを使用
        }
      }
      
      if (userConfig) {
        
        // デフォルト設定とユーザー設定をマージ
        this.config = {
          enabled: userConfig?.enabled ?? defaultConfig.enabled,
          max_lines_for_detailed_diff: userConfig?.max_lines_for_detailed_diff ?? defaultConfig.max_lines_for_detailed_diff,
          display_options: {
            ...defaultConfig.display_options,
            ...userConfig?.display_options
          }
        };
      } else {
        // 設定ファイルが存在しない場合はデフォルト設定を使用
        this.config = defaultConfig;
      }
    } catch (error) {
      // 設定ファイル読み込みに失敗した場合はデフォルト設定を使用
      console.warn('Failed to load diff config, using defaults:', error);
      this.config = defaultConfig;
    }

    this.configLoadTime = now;
    return this.config;
  }

  /**
   * 2つのファイル内容からdiffを生成
   */
  generateDiff(oldContent: string, newContent: string, filePath: string, options: DiffOptions = {}): string {
    const config = this.loadConfig();
    
    // diff出力が無効化されている場合は空文字を返す
    if (config.enabled === false) {
      return '';
    }
    const { 
      contextLines = config.display_options.default_context_lines,
      useColors = true
    } = options;
    
    // テスト環境またはuseColors=falseの場合は色を無効化
    const shouldUseColors = useColors && 
      process.env.NODE_ENV !== 'test' && 
      process.env.VITEST !== 'true';
    
    const colors = shouldUseColors ? this.COLORS : {
      RED: '', GREEN: '', CYAN: '', YELLOW: '', RESET: ''
    };
    
    // 内容が同じ場合は何も出力しない
    if (oldContent === newContent) {
      return '';
    }
    
    // 新規ファイル作成の場合
    if (this.isEmptyContent(oldContent) && !this.isEmptyContent(newContent)) {
      return this.formatNewFile(newContent, filePath, colors);
    }
    
    // ファイル削除の場合
    if (!this.isEmptyContent(oldContent) && this.isEmptyContent(newContent)) {
      return this.formatDeleteFile(oldContent, filePath, colors);
    }
    
    // 常により効率的なdiffを生成（軽量diff優先）
    return this.generateOptimizedDiff(oldContent, newContent, filePath, colors, contextLines);
  }

  /**
   * 空のコンテンツかチェック
   */
  private isEmptyContent(content: string): boolean {
    return content === '' || content.trim() === '';
  }

  /**
   * 新規ファイル作成時のフォーマット
   */
  private formatNewFile(content: string, filePath: string, colors: any): string {
    const lines = content.split('\n');
    return `${colors.CYAN}--- /dev/null${colors.RESET}\n` +
           `${colors.CYAN}+++ ${filePath}${colors.RESET}\n` +
           `${colors.YELLOW}@@ -0,0 +1,${lines.length} @@${colors.RESET}\n` +
           lines.map(line => `${colors.GREEN}+${line}${colors.RESET}`).join('\n');
  }

  /**
   * ファイル削除時のフォーマット
   */
  private formatDeleteFile(content: string, filePath: string, colors: any): string {
    const lines = content.split('\n');
    return `${colors.CYAN}--- ${filePath}${colors.RESET}\n` +
           `${colors.CYAN}+++ /dev/null${colors.RESET}\n` +
           `${colors.YELLOW}@@ -1,${lines.length} +0,0 @@${colors.RESET}\n` +
           lines.map(line => `${colors.RED}-${line}${colors.RESET}`).join('\n');
  }

  /**
   * unified diff形式を色付きで整形
   */
  private colorizeUnifiedDiff(patch: string, colors: any): string {
    const lines = patch.split('\n');
    const colorizedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // ヘッダー行をスキップ（diffパッケージが生成する不要な行）
      if (i < 2) continue;
      
      // ファイル名の行
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        colorizedLines.push(`${colors.CYAN}${line}${colors.RESET}`);
      }
      // 行番号情報
      else if (line.startsWith('@@')) {
        colorizedLines.push(`${colors.YELLOW}${line}${colors.RESET}`);
      }
      // 削除行
      else if (line.startsWith('-')) {
        colorizedLines.push(`${colors.RED}${line}${colors.RESET}`);
      }
      // 追加行
      else if (line.startsWith('+')) {
        colorizedLines.push(`${colors.GREEN}${line}${colors.RESET}`);
      }
      // コンテキスト行（変更なし）
      else if (line.startsWith(' ') || line === '') {
        colorizedLines.push(line);
      }
    }
    
    return colorizedLines.join('\n').trim();
  }

  /**
   * 大規模変更かどうかを判定（設定ベース）
   * diff変化量（追加行+削除行）で判定
   */
  private isLargeChange(oldContent: string, newContent: string): boolean {
    const config = this.loadConfig();
    
    // 実際のdiff変化量を計算
    const diff = diffLines(oldContent, newContent);
    let totalChangedLines = 0;
    
    diff.forEach(part => {
      if (part.added || part.removed) {
        // 追加または削除された行数をカウント（最後の空行を除く）
        const lines = part.value.split('\n');
        const actualLines = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
        totalChangedLines += actualLines;
      }
    });
    
    // diff変化量が閾値を超える場合はサマリー表示
    return totalChangedLines > config.max_lines_for_detailed_diff;
  }

  /**
   * 最適化されたdiff生成（git diff風の詳細表示）
   */
  private generateOptimizedDiff(oldContent: string, newContent: string, filePath: string, colors: any, contextLines: number): string {
    // 大規模変更の場合のみサマリー表示
    if (this.isLargeChange(oldContent, newContent)) {
      return this.generateSmartSummary(oldContent, newContent, filePath, colors);
    }
    
    // 通常のdiffパッチ生成（詳細表示を優先）
    const patch = createPatch(filePath, oldContent, newContent, '', '', {
      context: contextLines  // フルコンテキスト使用
    });
    
    return this.colorizeUnifiedDiff(patch, colors);
  }
  


  /**
   * スマートサマリー生成（大規模変更用）
   */
  private generateSmartSummary(oldContent: string, newContent: string, filePath: string, colors: any): string {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const sizeDiff = newContent.length - oldContent.length;
    
    let summary = `${colors.CYAN}--- ${filePath}${colors.RESET}\n`;
    summary += `${colors.CYAN}+++ ${filePath}${colors.RESET}\n`;
    summary += `${colors.YELLOW}@@ Large change: ${oldLines} → ${newLines} lines (${sizeDiff > 0 ? '+' : ''}${sizeDiff} bytes) @@${colors.RESET}\n`;
    summary += `${colors.YELLOW}[Use git diff for detailed view]${colors.RESET}`;
    
    return summary;
  }

  /**
   * 簡単なline-by-line diffを生成（デバッグ用）
   */
  generateSimpleLineDiff(oldContent: string, newContent: string): string {
    const diff = diffLines(oldContent, newContent);
    let result = '';
    
    diff.forEach((part) => {
      const color = part.added ? '\x1b[32m' : part.removed ? '\x1b[31m' : '';
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      const reset = '\x1b[0m';
      
      if (part.value) {
        const lines = part.value.split('\n');
        lines.forEach((line, index) => {
          // 最後の空行をスキップ
          if (index === lines.length - 1 && line === '') return;
          result += `${color}${prefix}${line}${reset}\n`;
        });
      }
    });
    
    return result.trim();
  }
}

// Export singleton instance
export const highQualityDiff = new HighQualityDiff();
