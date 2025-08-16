/**
 * code_find_symbol 機能実装
 * TypeScript LSPを使用したシンボル検索
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import type { SymbolKind, SymbolInformation } from 'vscode-languageserver-protocol';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { LSPServerManager } from '../../services/LSPServerManager.js';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import { getHttpLSPClient } from '../../services/lsp-proxy/http-lsp-client.js';
import { symbolKindToString } from './types.js';

/**
 * シンボル検索パラメータスキーマ
 */
export const CodeFindSymbolParamsSchema = z.object({
  symbol_name: z.string().min(1).describe('検索するシンボル名'),
  search_type: z.enum(['exact', 'fuzzy']).optional().default('fuzzy').describe('検索タイプ'),
  symbol_kind: z.number().optional().describe('シンボルの種類（SymbolKind）'),
  file_pattern: z.string().optional().describe('ファイルパターン（部分マッチ）'),
  max_results: z.number().min(1).max(1000).optional().default(100).describe('最大結果数'),
  enable_fallback: z.boolean().optional().default(true).describe('フォールバック検索を有効にするか（デフォルト: true）')
});

export type CodeFindSymbolParams = z.infer<typeof CodeFindSymbolParamsSchema>;

/**
 * シンボル検索結果の型定義
 */
export interface CodeSymbolResult {
  /** シンボル名 */
  name: string;
  /** シンボルの種類 */
  kind: SymbolKind;
  /** シンボル種類の説明 */
  kind_name: string;
  /** ファイルパス */
  file: string;
  /** 行番号（0から開始） */
  line: number;
  /** 列番号（0から開始） */
  column: number;
  /** 詳細情報（シグネチャなど） */
  detail?: string;
  /** ドキュメント */
  documentation?: string;
}

/**
 * プロジェクトの言語タイプを検出
 */
