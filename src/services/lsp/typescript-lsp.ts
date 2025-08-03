/**
 * TypeScript LSP統合実装
 * typescript-language-serverとの統合を提供
 */

import path from 'path';
import fs from 'fs/promises';
import type { 
  SymbolInformation, 
  Position, 
  SymbolKind
} from 'vscode-languageserver-protocol';
import { LSPClientBase } from './lsp-client.js';
import type { TypeScriptLSPConfig, SymbolSearchResult, ReferenceSearchResult } from './types.js';
import { Logger } from '../logger.js';

/**
 * TypeScript専用LSPクライアント
 */
export class TypeScriptLSP extends LSPClientBase {
  private symbolCache = new Map<string, SymbolInformation[]>();
  private cacheTimestamp = new Map<string, number>();
  private static readonly CACHE_TTL = 30000; // 30秒

  constructor(workspaceRoot: string, logger?: Logger) {
    const config: TypeScriptLSPConfig = {
      name: 'typescript-language-server',
      command: 'typescript-language-server',
      args: ['--stdio'],
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      workspaceRoot,
      tsVersion: undefined, // 自動検出
      incremental: true
    };

    super(config, logger);
  }

  /**
   * TypeScript LSPサーバーの利用可能性を確認
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      const process = spawn('typescript-language-server', ['--version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        process.on('error', () => resolve(false));
        process.on('exit', (code) => resolve(code === 0));
        setTimeout(() => {
          process.kill();
          resolve(false);
        }, 3000);
      });
    } catch {
      return false;
    }
  }

  /**
   * ワークスペース内のTypeScriptファイルを検索
   */
  async findTypeScriptFiles(): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // node_modulesと.gitディレクトリをスキップ
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // ディレクトリアクセスエラーは無視
      }
    }

    await scanDirectory(this.config.workspaceRoot);
    return files;
  }

  /**
   * シンボル名で検索（ファジー検索対応）
   */
  async searchSymbols(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
  }): Promise<SymbolSearchResult[]> {
    const { kind, exactMatch = false, maxResults = 100 } = options || {};
    const results: SymbolSearchResult[] = [];
    
    try {
      // ワークスペース内のTypeScriptファイルを取得
      const files = await this.findTypeScriptFiles();
      this.logger.info(`Found ${files.length} TypeScript files in workspace`);
      
      // logger.tsファイルが含まれているかチェック
      const loggerFile = files.find(f => f.includes('logger.ts'));
      if (loggerFile) {
        this.logger.info(`Logger file found: ${loggerFile}`);
      } else {
        this.logger.warn('Logger file not found in TypeScript files');
      }
      
      // デバッグ：logger.tsファイルのみテスト
      const targetFiles = loggerFile ? [loggerFile] : files.slice(0, 10);
      this.logger.info(`Processing ${targetFiles.length} files (focusing on logger.ts if available)`);
      for (const file of targetFiles) {
        try {
          const symbols = await this.getFileSymbols(file);
          this.logger.info(`File ${file}: found ${symbols.length} symbols`);
          
          for (const symbol of symbols) {
            // 種類フィルタ
            if (kind !== undefined && symbol.kind !== kind) {
              continue;
            }
            
            // 名前フィルタ
            const matches = exactMatch 
              ? symbol.name === query
              : symbol.name.toLowerCase().includes(query.toLowerCase());
              
            if (matches) {
              this.logger.info(`Found matching symbol: ${symbol.name} (kind: ${symbol.kind})`);
              results.push({
                name: symbol.name,
                kind: symbol.kind,
                file: this.uriToPath(symbol.location.uri),
                position: symbol.location.range.start,
                range: symbol.location.range,
                detail: undefined, // SymbolInformationには detail は含まれない
                documentation: undefined // SymbolInformationには documentation は含まれない
              });
              
              if (results.length >= maxResults) {
                break;
              }
            }
          }
          
          if (results.length >= maxResults) {
            break;
          }
        } catch (error) {
          this.logger.warn(`Failed to get symbols for ${file}`, { error: (error as Error).message });
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to search symbols', error as Error);
      throw error;
    }
  }

  /**
   * 参照検索（定義元と使用箇所）
   */
  async searchReferences(
    file: string, 
    position: Position, 
    includeDeclaration = true
  ): Promise<ReferenceSearchResult[]> {
    try {
      const uri = this.pathToUri(file);
      const locations = await this.findReferences(uri, position, includeDeclaration);
      
      const results: ReferenceSearchResult[] = [];
      
      for (const location of locations) {
        const filePath = this.uriToPath(location.uri);
        const context = await this.getLineContext(filePath, location.range.start.line);
        
        results.push({
          file: filePath,
          position: location.range.start,
          range: location.range,
          kind: 'reference', // TypeScript LSPは種類を区別しない
          context
        });
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to search references', error as Error);
      throw error;
    }
  }

  /**
   * ファイルのシンボル情報を取得（キャッシュ付き）
   */
  private async getFileSymbols(file: string): Promise<SymbolInformation[]> {
    const uri = this.pathToUri(file);
    const now = Date.now();
    
    // キャッシュチェック
    if (this.symbolCache.has(file)) {
      const timestamp = this.cacheTimestamp.get(file) || 0;
      if (now - timestamp < TypeScriptLSP.CACHE_TTL) {
        return this.symbolCache.get(file)!;
      }
    }
    
    try {
      // ファイルが存在することを確認
      await fs.access(file);
      
      // LSP接続状態を確認
      const state = this.getState();
      if (!state.initialized) {
        this.logger.warn(`LSP not initialized for file: ${file}`, { 
          connected: state.connected, 
          initialized: state.initialized,
          errorState: state.errorState,
          lastActivity: state.lastActivity?.toISOString()
        });
        return [];
      }
      
      // ファイルを明示的に開く（重要：これがないとシンボルが取得できない）
      const fileContent = await fs.readFile(file, 'utf8');
      this.logger.info(`Opening file: ${file} (${fileContent.length} chars)`);
      
      this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'typescript',
          version: 1,
          text: fileContent
        }
      });
      this.logger.info(`Sent didOpen notification for: ${uri}`);
      
      // 短時間待機してLSPが処理するのを待つ
      await new Promise(resolve => setTimeout(resolve, 500)); // 待機時間を増加
      this.logger.info('Requesting document symbols...');
      
      const symbols = await this.getDocumentSymbols(uri);
      this.logger.info(`Received ${symbols.length} symbols from LSP`);
      
      // ファイルを閉じる
      this.sendNotification('textDocument/didClose', {
        textDocument: { uri }
      });
      this.logger.info(`Sent didClose notification for: ${uri}`);
      
      // キャッシュに保存
      this.symbolCache.set(file, symbols);
      this.cacheTimestamp.set(file, now);
      
      return symbols;
    } catch (error) {
      this.logger.warn(`Failed to get symbols for file: ${file}`, { error: (error as Error).message });
      return [];
    }
  }

  /**
   * 指定行の周辺コンテキストを取得
   */
  private async getLineContext(file: string, line: number): Promise<string> {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      
      // 前後1行を含む3行を取得
      const start = Math.max(0, line - 1);
      const end = Math.min(lines.length, line + 2);
      
      return lines.slice(start, end).join('\n');
    } catch {
      return '';
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.symbolCache.clear();
    this.cacheTimestamp.clear();
    this.logger.info('TypeScript LSP cache cleared');
  }

  /**
   * TypeScriptプロジェクト設定を検出
   */
  async detectProjectConfig(): Promise<{
    hasTsConfig: boolean;
    tsConfigPath?: string;
    hasPackageJson: boolean;
    packageJsonPath?: string;
    typeScriptVersion?: string;
  }> {
    const result = {
      hasTsConfig: false,
      hasPackageJson: false,
      tsConfigPath: undefined as string | undefined,
      packageJsonPath: undefined as string | undefined,
      typeScriptVersion: undefined as string | undefined
    };

    try {
      // tsconfig.json検索
      const tsConfigPath = path.join(this.config.workspaceRoot, 'tsconfig.json');
      try {
        await fs.access(tsConfigPath);
        result.hasTsConfig = true;
        result.tsConfigPath = tsConfigPath;
      } catch {
        // tsconfig.jsonが見つからない
      }

      // package.json検索
      const packageJsonPath = path.join(this.config.workspaceRoot, 'package.json');
      try {
        await fs.access(packageJsonPath);
        result.hasPackageJson = true;
        result.packageJsonPath = packageJsonPath;

        // TypeScriptバージョンを取得
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageData = JSON.parse(packageContent);
        const tsVersion = packageData.devDependencies?.typescript || 
                         packageData.dependencies?.typescript;
        if (tsVersion) {
          result.typeScriptVersion = tsVersion;
        }
      } catch {
        // package.jsonが見つからない
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to detect project config', error as Error);
      return result;
    }
  }
}