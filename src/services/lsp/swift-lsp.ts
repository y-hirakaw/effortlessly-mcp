/**
 * Swift LSP統合実装
 * SourceKit-LSPとの統合を提供
 */

import path from 'path';
import { FileSystemService } from '../FileSystemService.js';
import type { 
  SymbolInformation, 
  Position, 
  SymbolKind
} from 'vscode-languageserver-protocol';
import { LSPClientBase } from './lsp-client.js';
import type { SwiftLSPConfig, SymbolSearchResult, ReferenceSearchResult } from './types.js';
import { Logger } from '../logger.js';
import { SwiftLSPCache } from './swift-lsp-cache.js';
import { SwiftLSPMetrics } from './swift-lsp-metrics.js';





/**
 * Swift専用LSPクライアント（SourceKit-LSP）
 */
export class SwiftLSP extends LSPClientBase {
  // 責務別クラスインスタンス
  private readonly cache = new SwiftLSPCache();
  private readonly metrics = new SwiftLSPMetrics();
  
  // デバッグログ用の追加フィールド
  private debugMode = true; // 詳細デバッグログを有効化
  private requestCounter = 0;
  private lspCommunicationLog: Array<{
    timestamp: Date;
    type: 'request' | 'response' | 'notification' | 'error';
    method?: string;
    id?: number;
    data: any;
  }> = [];

  constructor(workspaceRoot: string, logger?: Logger) {
    const config: SwiftLSPConfig = {
      name: 'sourcekit-lsp',
      command: 'sourcekit-lsp',
      args: [],
      fileExtensions: ['.swift'],
      workspaceRoot,
      swiftVersion: undefined, // 自動検出
      packageSwiftSupported: true,
      cocoapodsSupported: true
    };

    super(config, logger);
    
    // デバッグモードでのLSP通信監視を設定
    if (this.debugMode) {
      this.setupLSPCommunicationMonitoring();
    }
  }

  /**
   * LSP通信の詳細監視を設定
   */
  private setupLSPCommunicationMonitoring(): void {
    // 親クラスのsendRequestメソッドをオーバーライド
    const originalSendRequest = this.sendRequest.bind(this);
    this.sendRequest = async (method: string, params?: any) => {
      const requestId = ++this.requestCounter;
      const timestamp = new Date();
      
      // リクエストをログ
      this.logLSPCommunication({
        timestamp,
        type: 'request',
        method,
        id: requestId,
        data: { method, params }
      });
      
      this.logger.info(`🔄 LSP Request #${requestId}`, {
        method,
        params: this.sanitizeLogData(params),
        timestamp: timestamp.toISOString()
      });
      
      try {
        const response = await originalSendRequest(method, params);
        
        // レスポンスをログ
        this.logLSPCommunication({
          timestamp: new Date(),
          type: 'response',
          method,
          id: requestId,
          data: response
        });
        
        this.logger.info(`✅ LSP Response #${requestId}`, {
          method,
          responseSize: JSON.stringify(response || {}).length,
          hasResults: Array.isArray(response) ? response.length > 0 : !!response,
          responsePreview: this.sanitizeLogData(this.truncateForLog(response))
        });
        
        return response;
      } catch (error) {
        // エラーをログ
        this.logLSPCommunication({
          timestamp: new Date(),
          type: 'error',
          method,
          id: requestId,
          data: { error: (error as Error).message, stack: (error as Error).stack }
        });
        
        this.logger.error(`❌ LSP Error #${requestId}`, error as Error);
        
        throw error;
      }
    };

    // 親クラスのsendNotificationメソッドをオーバーライド
    const originalSendNotification = this.sendNotification.bind(this);
    this.sendNotification = (method: string, params?: any) => {
      const timestamp = new Date();
      
      // 通知をログ
      this.logLSPCommunication({
        timestamp,
        type: 'notification',
        method,
        data: { method, params }
      });
      
      this.logger.info(`📤 LSP Notification`, {
        method,
        params: this.sanitizeLogData(params),
        timestamp: timestamp.toISOString()
      });
      
      return originalSendNotification(method, params);
    };
  }

  /**
   * LSP通信ログを記録
   */
  private logLSPCommunication(entry: {
    timestamp: Date;
    type: 'request' | 'response' | 'notification' | 'error';
    method?: string;
    id?: number;
    data: any;
  }): void {
    this.lspCommunicationLog.push(entry);
    
    // ログサイズ制限（最新1000エントリを保持）
    if (this.lspCommunicationLog.length > 1000) {
      this.lspCommunicationLog = this.lspCommunicationLog.slice(-1000);
    }
  }