async function detectProjectLanguage(workspaceRoot: string): Promise<'swift' | 'typescript' | 'unknown'> {
  const logger = Logger.getInstance();
  
  try {
    // Swift プロジェクトマーカーをチェック
    const swiftMarkers = [
      'Package.swift',
      'Podfile',
      '.xcodeproj',
      '.xcworkspace'
    ];
    
    for (const marker of swiftMarkers) {
      const markerPath = path.join(workspaceRoot, marker);
      if (fs.existsSync(markerPath)) {
        logger.info(`Detected Swift project marker: ${marker}`);
        return 'swift';
      }
      
      // .xcodeproj/.xcworkspaceは拡張子として検索
      if (marker.startsWith('.')) {
        try {
          const files = fs.readdirSync(workspaceRoot);
          if (files.some(f => f.endsWith(marker))) {
            logger.info(`Detected Swift project marker: ${marker}`);
            return 'swift';
          }
        } catch (error) {
          // ディレクトリ読み取りエラーは無視
        }
      }
    }
    
    // TypeScript/JavaScript プロジェクトマーカー
    const tsMarkers = ['package.json', 'tsconfig.json', 'jsconfig.json'];
    for (const marker of tsMarkers) {
      if (fs.existsSync(path.join(workspaceRoot, marker))) {
        logger.info(`Detected TypeScript/JavaScript project marker: ${marker}`);
        return 'typescript';
      }
    }
    
    // Swiftファイルの存在チェック（フォールバック）
    if (hasSwiftFiles(workspaceRoot)) {
      logger.info('Detected Swift files in project');
      return 'swift';
    }
    
    return 'unknown';
  } catch (error) {
    logger.error('Failed to detect project language', error as Error);
    return 'unknown';
  }
  }

  /**
 * Swiftファイルが存在するかチェック（3階層まで）
 */
  function hasSwiftFiles(workspaceRoot: string, depth: number = 0, maxDepth: number = 3): boolean {
  if (depth >= maxDepth) return false;
  
  try {
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(workspaceRoot, entry.name);
      
      // .swiftファイルを発見
      if (entry.isFile() && entry.name.endsWith('.swift')) {
        return true;
      }
      
      // ディレクトリを再帰的に探索（node_modules等は除外）
      if (entry.isDirectory() && 
          !entry.name.startsWith('.') && 
          entry.name !== 'node_modules' &&
          entry.name !== 'Pods' &&
          entry.name !== 'build' &&
          entry.name !== 'DerivedData') {
        if (hasSwiftFiles(fullPath, depth + 1, maxDepth)) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
  }

  /**
 * Swift固有のシンボル種類を判定
 */
  function getSwiftSymbolKind(content: string): SymbolKind {
  // Swift固有の構造判定
  if (content.match(/\b(class|actor)\s+\w+/)) return 5; // Class
  if (content.match(/\bstruct\s+\w+/)) return 23; // Struct
  if (content.match(/\benum\s+\w+/)) return 10; // Enum
  if (content.match(/\bprotocol\s+\w+/)) return 11; // Interface (Protocol)
  if (content.match(/\bfunc\s+\w+/)) return 12; // Function
  if (content.match(/\binit\s*\(/)) return 9; // Constructor
  if (content.match(/\bvar\s+\w+/)) return 13; // Variable
  if (content.match(/\blet\s+\w+/)) return 14; // Constant
  if (content.match(/\btypealias\s+\w+/)) return 26; // TypeParameter
  if (content.match(/\bextension\s+\w+/)) return 5; // Class (Extension as Class)
  
  // TypeScript/JavaScript構造判定（フォールバック）
  if (content.includes('class')) return 5; // Class
  if (content.includes('interface')) return 11; // Interface
  if (content.includes('function')) return 12; // Function
  if (content.match(/\b(const|let|var)\s+/)) return 13; // Variable
  
  return 12; // Function as default
}

// SwiftLSPインスタンスをキャッシュ（パフォーマンス改善）
let cachedSwiftLsp: any = null;
let cachedWorkspaceRoot: string | null = null;

// プロセス終了時のクリーンアップ
process.on('exit', async () => {
  if (cachedSwiftLsp) {
    try {
      await cachedSwiftLsp.disconnect();
    } catch (error) {
      // 終了時のエラーは無視
    }
    cachedSwiftLsp = null;
    cachedWorkspaceRoot = null;
  }
});

/**
 * SwiftLSP直接統合による検索（Phase 2実装 - パフォーマンス改善版）
 */
async function searchWithSwiftLSP(
  symbolName: string,
  workspaceRoot: string, 
  params: CodeFindSymbolParams,
  logger: Logger
): Promise<{
  success: boolean;
  message?: string;
  symbols: CodeSymbolResult[];
  stats: {
    total_found: number;
    search_type: string;
    workspace: string;
    source?: string;
  };
}> {
  try {
    // SwiftLSP サービスを動的インポート（初回のみ）
    const { SwiftLSP } = await import('../../services/lsp/swift-lsp.js');
    
    // ワークスペースが変更された場合、または初回の場合のみ新規作成
    if (!cachedSwiftLsp || cachedWorkspaceRoot !== workspaceRoot) {
      // 既存のインスタンスがあれば切断
      if (cachedSwiftLsp) {
        try {
          await cachedSwiftLsp.disconnect();
        } catch (error) {
          logger.warn('Failed to disconnect previous SwiftLSP instance', { error });
        }
      }
      
      // 新しいインスタンスを作成
      cachedSwiftLsp = new SwiftLSP(workspaceRoot, logger);
      cachedWorkspaceRoot = workspaceRoot;
      
      // 接続を確立
      await cachedSwiftLsp.connect();
    }
    
    const swiftLsp = cachedSwiftLsp;
    
    try {
      // LSPを使用してシンボル検索（searchSymbolsメソッドを使用）
      const symbols = await swiftLsp.searchSymbols(symbolName, {
        kind: params.symbol_kind as SymbolKind | undefined,
        exactMatch: params.search_type === 'exact',
        maxResults: params.max_results || 100,
        enableFallback: params.enable_fallback ?? true
      });
      
      // 結果をCodeSymbolResult形式に変換
      const results: CodeSymbolResult[] = symbols.map((symbol: any) => ({
        name: symbol.name,
        kind: symbol.kind,
        kind_name: symbolKindToString(symbol.kind),
        file: path.relative(workspaceRoot, symbol.location.uri.replace('file://', '')),
        line: symbol.location.range.start.line,
        column: symbol.location.range.start.character,
        detail: symbol.containerName,
        documentation: symbol.detail
      }));
      
      // ファイルパターンでフィルタリング（指定された場合）
      const filteredResults = params.file_pattern
        ? results.filter(r => r.file.includes(params.file_pattern!))
        : results;
      
      return {
        success: true,
        symbols: filteredResults.slice(0, params.max_results || 100),
        stats: {
          total_found: filteredResults.length,
          search_type: params.search_type || 'fuzzy',
          workspace: path.basename(workspaceRoot),
          source: 'swiftlsp'
        }
      };
    } finally {
      // 接続を維持（パフォーマンス改善のため切断しない）
      // await swiftLsp.disconnect();
    }
  } catch (error) {
    logger.error('SwiftLSP検索エラー:', error as Error);
    
    // エラー時はテキストベース検索にフォールバック
    return {
      success: false,
      message: `SwiftLSP検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      symbols: [],
      stats: {
        total_found: 0,
        search_type: params.search_type || 'fuzzy',
        workspace: path.basename(workspaceRoot),
        source: 'swiftlsp_fallback'
      }
    };
  }
}

/**
 * テキストベースのシンボル検索（フォールバック機能）
 */
async function textBasedSymbolSearch(
  symbolName: string, 
  workspaceRoot: string, 
  params: CodeFindSymbolParams
): Promise<{
  query: string;
  languages: string[] | 'all';
  total: number;
  symbols: SymbolInformation[];
}> {
  const logger = Logger.getInstance();
  
  try {
    logger.info(`Starting text-based symbol search for: ${symbolName}`);
    
    // プロジェクト言語を検出
    const projectLanguage = await detectProjectLanguage(workspaceRoot);
    logger.info(`Detected project language: ${projectLanguage}`);
    
    // 言語に応じた検索パターンとファイル拡張子を設定
    let searchPatterns: string[] = [];
    let fileExtensions: string[] = [];
    let detectedLanguages: string[] = [];
    
    if (projectLanguage === 'swift') {
      // Swift固有パターン
      searchPatterns = [
        `class\\s+${symbolName}`,
        `struct\\s+${symbolName}`,
        `enum\\s+${symbolName}`,
        `protocol\\s+${symbolName}`,
        `func\\s+${symbolName}`,
        `var\\s+${symbolName}`,
        `let\\s+${symbolName}`,
        `typealias\\s+${symbolName}`,
        `actor\\s+${symbolName}`,
        `extension\\s+${symbolName}`,
        // アクセス修飾子付きバージョン
        `public\\s+class\\s+${symbolName}`,
        `private\\s+class\\s+${symbolName}`,
        `internal\\s+class\\s+${symbolName}`,
        `public\\s+struct\\s+${symbolName}`,
        `private\\s+struct\\s+${symbolName}`,
        `public\\s+func\\s+${symbolName}`,
        `private\\s+func\\s+${symbolName}`,
        `static\\s+func\\s+${symbolName}`,
        `override\\s+func\\s+${symbolName}`
      ];
      fileExtensions = ['*.swift'];
      detectedLanguages = ['swift'];
    } else if (projectLanguage === 'typescript') {
      // TypeScript/JavaScriptパターン
      searchPatterns = [
        `class\\s+${symbolName}`,
        `interface\\s+${symbolName}`,
        `function\\s+${symbolName}`,
        `const\\s+${symbolName}`,
        `let\\s+${symbolName}`,
        `var\\s+${symbolName}`,
        `export\\s+class\\s+${symbolName}`,
        `export\\s+interface\\s+${symbolName}`,
        `export\\s+function\\s+${symbolName}`,
        `export\\s+const\\s+${symbolName}`
      ];
      fileExtensions = ['*.ts', '*.tsx', '*.js', '*.jsx'];
      detectedLanguages = ['typescript'];
    } else {
      // 不明な場合は両方のパターンを試す
      searchPatterns = [
        `class\\s+${symbolName}`,
        `struct\\s+${symbolName}`,
        `enum\\s+${symbolName}`,
        `protocol\\s+${symbolName}`,
        `interface\\s+${symbolName}`,
        `function\\s+${symbolName}`,
        `func\\s+${symbolName}`,
        `const\\s+${symbolName}`,
        `let\\s+${symbolName}`,
        `var\\s+${symbolName}`
      ];
      fileExtensions = ['*.swift', '*.ts', '*.tsx', '*.js', '*.jsx'];
      detectedLanguages = ['all'];
    }
    
    const results: SymbolInformation[] = [];
    
    // 各ファイル拡張子に対してパターン検索を実行
    for (const extension of fileExtensions) {
      for (const pattern of searchPatterns) {
        try {
          // grep コマンドでパターン検索
          const grepCommand = `grep -rn --include="${extension}" -E "${pattern}" "${workspaceRoot}"`;
          const output = execSync(grepCommand, { encoding: 'utf8', timeout: 5000 }).toString();
          
          if (output.trim()) {
            const lines = output.trim().split('\n');
            logger.info(`Found ${lines.length} matches with pattern: ${pattern} in ${extension} files`);
            
            for (const line of lines.slice(0, params.max_results || 100)) {
              const match = line.match(/^([^:]+):(\d+):(.+)$/);
              if (match) {
                const [, filePath, lineNumber, content] = match;
                
                // シンボルの種類を判定（Swift対応版）
                const symbolKind = getSwiftSymbolKind(content);
                
                const symbolInfo: SymbolInformation = {
                  name: symbolName,
                  kind: symbolKind as SymbolKind,
                  location: {
                    uri: `file://${filePath}`,
                    range: {
                      start: { line: parseInt(lineNumber) - 1, character: 0 },
                      end: { line: parseInt(lineNumber) - 1, character: content.length }
                    }
                  }
                };
                
                results.push(symbolInfo);
              }
            }
          }
        } catch (error) {
          // 個別のパターンエラーは無視して続行
          logger.debug(`Pattern search failed: ${pattern} in ${extension}`, { error: (error as Error).message });
        }
      }
    }
    
    // 重複除去（同じファイルの同じ行）
    const uniqueResults = results.filter((symbol, index, array) => 
      array.findIndex(s => 
        s.location.uri === symbol.location.uri && 
        s.location.range.start.line === symbol.location.range.start.line
      ) === index
    );
    
    logger.info(`Text-based search found ${uniqueResults.length} unique symbols`);
    
    return {
      query: symbolName,
      languages: detectedLanguages.length === 1 ? detectedLanguages : 'all',
      total: uniqueResults.length,
      symbols: uniqueResults
    };
    
  } catch (error) {
    logger.error('Text-based symbol search failed', error as Error);
    
    // 空の結果を返す
    return {
      query: symbolName,
      languages: 'all',
      total: 0,
      symbols: []
    };
  }
}

