/**
 * 高品質なdiff生成ユーティリティ
 * diffパッケージを使用してgit diffライクな出力を生成
 */

import { createPatch, diffLines } from 'diff';

export interface DiffOptions {
  contextLines?: number;
  useColors?: boolean;
  showLineNumbers?: boolean;
}

export class HighQualityDiff {
  private readonly COLORS = {
    RED: '\x1b[31m',    // 削除行 (赤)
    GREEN: '\x1b[32m',  // 追加行 (緑)
    CYAN: '\x1b[36m',   // ファイル名 (シアン)
    YELLOW: '\x1b[33m', // 行番号情報 (黄)
    RESET: '\x1b[0m'    // リセット
  };

  /**
   * 2つのファイル内容からdiffを生成
   */
  generateDiff(oldContent: string, newContent: string, filePath: string, options: DiffOptions = {}): string {
    const { contextLines = 3, useColors = true } = options;
    const colors = useColors ? this.COLORS : { RED: '', GREEN: '', CYAN: '', YELLOW: '', RESET: '' };
    
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
   * 大規模変更かどうかを判定
   */
  private isLargeChange(oldContent: string, newContent: string): boolean {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // 行数の変化が大きい場合
    const lineDiff = Math.abs(oldLines.length - newLines.length);
    if (lineDiff > 5) return true;
    
    // ファイル自体が大きい場合
    const maxLines = Math.max(oldLines.length, newLines.length);
    if (maxLines > 20) return true;
    
    // ファイルサイズが大きい場合
    const totalSize = oldContent.length + newContent.length;
    if (totalSize > 2000) return true;
    
    return false;
  }

  /**
   * 最適化されたdiff生成（git diff風の軽量表示）
   */
  private generateOptimizedDiff(oldContent: string, newContent: string, filePath: string, colors: any, contextLines: number): string {
    // まず変更箇所を分析
    const changeAnalysis = this.analyzeChanges(oldContent, newContent);
    
    // 大規模変更の場合はサマリー表示
    if (this.isLargeChange(oldContent, newContent)) {
      return this.generateSmartSummary(oldContent, newContent, filePath, colors);
    }
    
    // 軽量diff（変更箇所のみ表示）
    if (changeAnalysis.isMinorChange) {
      return this.generateLightweightDiff(oldContent, newContent, filePath, colors, contextLines);
    }
    
    // 通常のdiffパッチ生成
    const patch = createPatch(filePath, oldContent, newContent, '', '', {
      context: Math.min(contextLines, 2)  // 最大2行のコンテキスト
    });
    
    return this.colorizeUnifiedDiff(patch, colors);
  }
  
  /**
   * 変更箇所の分析
   */
  private analyzeChanges(oldContent: string, newContent: string): { isMinorChange: boolean; changedLinesCount: number } {
    const diff = diffLines(oldContent, newContent);
    let changedLines = 0;
    
    diff.forEach(part => {
      if (part.added || part.removed) {
        changedLines += (part.value.split('\n').length - 1);
      }
    });
    
    const totalOldLines = oldContent.split('\n').length;
    const changeRatio = changedLines / totalOldLines;
    
    return {
      isMinorChange: changedLines <= 8 && changeRatio <= 0.8 && totalOldLines <= 10,
      changedLinesCount: changedLines
    };
  }

  /**
   * 軽量diff生成（変更箇所のみ表示）
   */
  private generateLightweightDiff(oldContent: string, newContent: string, filePath: string, colors: any, contextLines: number): string {
    const diff = diffLines(oldContent, newContent);
    
    let result = `${colors.CYAN}--- ${filePath}${colors.RESET}\n`;
    result += `${colors.CYAN}+++ ${filePath}${colors.RESET}\n`;
    
    let outputLines: string[] = [];
    
    diff.forEach(part => {
      if (part.added || part.removed) {
        const lines = part.value.split('\n');
        lines.forEach((line, index) => {
          if (index === lines.length - 1 && line === '') return;
          
          const prefix = part.added ? '+' : part.removed ? '-' : ' ';
          const color = part.added ? colors.GREEN : part.removed ? colors.RED : '';
          outputLines.push(`${color}${prefix}${line}${colors.RESET}`);
        });
      } else {
        // コンテキスト行（変更されていない行）
        const lines = part.value.split('\n');
        const contextStart = Math.max(0, lines.length - contextLines);
        const contextEnd = Math.min(lines.length - 1, contextLines);
        
        for (let i = contextStart; i < contextEnd; i++) {
          if (i < lines.length - 1) {
            outputLines.push(` ${lines[i]}`);
          }
        }
      }
    });
    
    if (outputLines.length > 0) {
      result += `${colors.YELLOW}@@ Changes detected @@${colors.RESET}\n`;
      result += outputLines.join('\n');
    }
    
    return result;
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
