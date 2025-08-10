/**
 * Java LSP統合実装
 * Eclipse JDT Language Serverとの統合を提供
 */

import path from 'path';
import { FileSystemService } from '../FileSystemService.js';
import type { 
  SymbolInformation, 
  Position, 
  SymbolKind
} from 'vscode-languageserver-protocol';
import { LSPClientBase } from './lsp-client.js';
import type { JavaLSPConfig, SymbolSearchResult, ReferenceSearchResult } from './types.js';
import { Logger } from '../logger.js';

/**
 * Java専用LSPクライアント
 */
export class JavaLSP extends LSPClientBase {
  private symbolCache = new Map<string, SymbolInformation[]>();
  private cacheTimestamp = new Map<string, number>();
  private static readonly SYMBOL_CACHE_TTL = 30000; // 30秒（シンボルキャッシュ用）
  
  // Phase 2A: 基本エラーハンドリング
  private errorCount = 0;
  private lastErrorTime?: Date;

  constructor(workspaceRoot: string, logger?: Logger, serverJarPath?: string) {
    const jarPath = serverJarPath || 'jdt-language-server.jar'; // デフォルト値、非同期初期化で置き換え
    
    const config: JavaLSPConfig = {
      name: 'java-language-server',
      command: '/opt/homebrew/opt/openjdk@21/bin/java', // JDT LSサーバー専用Java 21
      args: [
        // JVM起動最適化オプション
        '-Xms512m',                    // 最小ヒープサイズ固定で起動高速化
        '-Xmx768m',                    // 最大ヒープサイズ削減（1G→768M）
        '-XX:+UseG1GC',                // G1GCで短いGC停止時間
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+EnableJVMCI',            // JVMCI有効化で高速起動
        '-Djava.awt.headless=true',    // ヘッドレスモードで軽量化
        
        // Eclipse JDT LS固有オプション
        '-Declipse.application=org.eclipse.jdt.ls.core.id1',
        '-Dosgi.bundles.defaultStartLevel=4',
        '-Declipse.product=org.eclipse.jdt.ls.core.product',
        '-Dosgi.configuration.area.readonly=true', // 設定読み込み専用で高速化
        
        // Java Platform Module System設定
        '--add-modules=ALL-SYSTEM',
        '--add-opens', 'java.base/java.util=ALL-UNNAMED',
        '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
        '--add-opens', 'java.base/java.io=ALL-UNNAMED',    // 追加のファイルアクセス最適化
        
        '-jar',
        jarPath,
        '-configuration',
        path.join(path.dirname(jarPath), '..', 'config_mac'),
        '-data',
        path.join(path.dirname(workspaceRoot), '.jdt-workspaces', path.basename(workspaceRoot))
      ],
      fileExtensions: ['.java'],
      workspaceRoot,
      javaVersion: undefined, // 自動検出
      mavenSupported: true,
      gradleSupported: true
    };

    super(config, logger);
  }