/**
 * code_find_symbol ツール実装
 */
export const codeFindSymbolTool = {
  name: 'code_find_symbol',
  description: 'TypeScript/JavaScript/Java/Swiftファイル内のシンボル（関数、クラス、変数など）を検索します。LSPサーバーを使用してセマンティック検索を提供します。',
  inputSchema: CodeFindSymbolParamsSchema,

  async execute(params: CodeFindSymbolParams): Promise<{
    symbols: CodeSymbolResult[];
    stats: {
      total_found: number;
      search_type: string;
      workspace: string;
    };
  }> {
    const logger = Logger.getInstance();
    
    try {
      // LSPサーバー自動起動確認（TypeScript/JavaScriptの場合のみ必要）
      // Swiftプロジェクトは直接統合を使用するため不要

      // アクティブなワークスペースを確認
      const workspaceManager = WorkspaceManager.getInstance();
      const workspace = await workspaceManager.getCurrentWorkspace();
      
      if (!workspace) {
        throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
      }

      const workspaceRoot = workspace.root_path;
      logger.info(`Searching symbols in workspace: ${workspaceRoot}`);

      // プロジェクトの言語を検出
      const projectLanguage = await detectProjectLanguage(workspaceRoot);
      logger.info(`Detected project language: ${projectLanguage}`);

      // TypeScript/JavaScriptプロジェクトの場合のみLSPプロキシサーバーチェック
      if (projectLanguage === 'typescript') {
        const lspServerManager = new LSPServerManager();
        if (!(await lspServerManager.isProxyRunning())) {
          logger.info('LSP proxy server not running for TypeScript, attempting to start...');
          try {
            const started = await lspServerManager.startLSPProxy(process.cwd());
            if (!started) {
              logger.warn('LSP proxy server failed to start, continuing without LSP support');
            }
          } catch (error) {
            logger.warn('LSP proxy server startup failed', { error });
          }
        }
      }

      // Phase 2: Swiftプロジェクトの場合はSwiftLSP直接統合を試みる
      let searchResponse;
      if (projectLanguage === 'swift') {
        logger.info('Swift project detected, attempting SwiftLSP direct integration');
        
        // SwiftLSP直接統合を試みる
        const swiftLspResult = await searchWithSwiftLSP(params.symbol_name, workspaceRoot, params, logger);
        
        if (swiftLspResult.success && swiftLspResult.symbols.length > 0) {
          // SwiftLSP成功時はその結果を使用
          logger.info(`SwiftLSP returned ${swiftLspResult.symbols.length} symbols`);
          searchResponse = {
            query: params.symbol_name,
            languages: ['swift'],
            total: swiftLspResult.symbols.length,
            symbols: swiftLspResult.symbols.map(s => ({
              name: s.name,
              kind: s.kind,
              language: 'swift',
              location: {
                uri: `file://${path.join(workspaceRoot, s.file)}`,
                range: {
                  start: { line: s.line, character: s.column },
                  end: { line: s.line, character: s.column }
                }
              },
              containerName: s.detail
            }))
          };
        } else {
          // SwiftLSP失敗時はテキストベース検索にフォールバック
          logger.info('SwiftLSP failed or returned no results, falling back to text-based search');
          searchResponse = await textBasedSymbolSearch(params.symbol_name, workspaceRoot, params);
        }
      } else {
        // TypeScript/その他のプロジェクトは既存のHTTP LSPクライアントを使用
        // HTTP LSPクライアントを取得
        const httpLSPClient = getHttpLSPClient();
        
        // シンボル検索を実行
        try {
          searchResponse = await httpLSPClient.searchSymbols(params.symbol_name, {
            languages: params.symbol_kind ? undefined : ['typescript'], // 種類指定がない場合はTypeScriptのみ
            maxResults: params.max_results
          });
          
          logger.info(`LSP API returned ${searchResponse.symbols.length} symbols`);
          
          // LSP APIが結果を返さない場合、テキストベースフォールバックを実行
          if (searchResponse.symbols.length === 0) {
            logger.info('LSP API returned no results, falling back to text-based search');
            searchResponse = await textBasedSymbolSearch(params.symbol_name, workspaceRoot, params);
          }
        } catch (error) {
          logger.warn('LSP API failed, falling back to text-based search', { error: (error as Error).message });
          searchResponse = await textBasedSymbolSearch(params.symbol_name, workspaceRoot, params);
        }
      }

      // ファイルパターンフィルタを適用（指定されている場合）
      const filteredSymbols = params.file_pattern 
        ? searchResponse.symbols.filter(symbol => {
            // LSPから返されるLocationオブジェクトのuriからファイルパスを取得
            const filePath = symbol.location.uri.replace('file://', '');
            return filePath.toLowerCase().includes(params.file_pattern!.toLowerCase());
          })
        : searchResponse.symbols;

      // シンボル種類フィルタを適用（指定されている場合）
      const typeFilteredSymbols = params.symbol_kind 
        ? filteredSymbols.filter(symbol => symbol.kind === params.symbol_kind)
        : filteredSymbols;

      // 正確なマッチフィルタを適用
      const finalSymbols = params.search_type === 'exact'
        ? typeFilteredSymbols.filter(symbol => symbol.name === params.symbol_name)
        : typeFilteredSymbols;

      // 結果を変換
      const results: CodeSymbolResult[] = finalSymbols.map(symbol => ({
        name: symbol.name,
        kind: symbol.kind,
        kind_name: symbolKindToString(symbol.kind),
        file: path.relative(workspaceRoot, symbol.location.uri.replace('file://', '')),
        line: symbol.location.range.start.line,
        column: symbol.location.range.start.character,
        detail: undefined, // SymbolInformationには detail は含まれない
        documentation: undefined // SymbolInformationには documentation は含まれない
      }));

      // 統計情報
      const stats = {
        total_found: results.length,
        search_type: params.search_type,
        workspace: path.basename(workspaceRoot)
      };

      logger.info(`Found ${results.length} symbols for "${params.symbol_name}"`);

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logLSPOperation(
        'FIND_SYMBOL',
        params.symbol_name,
        undefined,
        results.length
      );

      return {
        symbols: results,
        stats
      };

    } catch (error) {
      logger.error('Symbol search failed', error as Error);
      
      // HTTP LSPクライアントのエラーの場合、より詳細なエラーメッセージを提供
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error(
          'LSP Proxy Server is not available. Please ensure the LSP Proxy Server is running on http://localhost:3001'
        );
      }
      
      throw error;
    }
  }
};