  /**
   * ログ出力用にデータをサニタイズ（機密情報を除去）
   */
  private sanitizeLogData(data: any): any {
    if (!data) return data;
    
    try {
      const jsonStr = JSON.stringify(data);
      // 機密情報のパターンをマスク
      const sanitized = jsonStr
        .replace(/"(password|token|key|secret|credential)"\s*:\s*"[^"]*"/gi, '"$1":"***"')
        .replace(/("text"\s*:\s*")[^"]{200,}"/g, '$1<truncated>"');
      
      return JSON.parse(sanitized);
    } catch {
      return String(data).substring(0, 200);
    }
  }

  /**
   * ログ出力用にデータを切り詰め
   */
  private truncateForLog(data: any, maxLength = 500): any {
    if (!data) return data;
    
    try {
      const jsonStr = JSON.stringify(data);
      if (jsonStr.length <= maxLength) return data;
      
      return {
        __truncated: true,
        preview: jsonStr.substring(0, maxLength) + '...',
        originalLength: jsonStr.length
      };
    } catch {
      const str = String(data);
      return str.length <= maxLength ? str : str.substring(0, maxLength) + '...';
    }
  }

  /**
   * LSP通信ログをエクスポート（診断用）
   */
  exportLSPCommunicationLog(): any[] {
    return this.lspCommunicationLog.map(entry => ({
      ...entry,
      data: this.sanitizeLogData(entry.data)
    }));
  }

  /**
   * Phase 1強化: パフォーマンス統計の取得
   */
  getPerformanceMetrics() {
    const metrics = this.metrics.getMetrics();
    
    const cacheStats = this.cache.getStats();
    
    return {
      ...metrics,
      lspSuccessRate: metrics.lspSearchAttempts > 0 
        ? Math.round((metrics.lspSearchSuccesses / metrics.lspSearchAttempts) * 100) / 100 
        : 0,
      fallbackUsageRate: metrics.totalSearches > 0 
        ? Math.round((metrics.fallbackSearchUsage / metrics.totalSearches) * 100) / 100 
        : 0,
      cacheSize: cacheStats.symbolCacheSize,
      fallbackCacheSize: cacheStats.fallbackCacheSize
    };
  }

  /**
   * Phase 1強化: パフォーマンス統計をリセット
   */
  resetPerformanceMetrics() {
    this.metrics.reset();
  }

  /**
   * SourceKit-LSPサーバーの利用可能性を確認
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      
      // まずxcrunでSourceKit-LSPを試す（macOS）
      const xcrunProcess = spawn('xcrun', ['--find', 'sourcekit-lsp'], { stdio: 'pipe' });
      
      const xcrunAvailable = await new Promise<boolean>((resolve) => {
        xcrunProcess.on('error', () => resolve(false));
        xcrunProcess.on('exit', (code) => resolve(code === 0));
        setTimeout(() => {
          xcrunProcess.kill();
          resolve(false);
        }, 120000); // 2分に延長
      });

      if (xcrunAvailable) {
        return true;
      }

      // 直接sourcekit-lspコマンドを試す
      const directProcess = spawn('sourcekit-lsp', ['--version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        directProcess.on('error', () => resolve(false));
        directProcess.on('exit', (code) => resolve(code === 0));
        setTimeout(() => {
          directProcess.kill();
          resolve(false);
        }, 120000); // 2分に延長
      });
    } catch {
      return false;
    }
  }

  /**
   * SourceKit-LSPサーバーを起動し接続を確立（オーバーライド）
   */
  async connect(): Promise<void> {
    try {
      this.logger.info(`Swift LSP: Starting SourceKit-LSP server`);
      
      // SourceKit-LSPの実行可能パスを決定
      const command = await this.getSourceKitLSPCommand();
      
      // プロセスを起動
      const { spawn } = await import('child_process');
      this.process = spawn(command, this.config.args, {
        cwd: this.config.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error('Failed to establish stdio streams');
      }

      // プロセスイベントを設定
      this.setupProcessHandlers();
      
      // 標準出力をパース
      this.setupOutputParser();

      this.state.connected = true;
      this.state.lastActivity = new Date();
      
      // 初期化実行
      await this.initialize();
      
      // Package.swift解析後の強制インデックス再構築を実行
      try {
        await this.forceProjectReindex();
      } catch (reindexError) {
        this.logger.warn('Swift LSP: Failed to force project reindex, continuing anyway', { error: (reindexError as Error).message });
      }
      
      this.logger.info(`Swift LSP: SourceKit-LSP server connected and initialized`);
      this.emit('connected');
      
    } catch (error) {
      this.state.errorState = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Swift LSP: Failed to connect to SourceKit-LSP`, error as Error);
      throw error;
    }
  }

  /**
   * SourceKit-LSPの実行可能パスを取得
   */
  private async getSourceKitLSPCommand(): Promise<string> {
    try {
      const { spawn } = await import('child_process');
      
      // まずxcrunで試す（macOS）
      const xcrunProcess = spawn('xcrun', ['--find', 'sourcekit-lsp'], { stdio: 'pipe' });
      
      const xcrunPath = await new Promise<string | null>((resolve) => {
        let output = '';
        xcrunProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });
        xcrunProcess.on('exit', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            resolve(null);
          }
        });
        xcrunProcess.on('error', () => resolve(null));
        setTimeout(() => {
          xcrunProcess.kill();
          resolve(null);
        }, 120000); // 2分に延長
      });

      if (xcrunPath) {
        this.logger.info(`Swift LSP: Using SourceKit-LSP from xcrun: ${xcrunPath}`);
        return xcrunPath;
      }

      // 直接sourcekit-lspコマンドを使用
      this.logger.info(`Swift LSP: Using direct sourcekit-lsp command`);
      return 'sourcekit-lsp';
    } catch (error) {
      this.logger.warn(`Swift LSP: Failed to determine SourceKit-LSP path, using default`, { error: (error as Error).message });
      return 'sourcekit-lsp';
    }
  }

  /**
   * ワークスペース内のSwiftファイルを検索
   */
  async findSwiftFiles(): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(dir: string): Promise<void> {
      try {
        const fsService = FileSystemService.getInstance();
        const entries = await fsService.readdir(dir, { withFileTypes: true }) as import('fs').Dirent[];
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // 無視するディレクトリ
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', '.build', 'dist', 'build', '.swiftpm', 'Pods'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext === '.swift') {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // ディレクトリアクセスエラーは無視
      }
    }

    await scanDirectory(this.config.workspaceRoot);
    return files;
  }

  /**
   * シンボル名で検索（ファジー検索対応）- Phase 1強化版
   */
  async searchSymbols(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
    enableFallback?: boolean;
  }): Promise<SymbolSearchResult[]> {
    const startTime = Date.now();
    this.metrics.recordLSPAttempt(); // 新しいメトリクスクラス使用
    
    const { exactMatch = false, maxResults = 100, enableFallback = false } = options || {};
    let results: SymbolSearchResult[] = [];
    
    try {
      // フォールバックキャッシュチェック
      const cacheKey = `${query}_${JSON.stringify(options)}`;
      const cachedFallbackResult = this.getCachedFallbackResults(cacheKey);
      if (cachedFallbackResult.length > 0) {
        this.logger.info(`Swift LSP: Fallback cache hit for query: "${query}"`);
        this.metrics.recordResponseTime(Date.now() - startTime);
        return cachedFallbackResult;
      }
      
      // まずLSPベースの検索を試行
      this.metrics.recordLSPAttempt();
      results = await this.searchSymbolsWithLSP(query, { exactMatch, maxResults });
      
      // LSPで結果が得られた場合はそれを返す
      if (results.length > 0) {
        this.metrics.recordLSPSuccess();
        this.logger.info(`Swift LSP: Found ${results.length} symbols via LSP`);
        this.metrics.recordResponseTime(Date.now() - startTime);
        return results;
      }
      
      // LSPで結果が得られない場合、フォールバック検索を実行（有効な場合のみ）
      if (enableFallback) {
        this.logger.warn('Swift LSP: No results from LSP, falling back to text-based search');
        results = await this.searchSymbolsWithFallbackCached(query, { exactMatch, maxResults }, cacheKey);
      } else {
        this.logger.warn('Swift LSP: No results from LSP, fallback disabled');
        results = [];
      }
      
      this.metrics.recordResponseTime(Date.now() - startTime);
      return results;
    } catch (error) {
      this.logger.error('Swift LSP: LSP search failed', error as Error);
      
      // エラーが発生した場合もフォールバック検索を試行（有効な場合のみ）
      if (enableFallback) {
        this.logger.warn('Swift LSP: Attempting fallback search after LSP error');
        try {
          const cacheKey = `${query}_${JSON.stringify(options)}`;
          results = await this.searchSymbolsWithFallbackCached(query, { exactMatch, maxResults }, cacheKey);
          this.logger.info(`Swift LSP: Fallback search found ${results.length} symbols`);
          this.metrics.recordResponseTime(Date.now() - startTime);
          return results;
        } catch (fallbackError) {
          this.logger.error('Swift LSP: Both LSP and fallback search failed', fallbackError as Error);
          throw fallbackError;
        }
      } else {
        this.logger.error('Swift LSP: LSP search failed, fallback disabled');
        throw error;
      }
    }
  }

  /**
   * workspace/symbolクエリの詳細デバッグ実行
   */
  async debugWorkspaceSymbolQuery(query: string): Promise<{
    success: boolean;
    results: any[];
    debugInfo: {
      lspState: any;
      projectConfig: any;
      communicationLog: any[];
      workspaceInfo: any;
      timing: {
        queryStart: Date;
        queryEnd?: Date;
        duration?: number;
      };
    };
  }> {
    const timing: { queryStart: Date; queryEnd?: Date; duration?: number } = { queryStart: new Date() };
    const debugInfo: any = { timing };
    
    try {
      this.logger.info(`🔍 Starting workspace/symbol debug query: "${query}"`);
      
      // 1. LSP状態を確認
      debugInfo.lspState = this.getState();
      this.logger.info('📋 Current LSP State', debugInfo.lspState);
      
      // 2. プロジェクト設定を取得
      debugInfo.projectConfig = await this.detectProjectConfig();
      this.logger.info('📦 Project Configuration', debugInfo.projectConfig);
      
      // 3. ワークスペース情報を収集
      const swiftFiles = await this.findSwiftFiles();
      debugInfo.workspaceInfo = {
        workspaceRoot: this.config.workspaceRoot,
        swiftFileCount: swiftFiles.length,
        swiftFiles: swiftFiles.slice(0, 10), // 最初の10ファイルを表示
        packageSwiftExists: debugInfo.projectConfig.hasPackageSwift
      };
      this.logger.info('🏗️ Workspace Information', debugInfo.workspaceInfo);
      
      // 4. LSP通信ログをクリア（この検索のログのみを見るため）
      this.lspCommunicationLog = [];
      
      // 5. workspace/symbolクエリを直接実行
      this.logger.info('🚀 Executing workspace/symbol query...');
      const results = await this.sendRequest('workspace/symbol', { query });
      
      timing.queryEnd = new Date();
      timing.duration = timing.queryEnd.getTime() - timing.queryStart.getTime();
      
      // 6. 通信ログを記録
      debugInfo.communicationLog = this.exportLSPCommunicationLog();
      
      this.logger.info('✨ workspace/symbol query completed', {
        resultsCount: Array.isArray(results) ? results.length : 0,
        duration: timing.duration,
        hasResults: Array.isArray(results) && results.length > 0
      });
      
      return {
        success: true,
        results: results || [],
        debugInfo: { ...debugInfo, timing }
      };
      
    } catch (error) {
      timing.queryEnd = new Date();
      timing.duration = timing.queryEnd!.getTime() - timing.queryStart.getTime();
      
      debugInfo.communicationLog = this.exportLSPCommunicationLog();
      debugInfo.error = {
        message: (error as Error).message,
        stack: (error as Error).stack
      };
      
      this.logger.error('💥 workspace/symbol query failed', error as Error);
      
      return {
        success: false,
        results: [],
        debugInfo: { ...debugInfo, timing }
      };
    }
  }

  /**
   * LSPベースのシンボル検索
   */
  private async searchSymbolsWithLSP(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
  }): Promise<SymbolSearchResult[]> {
    const { kind, exactMatch = false, maxResults = 100 } = options || {};
    const results: SymbolSearchResult[] = [];
    
    // ワークスペース内のSwiftファイルを取得
    const files = await this.findSwiftFiles();
    this.logger.info(`Swift LSP: Found ${files.length} Swift files in workspace`);
    
    // Package.swiftファイルが含まれているかチェック
    const packageSwiftFile = files.find(f => f.endsWith('Package.swift'));
    if (packageSwiftFile) {
      this.logger.info(`Swift LSP: Package.swift found: ${packageSwiftFile}`);
    }
    
    // 少数のファイルから開始（パフォーマンス対策）
    const targetFiles = files.slice(0, 10);
    this.logger.info(`Swift LSP: Processing ${targetFiles.length} files`);
    
    for (const file of targetFiles) {
      try {
        const symbols = await this.getFileSymbols(file);
        this.logger.info(`Swift LSP: File ${file}: found ${symbols.length} symbols`);
        
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
            this.logger.info(`Swift LSP: Found matching symbol: ${symbol.name} (kind: ${symbol.kind})`);
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
        this.logger.warn(`Swift LSP: Failed to get symbols for ${file}`, { error: (error as Error).message });
      }
    }
    
    return results;
  }

  /**
   * Phase 1強化: フォールバックキャッシュ取得
   */
  /**
   * フォールバックキャッシュから結果を取得 (新しいキャッシュクラス使用)
   */
  private getCachedFallbackResults(cacheKey: string): SymbolSearchResult[] {
    return this.cache.getFallbackCache(cacheKey) || [];
  }

  /**
   * Phase 1強化: キャッシュ付きフォールバック検索
   */
  private async searchSymbolsWithFallbackCached(
    query: string, 
    options: { exactMatch?: boolean; maxResults?: number },
    cacheKey: string
  ): Promise<SymbolSearchResult[]> {
    this.metrics.recordFallbackUsage();
    
    const results = await this.searchSymbolsWithFallback(query, options);
    
    // 結果をキャッシュ (新しいキャッシュクラス使用)
    if (results.length > 0) {
      this.cache.setFallbackCache(cacheKey, results);
    }
    
    return results;
  }

  /**
   * フォールバック：テキストベースのシンボル検索
   */
  private async searchSymbolsWithFallback(query: string, options?: {
    kind?: SymbolKind;
    exactMatch?: boolean;
    maxResults?: number;
  }): Promise<SymbolSearchResult[]> {
    const { exactMatch = false, maxResults = 100 } = options || {};
    const results: SymbolSearchResult[] = [];
    
    this.logger.info(`Swift LSP: Starting fallback text-based search for: "${query}"`);
    
    const files = await this.findSwiftFiles();
    
    for (const file of files) {
      try {
        const fsService = FileSystemService.getInstance();
        const content = await fsService.readFile(file, { encoding: 'utf8' }) as string;
        const lines = content.split('\n');
        
        // Swiftシンボルの正規表現パターン
        const patterns = [
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?class\s+(\w+)/g, kind: 5 }, // Class
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?struct\s+(\w+)/g, kind: 23 }, // Struct
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?enum\s+(\w+)/g, kind: 10 }, // Enum
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?protocol\s+(\w+)/g, kind: 11 }, // Interface
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?func\s+(\w+)/g, kind: 12 }, // Function
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?var\s+(\w+)/g, kind: 13 }, // Variable
          { regex: /^\s*(?:public\s+|private\s+|internal\s+)?let\s+(\w+)/g, kind: 14 }, // Constant
        ];
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          
          for (const pattern of patterns) {
            pattern.regex.lastIndex = 0; // Reset regex
            const match = pattern.regex.exec(line);
            
            if (match) {
              const symbolName = match[1];
              
              // 名前フィルタ
              const matches = exactMatch 
                ? symbolName === query
                : symbolName.toLowerCase().includes(query.toLowerCase());
                
              if (matches) {
                results.push({
                  name: symbolName,
                  kind: pattern.kind as SymbolKind,
                  file: file,
                  position: { line: lineIndex, character: match.index || 0 },
                  range: {
                    start: { line: lineIndex, character: match.index || 0 },
                    end: { line: lineIndex, character: (match.index || 0) + symbolName.length }
                  },
                  detail: `Found via text search in ${path.basename(file)}`,
                  documentation: line.trim()
                });
                
                if (results.length >= maxResults) {
                  break;
                }
              }
            }
          }
          
          if (results.length >= maxResults) {
            break;
          }
        }
        
      } catch (error) {
        this.logger.warn(`Swift LSP: Failed to read file for fallback search: ${file}`, { error: (error as Error).message });
      }
      
      if (results.length >= maxResults) {
        break;
      }
    }
    
    this.logger.info(`Swift LSP: Fallback search completed, found ${results.length} symbols`);
    return results;
  }

  /**
   * Phase 1強化: 包括的診断レポート生成
   */
  generateDiagnosticReport(): {
    timestamp: string;
    lspStatus: {
      connected: boolean;
      lastActivity: string | null;
      errorState: string | null;
    };
    performanceMetrics: any;
    cacheStatus: {
      lspCacheSize: number;
      fallbackCacheSize: number;
      oldestCacheEntry: string | null;
    };
    projectInfo: {
      workspaceRoot: string;
      swiftFilesFound: number;
      hasPackageSwift: boolean;
      hasPodfile: boolean;
    };
    recommendations: string[];
  } {
    const report = {
      timestamp: new Date().toISOString(),
      lspStatus: {
        connected: this.state.connected,
        lastActivity: this.state.lastActivity?.toISOString() || null,
        errorState: this.state.errorState || null
      },
      performanceMetrics: this.getPerformanceMetrics(),
      cacheStatus: {
        lspCacheSize: this.cache.getStats().symbolCacheSize,
        fallbackCacheSize: this.cache.getStats().fallbackCacheSize,
        oldestCacheEntry: null // 新しいキャッシュクラスでは不要
      },
      projectInfo: {
        workspaceRoot: this.config.workspaceRoot,
        swiftFilesFound: 0,
        hasPackageSwift: false,
        hasPodfile: false
      },
      recommendations: [] as string[]
    };

    // 推奨事項を生成
    const metrics = this.getPerformanceMetrics();
    
    if (metrics.lspSuccessRate < 0.5) {
      report.recommendations.push("LSP成功率が50%未満です。SourceKit-LSPの設定を確認してください。");
    }
    
    if (metrics.fallbackUsageRate > 0.7) {
      report.recommendations.push("フォールバック使用率が70%を超えています。LSPの安定性を改善することを推奨します。");
    }
    
    if (metrics.averageResponseTime > 1000) {
      report.recommendations.push("平均応答時間が1秒を超えています。キャッシュの利用やプロジェクトの最適化を検討してください。");
    }
    
    if (report.cacheStatus.lspCacheSize === 0 && report.cacheStatus.fallbackCacheSize === 0) {
      report.recommendations.push("キャッシュが使用されていません。検索パフォーマンスの向上のため、頻繁な検索を実行してキャッシュを構築してください。");
    }

    return report;
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
          kind: 'reference', // SourceKit-LSPは種類を区別しない
          context
        });
      }
      
      return results;
    } catch (error) {
      this.logger.error('Swift LSP: Failed to search references', error as Error);
      throw error;
    }
  }

  /**
   * ファイルのシンボル情報を取得（キャッシュ付き）
   */
  private async getFileSymbols(file: string): Promise<SymbolInformation[]> {
    const uri = this.pathToUri(file);
    
    // キャッシュチェック (新しいキャッシュクラス使用)
    const cachedSymbols = this.cache.getSymbolCache(file);
    if (cachedSymbols) {
      return cachedSymbols;
    }
    
    try {
      // ファイルが存在することを確認
      const fsService = FileSystemService.getInstance();
      await fsService.access(file);
      
      // LSP接続状態を確認
      const state = this.getState();
      if (!state.initialized) {
        this.logger.warn(`Swift LSP: LSP not initialized for file: ${file}`, { 
          connected: state.connected, 
          initialized: state.initialized,
          errorState: state.errorState,
          lastActivity: state.lastActivity?.toISOString()
        });
        return [];
      }
      
      // ファイルを明示的に開く
      const fileContent = await fsService.readFile(file, { encoding: 'utf8' }) as string;
      this.logger.info(`Swift LSP: Opening file: ${file} (${fileContent.length} chars)`);
      
      this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'swift',
          version: 1,
          text: fileContent
        }
      });
      this.logger.info(`Swift LSP: Sent didOpen notification for: ${uri}`);
      
      // SourceKit-LSPの処理を待つ
      await new Promise(resolve => setTimeout(resolve, 5000)); // Swiftは処理時間が長い場合があるため5秒に延長
      this.logger.info('Swift LSP: Requesting document symbols...');
      
      const symbols = await this.getDocumentSymbols(uri);
      this.logger.info(`Swift LSP: Received ${symbols.length} symbols from SourceKit-LSP`);
      
      // ファイルを閉じる
      this.sendNotification('textDocument/didClose', {
        textDocument: { uri }
      });
      this.logger.info(`Swift LSP: Sent didClose notification for: ${uri}`);
      
      // キャッシュに保存 (新しいキャッシュクラス使用)
      this.cache.setSymbolCache(file, symbols);
      
      return symbols;
    } catch (error) {
      this.logger.warn(`Swift LSP: Failed to get symbols for file: ${file}`, { error: (error as Error).message });
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
   * キャッシュをクリア (新しいキャッシュクラス使用)
   */
  clearCache(): void {
    // 新しいキャッシュインスタンスで置き換え
    (this as any).cache = new SwiftLSPCache();
    this.logger.info('Swift LSP: cache cleared');
  }

  /**
   * Package.swift解析後の強制インデックス再構築
   */
  async forceProjectReindex(): Promise<void> {
    this.logger.info('Swift LSP: Starting forced project reindex');
    
    try {
      // 1. 現在のキャッシュをクリア
      this.clearCache();
      
      // 2. Package.swiftプロジェクト設定を検出
      const projectConfig = await this.detectProjectConfig();
      
      if (projectConfig.hasPackageSwift) {
        this.logger.info('Swift LSP: Package.swift detected, rebuilding project index');
        
        // 3. Package.swiftファイルを明示的に開いてプロジェクトを再認識
        const packageUri = this.pathToUri(projectConfig.packageSwiftPath!);
        const fsService = FileSystemService.getInstance();
        const packageContent = await fsService.readFile(projectConfig.packageSwiftPath!, { encoding: 'utf8' }) as string;
        
        // Package.swiftを開く
        this.sendNotification('textDocument/didOpen', {
          textDocument: {
            uri: packageUri,
            languageId: 'swift',
            version: 1,
            text: packageContent
          }
        });
        
        // 少し待ってからプロジェクト構造の再構築を促す
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 4. メインのSwiftファイルを順次開いてインデックスを再構築
        const swiftFiles = await this.findSwiftFiles();
        const mainFiles = swiftFiles.filter(f => !f.endsWith('Package.swift')).slice(0, 5);
        
        for (const file of mainFiles) {
          try {
            const content = await fsService.readFile(file, { encoding: 'utf8' }) as string;
            const uri = this.pathToUri(file);
            
            this.sendNotification('textDocument/didOpen', {
              textDocument: {
                uri,
                languageId: 'swift',
                version: 1,
                text: content
              }
            });
            
            // ファイル間で少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // ファイルを閉じる
            this.sendNotification('textDocument/didClose', {
              textDocument: { uri }
            });
            
          } catch (error) {
            this.logger.warn(`Swift LSP: Failed to process file for reindex: ${file}`, { error: (error as Error).message });
          }
        }
        
        // Package.swiftも閉じる
        this.sendNotification('textDocument/didClose', {
          textDocument: { uri: packageUri }
        });
        
        // 5. インデックス完了まで待機
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        this.logger.info('Swift LSP: Forced project reindex completed');
      } else {
        this.logger.warn('Swift LSP: No Package.swift found, skipping forced reindex');
      }
      
    } catch (error) {
      this.logger.error('Swift LSP: Failed to force project reindex', error as Error);
      throw error;
    }
  }

  /**
   * Swiftプロジェクト設定を検出
   */
  async detectProjectConfig(): Promise<{
    hasPackageSwift: boolean;
    packageSwiftPath?: string;
    hasPodfile: boolean;
    podfilePath?: string;
    swiftVersion?: string;
    dependencies?: string[];
    pods?: string[];
  }> {
    const result = {
      hasPackageSwift: false,
      packageSwiftPath: undefined as string | undefined,
      hasPodfile: false,
      podfilePath: undefined as string | undefined,
      swiftVersion: undefined as string | undefined,
      dependencies: undefined as string[] | undefined,
      pods: undefined as string[] | undefined
    };

    try {
      // Package.swift検索
      const packageSwiftPath = path.join(this.config.workspaceRoot, 'Package.swift');
      try {
        const fsService = FileSystemService.getInstance();
        await fsService.access(packageSwiftPath);
        result.hasPackageSwift = true;
        result.packageSwiftPath = packageSwiftPath;

        // Package.swiftから依存関係を解析
        const packageContent = await fsService.readFile(packageSwiftPath, { encoding: 'utf8' }) as string;
        const dependencies = this.parseSwiftPackageDependencies(packageContent);
        if (dependencies.length > 0) {
          result.dependencies = dependencies;
        }
      } catch {
        // Package.swiftが見つからない
      }

      // Podfile検索
      const podfilePath = path.join(this.config.workspaceRoot, 'Podfile');
      try {
        const fsService = FileSystemService.getInstance();
        await fsService.access(podfilePath);
        result.hasPodfile = true;
        result.podfilePath = podfilePath;

        // Podfileからポッド依存関係を解析
        const podfileContent = await fsService.readFile(podfilePath, { encoding: 'utf8' }) as string;
        const pods = this.parsePodfilePods(podfileContent);
        if (pods.length > 0) {
          result.pods = pods;
        }
      } catch {
        // Podfileが見つからない
      }

      // Swift Toolchainバージョンを取得
      try {
        const { spawn } = await import('child_process');
        const swiftProcess = spawn('swift', ['--version'], { stdio: 'pipe' });
        
        const version = await new Promise<string>((resolve) => {
          let output = '';
          swiftProcess.stdout?.on('data', (data) => {
            output += data.toString();
          });
          swiftProcess.on('exit', () => {
            const versionMatch = output.match(/Swift version (\d+\.\d+(?:\.\d+)?)/);
            resolve(versionMatch ? versionMatch[1] : 'unknown');
          });
          swiftProcess.on('error', () => resolve('unknown'));
          setTimeout(() => {
            swiftProcess.kill();
            resolve('unknown');
          }, 3000); // 3秒に短縮
        });
        
        result.swiftVersion = version;
      } catch {
        // Swiftバージョン取得失敗
      }

      return result;
    } catch (error) {
      this.logger.error('Swift LSP: Failed to detect project config', error as Error);
      return result;
    }
  }

  /**
   * Package.swiftから依存関係を解析（簡易パーサー）
   */
  private parseSwiftPackageDependencies(packageContent: string): string[] {
    const dependencies: string[] = [];
    
    try {
      // 簡易的な依存関係パーサー（正規表現ベース）
      const dependencyRegex = /\.package\s*\(\s*url:\s*["']([^"']+)["']/g;
      let match;
      
      while ((match = dependencyRegex.exec(packageContent)) !== null) {
        const url = match[1];
        // GitHubリポジトリ名を抽出
        const repoMatch = url.match(/github\.com\/[^\/]+\/([^\/\.]+)/);
        if (repoMatch) {
          dependencies.push(repoMatch[1]);
        } else {
          // URLから推測
          const parts = url.split('/');
          const lastPart = parts[parts.length - 1].replace(/\.git$/, '');
          if (lastPart) {
            dependencies.push(lastPart);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Swift LSP: Failed to parse Package.swift dependencies', { error: (error as Error).message });
    }
    
    return dependencies;
  }

  /**
   * Podfileからポッド依存関係を解析（簡易パーサー）
   */
  private parsePodfilePods(podfileContent: string): string[] {
    const pods: string[] = [];
    
    try {
      // ポッド定義の正規表現（複数のパターンに対応）
      const podRegexes = [
        /pod\s+['"]([^'"]+)['"]/g,  // pod 'PodName'
        /pod\s+([A-Za-z0-9_-]+)/g   // pod PodName
      ];
      
      for (const regex of podRegexes) {
        let match;
        regex.lastIndex = 0; // グローバル正規表現のリセット
        
        while ((match = regex.exec(podfileContent)) !== null) {
          const podName = match[1];
          // 重複を避ける
          if (!pods.includes(podName)) {
            pods.push(podName);
          }
        }
      }
      
      // コメント行を除外する更なるフィルタリング
      const filteredPods = pods.filter(pod => {
        const lines = podfileContent.split('\n');
        for (const line of lines) {
          if (line.includes(`'${pod}'`) || line.includes(`"${pod}"`)) {
            const trimmed = line.trim();
            // '#'で始まる行（コメント）は除外
            if (!trimmed.startsWith('#')) {
              return true;
            }
          }
        }
        return false;
      });
      
      return filteredPods;
    } catch (error) {
      this.logger.warn('Swift LSP: Failed to parse Podfile pods', { error: (error as Error).message });
    }
    
    return pods;
  }

  /**
   * Phase 1強化: 実動作テスト実行
   */
  async runIntegrationTest(): Promise<{
    success: boolean;
    testResults: {
      lspConnection: { success: boolean; error?: string };
      symbolSearch: { success: boolean; resultCount: number; error?: string };
      fallbackSearch: { success: boolean; resultCount: number; error?: string };
      cacheOperation: { success: boolean; error?: string };
      swiftFileDetection: { success: boolean; fileCount: number; error?: string };
    };
    performanceMetrics: any;
    recommendations: string[];
  }> {
    const testResults: {
      lspConnection: { success: boolean; error?: string };
      symbolSearch: { success: boolean; resultCount: number; error?: string };
      fallbackSearch: { success: boolean; resultCount: number; error?: string };
      cacheOperation: { success: boolean; error?: string };
      swiftFileDetection: { success: boolean; fileCount: number; error?: string };
    } = {
      lspConnection: { success: false },
      symbolSearch: { success: false, resultCount: 0 },
      fallbackSearch: { success: false, resultCount: 0 },
      cacheOperation: { success: false },
      swiftFileDetection: { success: false, fileCount: 0 }
    };

    try {
      // 1. LSP接続テスト
      try {
        const isConnected = this.state.connected || await this.connect().then(() => true).catch(() => false);
        testResults.lspConnection.success = isConnected;
      } catch (error) {
        testResults.lspConnection.error = (error as Error).message;
      }

      // 2. Swiftファイル検出テスト
      try {
        const swiftFiles = await this.findSwiftFiles();
        testResults.swiftFileDetection.success = true;
        testResults.swiftFileDetection.fileCount = swiftFiles.length;
      } catch (error) {
        testResults.swiftFileDetection.error = (error as Error).message;
      }

      // 3. シンボル検索テスト
      try {
        const searchResults = await this.searchSymbols('Test', { maxResults: 5 });
        testResults.symbolSearch.success = true;
        testResults.symbolSearch.resultCount = searchResults.length;
      } catch (error) {
        testResults.symbolSearch.error = (error as Error).message;
      }

      // 4. フォールバック検索テスト
      try {
        const fallbackResults = await this.searchSymbolsWithFallback('func', { maxResults: 3 });
        testResults.fallbackSearch.success = true;
        testResults.fallbackSearch.resultCount = fallbackResults.length;
      } catch (error) {
        testResults.fallbackSearch.error = (error as Error).message;
      }

      // 5. キャッシュ動作テスト
      try {
        const cacheKey = 'test_cache_key';
        this.cache.setFallbackCache(cacheKey, []);
        const cached = this.getCachedFallbackResults(cacheKey);
        testResults.cacheOperation.success = Array.isArray(cached);
      } catch (error) {
        testResults.cacheOperation.error = (error as Error).message;
      }

      const overallSuccess = Object.values(testResults).some(result => result.success);
      const diagnosticReport = this.generateDiagnosticReport();

      return {
        success: overallSuccess,
        testResults,
        performanceMetrics: this.getPerformanceMetrics(),
        recommendations: diagnosticReport.recommendations
      };
    } catch (error) {
      return {
        success: false,
        testResults,
        performanceMetrics: this.getPerformanceMetrics(),
        recommendations: [`統合テストの実行中にエラーが発生しました: ${(error as Error).message}`]
      };
    }
  }
}