  /**
   * 自動セットアップ付きJavaLSPインスタンス作成
   */
  static async createWithAutoSetup(options: {
    workspaceRoot: string;
    logger?: Logger;
    autoInstall?: boolean;
    serverJarPath?: string;
  }): Promise<JavaLSP> {
    const { workspaceRoot, logger, autoInstall = true, serverJarPath } = options;
    
    let finalJarPath = serverJarPath;
    
    if (autoInstall && !finalJarPath) {
      // 自動インストール試行
      try {
        const { LSPDependencyManager } = await import('./lsp-dependency-manager.js');
        const depManager = new LSPDependencyManager(path.join(workspaceRoot, '.claude', 'lsp-servers'));
        await depManager.initialize();
        
        const installResult = await depManager.installSingleDependency({
          name: 'eclipse-jdt-language-server',
          installer: 'binary',
          required: true
        }, {
          enabled: true,
          auto_install: true,
          install_dir: path.join(workspaceRoot, '.claude', 'lsp-servers', 'java')
        });
        
        if (installResult.success && installResult.installedPath) {
          finalJarPath = installResult.installedPath;
        }
      } catch (error) {
        const log = logger || Logger.getInstance();
        log.warn('Auto-install failed, falling back to default setup:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // デフォルトJARパスを非同期で取得
    if (!finalJarPath) {
      finalJarPath = await JavaLSP.getDefaultJarPath(workspaceRoot);
    }
    
    return new JavaLSP(workspaceRoot, logger, finalJarPath);
  }

  /**
   * JARパスキャッシュクラス（起動高速化用）
   */
  private static jarPathCache = new Map<string, string>();
  private static jarPathCacheTime = new Map<string, number>();
  private static readonly JAR_PATH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

  /**
   * デフォルトJARパス取得（キャッシュ付き高速化版）
   */
  private static async getDefaultJarPath(workspaceRoot: string): Promise<string> {
    const cacheKey = workspaceRoot;
    const now = Date.now();
    const lastTime = this.jarPathCacheTime.get(cacheKey) || 0;
    
    // キャッシュが有効な場合は即座に返す
    if (this.jarPathCache.has(cacheKey) && (now - lastTime) < this.JAR_PATH_CACHE_TTL) {
      return this.jarPathCache.get(cacheKey)!;
    }
    
    // キャッシュがない場合は検索を実行
    const jarPath = await this.findJarPathSlow(workspaceRoot);
    
    // キャッシュに保存
    this.jarPathCache.set(cacheKey, jarPath);
    this.jarPathCacheTime.set(cacheKey, now);
    
    return jarPath;
  }

  /**
   * JARパス検索（従来のロジック、キャッシュミス時のみ実行）
   */
  private static async findJarPathSlow(workspaceRoot: string): Promise<string> {
    // 高速化：最も一般的なパスを最初にチェック
    const priorityPaths = [
      path.join(workspaceRoot, '.claude', 'lsp-servers', 'java', 'plugins', 'org.eclipse.jdt.ls.product_1.40.0.*.jar'),
      path.join(workspaceRoot, '.claude', 'lsp-servers', 'java', 'plugins', 'org.eclipse.jdt.ls.product_*.jar')
    ];
    
    // ワイルドカード検索を最適化（1回だけ実行）
    for (const jarPath of priorityPaths) {
      if (jarPath.includes('*')) {
        try {
          const { glob } = await import('glob');
          const matches = glob.sync(jarPath);
          if (matches.length > 0) {
            // 最新バージョンを選択（ファイル名でソート）
            matches.sort().reverse();
            return matches[0];
          }
        } catch {
          // glob失敗は無視
        }
      }
    }
    
    // フォールバックパス
    const fallbackPaths = [
      path.join(workspaceRoot, '.claude', 'lsp-servers', 'java', 'org.eclipse.jdt.ls.product.jar'),
      'jdt-language-server.jar' // 最終フォールバック
    ];
    
    for (const jarPath of fallbackPaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(jarPath)) {
          return jarPath;
        }
      } catch {
        // ファイル確認失敗は無視
      }
    }
    
    return 'jdt-language-server.jar'; // 最終フォールバック
  }

  /**
   * Java LSPサーバーの利用可能性を確認
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      
      // Javaのバージョンチェック
      const javaProcess = spawn('java', ['-version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        javaProcess.on('error', () => resolve(false));
        javaProcess.on('exit', (code) => resolve(code === 0));
        setTimeout(() => {
          javaProcess.kill();
          resolve(false);
        }, 3000);
      });
    } catch {
      return false;
    }
  }

  /**
   * ワークスペース内のJavaファイルを検索
   */
  async findJavaFiles(): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(dir: string): Promise<void> {
      try {
        const fsService = FileSystemService.getInstance();
        const entries = await fsService.readdir(dir, { withFileTypes: true }) as import('fs').Dirent[];
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // target, build, .git, node_modulesディレクトリをスキップ
          if (entry.isDirectory()) {
            if (!['target', 'build', '.git', 'node_modules', '.settings'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext === '.java') {
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
   * ワークスペース全体のシンボル検索にLSPの workspace/symbol を使用
   */
  async searchSymbols(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
  }): Promise<SymbolSearchResult[]> {
    const { kind, exactMatch = false, maxResults = 100 } = options || {};
    
    try {
      // LSP接続状態を確認
      const state = this.getState();
      if (!state.initialized) {
        this.logger.warn('Java LSP not initialized for symbol search', { 
          connected: state.connected, 
          initialized: state.initialized,
          errorState: state.errorState
        });
        return [];
      }
      
      this.logger.info(`Searching Java workspace symbols for query: "${query}"`);
      
      // LSPのworkspace/symbolリクエストを使用
      const symbols = await this.sendRequest('workspace/symbol', { query });
      this.logger.info(`Java LSP returned ${symbols?.length || 0} symbols for query: "${query}"`);
      
      if (!symbols || !Array.isArray(symbols)) {
        this.logger.warn('Invalid response from Java workspace/symbol request');
        return [];
      }
      
      const results: SymbolSearchResult[] = [];
      
      for (const symbol of symbols as SymbolInformation[]) {
        // 種類フィルタ
        if (kind !== undefined && symbol.kind !== kind) {
          continue;
        }
        
        // 名前フィルタ（exactMatchの場合のみ厳密チェック）
        const matches = exactMatch 
          ? symbol.name === query
          : true; // workspace/symbol自体がクエリマッチングを行うため
          
        if (matches) {
          this.logger.info(`Found matching Java symbol: ${symbol.name} (kind: ${symbol.kind})`);
          results.push({
            name: symbol.name,
            kind: symbol.kind,
            file: this.uriToPath(symbol.location.uri),
            position: symbol.location.range.start,
            range: symbol.location.range,
            detail: undefined,
            documentation: undefined
          });
          
          if (results.length >= maxResults) {
            break;
          }
        }
      }
      
      this.logger.info(`Returning ${results.length} filtered Java symbols`);
      return results;
      
    } catch (error) {
      this.logger.error('Failed to search Java symbols via LSP workspace/symbol', error as Error);
      
      // フォールバック: ファイル単位の検索
      this.logger.info('Falling back to file-based Java symbol search');
      return await this.searchSymbolsFallback(query, options);
    }
  }

  /**
   * フォールバック: ファイル単位でのシンボル検索
   */
  private async searchSymbolsFallback(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
  }): Promise<SymbolSearchResult[]> {
    const { kind, exactMatch = false, maxResults = 100 } = options || {};
    const results: SymbolSearchResult[] = [];
    
    try {
      // ワークスペース内のJavaファイルを取得
      const files = await this.findJavaFiles();
      this.logger.info(`Fallback: Found ${files.length} Java files in workspace`);
      
      // 主要ファイルを優先（src/main/java配下）
      const priorityFiles = files.filter(f => 
        f.includes('src/main/java') ||
        f.includes('Main.java') ||
        f.includes('Application.java')
      );
      
      const targetFiles = [...priorityFiles, ...files.filter(f => !priorityFiles.includes(f))].slice(0, 20);
      this.logger.info(`Fallback: Processing ${targetFiles.length} Java files`);
      
      for (const file of targetFiles) {
        try {
          const symbols = await this.getFileSymbols(file);
          this.logger.info(`Fallback: File ${file}: found ${symbols.length} symbols`);
          
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
              this.logger.info(`Fallback: Found matching Java symbol: ${symbol.name} (kind: ${symbol.kind})`);
              results.push({
                name: symbol.name,
                kind: symbol.kind,
                file: this.uriToPath(symbol.location.uri),
                position: symbol.location.range.start,
                range: symbol.location.range,
                detail: undefined,
                documentation: undefined
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
          this.logger.warn(`Fallback: Failed to get symbols for Java file ${file}`, { error: (error as Error).message });
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Fallback Java symbol search failed', error as Error);
      return [];
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
      // LSP接続状態を確認
      const state = this.getState();
      if (!state.initialized) {
        this.logger.warn('Java LSP not initialized for reference search', { 
          connected: state.connected, 
          initialized: state.initialized,
          errorState: state.errorState
        });
        return [];
      }

      const uri = this.pathToUri(file);
      this.logger.info(`Searching Java references for ${file} at position`, { position });

      // ファイルを明示的に開いて最新の状態にする
      try {
        const fsService = FileSystemService.getInstance();
        const fileContent = await fsService.readFile(file, { encoding: 'utf8' }) as string;
        this.sendNotification('textDocument/didOpen', {
          textDocument: {
            uri,
            languageId: 'java',
            version: 1,
            text: fileContent
          }
        });
        
        // Java LSPは初期化に時間がかかるため待機時間を増加
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (fileError) {
        this.logger.warn(`Could not open Java file for reference search: ${file}`, { 
          error: (fileError as Error).message 
        });
      }

      const locations = await this.findReferences(uri, position, includeDeclaration);
      this.logger.info(`Found ${locations.length} Java references for ${file}`);
      
      const results: ReferenceSearchResult[] = [];
      
      for (const location of locations) {
        const filePath = this.uriToPath(location.uri);
        const context = await this.getLineContext(filePath, location.range.start.line);
        
        results.push({
          file: filePath,
          position: location.range.start,
          range: location.range,
          kind: 'reference', // Java LSPは種類を区別しない
          context
        });
      }

      // ファイルを閉じる
      this.sendNotification('textDocument/didClose', {
        textDocument: { uri }
      });
      
      return results;
    } catch (error) {
      this.logger.error('Failed to search Java references', error as Error);
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
      if (now - timestamp < JavaLSP.SYMBOL_CACHE_TTL) {
        return this.symbolCache.get(file)!;
      }
    }
    
    try {
      // ファイルが存在することを確認
      const fsService = FileSystemService.getInstance();
      await fsService.access(file);
      
      // LSP接続状態を確認
      const state = this.getState();
      if (!state.initialized) {
        this.logger.warn(`Java LSP not initialized for file: ${file}`, { 
          connected: state.connected, 
          initialized: state.initialized,
          errorState: state.errorState,
          lastActivity: state.lastActivity?.toISOString()
        });
        return [];
      }
      
      // ファイルを明示的に開く
      const fileContent = await fsService.readFile(file, { encoding: 'utf8' }) as string;
      this.logger.info(`Opening Java file: ${file} (${fileContent.length} chars)`);
      
      this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'java',
          version: 1,
          text: fileContent
        }
      });
      this.logger.info(`Sent didOpen notification for Java file: ${uri}`);
      
      // Java LSPは処理に時間がかかるため待機時間を長くする
      await new Promise(resolve => setTimeout(resolve, 1500));
      this.logger.info('Requesting Java document symbols...');
      
      const symbols = await this.getDocumentSymbols(uri);
      this.logger.info(`Received ${symbols.length} symbols from Java LSP`);
      
      // ファイルを閉じる
      this.sendNotification('textDocument/didClose', {
        textDocument: { uri }
      });
      this.logger.info(`Sent didClose notification for Java file: ${uri}`);
      
      // キャッシュに保存
      this.symbolCache.set(file, symbols);
      this.cacheTimestamp.set(file, now);
      
      return symbols;
    } catch (error) {
      this.logger.warn(`Failed to get symbols for Java file: ${file}`, { error: (error as Error).message });
      return [];
    }
  }

  /**
   * 指定行の周辺コンテキストを取得
   */
  private async getLineContext(file: string, line: number): Promise<string> {
    try {
      const fsService = FileSystemService.getInstance();
      const content = await fsService.readFile(file, { encoding: 'utf8' }) as string;
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
    this.logger.info('Java LSP cache cleared');
  }

  /**
   * Javaプロジェクト設定を検出
   */
  async detectProjectConfig(): Promise<{
    hasPom: boolean;
    pomPath?: string;
    hasBuildGradle: boolean;
    buildGradlePath?: string;
    hasJavaVersion: boolean;
    javaVersion?: string;
    srcDirectories: string[];
  }> {
    const result = {
      hasPom: false,
      hasBuildGradle: false,
      hasJavaVersion: false,
      pomPath: undefined as string | undefined,
      buildGradlePath: undefined as string | undefined,
      javaVersion: undefined as string | undefined,
      srcDirectories: [] as string[]
    };

    try {
      // pom.xml検索（Maven）
      const pomPath = path.join(this.config.workspaceRoot, 'pom.xml');
      try {
        const fsService = FileSystemService.getInstance();
        await fsService.access(pomPath);
        result.hasPom = true;
        result.pomPath = pomPath;
      } catch {
        // pom.xmlが見つからない
      }

      // build.gradle検索（Gradle）
      const gradlePaths = [
        path.join(this.config.workspaceRoot, 'build.gradle'),
        path.join(this.config.workspaceRoot, 'build.gradle.kts')
      ];

      for (const gradlePath of gradlePaths) {
        try {
          const fsService = FileSystemService.getInstance();
          await fsService.access(gradlePath);
          result.hasBuildGradle = true;
          result.buildGradlePath = gradlePath;
          break;
        } catch {
          // build.gradleが見つからない
        }
      }

      // Javaバージョン検出
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const { stdout } = await execAsync('java -version');
        const versionMatch = stdout.match(/version "([^"]+)"/);
        if (versionMatch) {
          result.hasJavaVersion = true;
          result.javaVersion = versionMatch[1];
        }
      } catch {
        // Javaバージョン取得失敗
      }

      // ソースディレクトリ検出
      const commonSrcPaths = [
        'src/main/java',
        'src/test/java',
        'src',
        'java'
      ];

      for (const srcPath of commonSrcPaths) {
        const fullPath = path.join(this.config.workspaceRoot, srcPath);
        try {
          const fsService = FileSystemService.getInstance();
          await fsService.access(fullPath);
          result.srcDirectories.push(fullPath);
        } catch {
          // ディレクトリが存在しない
        }
      }

      return result;
    } catch (error) {
      this.recordBasicError(error as Error);
      this.logger.error('Failed to detect Java project config', error as Error);
      return result;
    }
  }

  /**
   * Phase 2A: 基本診断機能
   */
  public getBasicDiagnostics(): {
    status: 'healthy' | 'warning' | 'error';
    errorCount: number;
    lastErrorTime?: Date;
    uptime: number;
  } {
    const state = this.getState();
    // connectedAtプロパティは現在利用不可、仮の稼働時間を返す
    const uptime = 60; // 仮の実装：60秒固定
    
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (!state.connected || !state.initialized) {
      status = 'error';
    } else if (this.errorCount > 3) {
      status = 'warning';
    }
    
    return {
      status,
      errorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime,
      uptime: Math.round(uptime / 1000) // 秒
    };
  }

  /**
   * エラー記録（基本版）
   */
  private recordBasicError(error: Error): void {
    this.errorCount++;
    this.lastErrorTime = new Date();
    this.logger.error(`Java LSP Error #${this.errorCount}: ${error.message}`);
  }
}
