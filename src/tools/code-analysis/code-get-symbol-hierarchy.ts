/**
 * code_get_symbol_hierarchy 機能実装
 * TypeScript LSPを使用したシンボル階層取得
 */

import { z } from 'zod';
import path from 'path';
import { FileSystemService } from '../../services/FileSystemService.js';
import type { SymbolKind } from 'vscode-languageserver-protocol';
import { TypeScriptLSP, SwiftLSP, LSPManager } from '../../services/lsp/index.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { Logger } from '../../services/logger.js';

import { LogManager } from '../../utils/log-manager.js';
import { symbolKindToString } from './types.js';

/**
 * シンボル階層取得パラメータスキーマ
 */
export const CodeGetSymbolHierarchyParamsSchema = z.object({
  file_path: z.string().optional().describe('特定のファイルのシンボル階層を取得（省略時はディレクトリ全体）'),
  directory_path: z.string().optional().describe('特定のディレクトリのシンボル階層を取得（省略時は全体）'),
  max_depth: z.number().min(1).max(10).optional().default(3).describe('最大階層深度'),
  include_private: z.boolean().optional().default(false).describe('プライベートシンボルも含めるか'),
  symbol_kinds: z.array(z.number()).optional().describe('含めるシンボル種類の配列（SymbolKind）')
}).refine(
  (data) => data.file_path || data.directory_path || (!data.file_path && !data.directory_path),
  {
    message: "file_path または directory_path のいずれかを指定してください（両方省略時は全体を対象）"
  }
);

export type CodeGetSymbolHierarchyParams = z.infer<typeof CodeGetSymbolHierarchyParamsSchema>;

/**
 * シンボル階層ノードの型定義
 */
export interface SymbolHierarchyNode {
  /** シンボル名 */
  name: string;
  /** シンボルの種類 */
  kind: SymbolKind;
  /** シンボル種類の説明 */
  kind_name: string;
  /** ファイルパス（相対パス） */
  file: string;
  /** 開始行番号（0から開始） */
  start_line: number;
  /** 開始列番号（0から開始） */
  start_column: number;
  /** 終了行番号（0から開始） */
  end_line: number;
  /** 終了列番号（0から開始） */
  end_column: number;
  /** 詳細情報 */
  detail?: string;
  /** 子シンボル */
  children: SymbolHierarchyNode[];
  /** 階層深度 */
  depth: number;
}

/**
 * ファイル別のシンボル階層
 */
export interface FileSymbolHierarchy {
  /** ファイルパス（相対パス） */
  file: string;
  /** 言語タイプ */
  language: 'typescript' | 'javascript' | 'swift' | 'unknown';
  /** ルートレベルのシンボル */
  symbols: SymbolHierarchyNode[];
  /** シンボル総数 */
  total_symbols: number;
}

/**
 * code_get_symbol_hierarchy ツール実装
 */
export const codeGetSymbolHierarchyTool = {
  name: 'code_get_symbol_hierarchy',
  description: 'ファイルまたはディレクトリのシンボル階層（クラス、関数、変数など）を階層構造で取得します。LSPサーバーを使用してセマンティック解析を提供します。',
  inputSchema: CodeGetSymbolHierarchyParamsSchema,

  async execute(params: CodeGetSymbolHierarchyParams): Promise<{
    hierarchies: FileSymbolHierarchy[];
    stats: {
      total_files: number;
      total_symbols: number;
      max_depth_reached: number;
      languages: string[];
      search_scope: string;
    };
  }> {
    const logger = Logger.getInstance();
    
    try {
      // アクティブなワークスペースを確認
      const workspaceManager = WorkspaceManager.getInstance();
      const workspace = await workspaceManager.getCurrentWorkspace();
      
      if (!workspace) {
        throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
      }

      const workspaceRoot = workspace.root_path;
      
      // 検索対象ファイルを決定
      const targetFiles = await determineTargetFiles(workspaceRoot, params);
      
      logger.info(`Analyzing symbol hierarchy for ${targetFiles.length} files`);

      const hierarchies: FileSymbolHierarchy[] = [];
      const languageStats = new Set<string>();
      let maxDepthReached = 0;
      let totalSymbols = 0;

      // 各ファイルを並列処理
      const promises = targetFiles.map(async (filePath) => {
        try {
          const language = getLanguageFromFile(filePath);
          languageStats.add(language);
          
          const symbols = await getFileSymbolHierarchy(
            filePath, 
            workspaceRoot, 
            language, 
            params, 
            logger
          );
          
          const hierarchy: FileSymbolHierarchy = {
            file: path.relative(workspaceRoot, filePath),
            language,
            symbols,
            total_symbols: countTotalSymbols(symbols)
          };
          
          // 統計情報を更新
          totalSymbols += hierarchy.total_symbols;
          const fileMaxDepth = getMaxDepth(symbols);
          if (fileMaxDepth > maxDepthReached) {
            maxDepthReached = fileMaxDepth;
          }
          
          return hierarchy;
        } catch (error) {
          logger.warn(`Failed to analyze file ${filePath}:`, { error: (error as Error).message });
          return null;
        }
      });

      const results = await Promise.all(promises);
      
      // 成功した結果のみを収集
      for (const result of results) {
        if (result) {
          hierarchies.push(result);
        }
      }

      // スコープの説明を生成
      let searchScope = 'workspace';
      if (params.file_path) {
        searchScope = `file: ${path.basename(params.file_path)}`;
      } else if (params.directory_path) {
        searchScope = `directory: ${path.basename(params.directory_path)}`;
      }

      const stats = {
        total_files: hierarchies.length,
        total_symbols: totalSymbols,
        max_depth_reached: maxDepthReached,
        languages: Array.from(languageStats),
        search_scope: searchScope
      };

      logger.info(`Symbol hierarchy analysis completed: ${hierarchies.length} files, ${totalSymbols} symbols`);

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logLSPOperation(
        'GET_SYMBOL_HIERARCHY',
        searchScope,
        params.file_path || params.directory_path,
        totalSymbols
      );

      return {
        hierarchies,
        stats
      };

    } catch (error) {
      logger.error('Symbol hierarchy analysis failed', error as Error);
      throw error;
    }
  }
};

/**
 * 検索対象ファイルを決定
 */
async function determineTargetFiles(
  workspaceRoot: string, 
  params: CodeGetSymbolHierarchyParams
): Promise<string[]> {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.swift'];
  
  if (params.file_path) {
    // 特定ファイル
    const absolutePath = path.isAbsolute(params.file_path)
      ? params.file_path
      : path.resolve(workspaceRoot, params.file_path);
    
    try {
      const fsService = FileSystemService.getInstance();
      await fsService.access(absolutePath);
      return [absolutePath];
    } catch {
      throw new Error(`File not found: ${params.file_path}`);
    }
  }

  // ディレクトリまたはワークスペース全体を検索
  const searchRoot = params.directory_path
    ? (path.isAbsolute(params.directory_path) 
        ? params.directory_path 
        : path.resolve(workspaceRoot, params.directory_path))
    : workspaceRoot;

  const files: string[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const fsService = FileSystemService.getInstance();
      const entries = await fsService.readdir(dir, { withFileTypes: true }) as import('fs').Dirent[];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 除外ディレクトリをスキップ
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'Pods', '.build'].includes(entry.name)) {
            await scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (supportedExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // ディレクトリアクセスエラーは無視
    }
  }

  await scanDirectory(searchRoot);
  return files;
}

/**
 * ファイルから言語を判定
 */
function getLanguageFromFile(filePath: string): 'typescript' | 'javascript' | 'swift' | 'unknown' {
  const ext = path.extname(filePath);
  
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.swift':
      return 'swift';
    default:
      return 'unknown';
  }
}

/**
 * ファイルのシンボル階層を取得
 */
async function getFileSymbolHierarchy(
  filePath: string,
  workspaceRoot: string,
  language: 'typescript' | 'javascript' | 'swift' | 'unknown',
  _params: CodeGetSymbolHierarchyParams,
  logger: Logger
): Promise<SymbolHierarchyNode[]> {
  const lspManager = LSPManager.getInstance();
  
  if (language === 'swift') {
    // Swift LSPを使用
    const lspName = `swift-${workspaceRoot}`;
    let lsp = lspManager.getClient(lspName) as SwiftLSP;
    
    if (!lsp) {
      const available = await SwiftLSP.isAvailable();
      if (!available) {
        throw new Error('Swift Language Server not available');
      }
      
      lsp = new SwiftLSP(workspaceRoot, logger);
      lspManager.registerClient(lspName, lsp);
      await lsp.connect();
    }
    
    // Swift LSPからファイルのドキュメントシンボルを取得
    try {
      // まずドキュメントシンボル取得を試行
      const symbols = await (lsp as any).getFileSymbols(filePath);
      logger.info(`Swift LSP: Retrieved ${symbols.length} symbols for file: ${filePath}`);
      
      if (symbols.length > 0) {
        return symbols.map((symbol: any) => ({
          name: symbol.name,
          kind: symbol.kind,
          kind_name: symbolKindToString(symbol.kind),
          file: path.relative(workspaceRoot, filePath),
          start_line: symbol.location?.range?.start?.line ?? symbol.position?.line ?? 0,
          start_column: symbol.location?.range?.start?.character ?? symbol.position?.character ?? 0,
          end_line: symbol.location?.range?.end?.line ?? symbol.range?.end?.line ?? 0,
          end_column: symbol.location?.range?.end?.character ?? symbol.range?.end?.character ?? 0,
          detail: symbol.detail,
          children: [],
          depth: 0
        }));
      }
      
      // ドキュメントシンボルが取得できない場合、searchSymbolsでフォールバック
      logger.warn(`Swift LSP: No document symbols found, trying workspace symbol search for file: ${filePath}`);
      
      // まず空のクエリで全シンボルを取得を試行
      let searchResults = await lsp.searchSymbols('', { maxResults: 1000 });
      
      // 結果が少ない場合、ファイル名でも検索
      if (searchResults.length < 5) {
        const fileName = path.basename(filePath, '.swift');
        const fileNameResults = await lsp.searchSymbols(fileName, { maxResults: 1000 });
        
        // 重複を避けて結合
        const existingNames = new Set(searchResults.map((s: any) => s.name));
        const newResults = fileNameResults.filter((s: any) => !existingNames.has(s.name));
        searchResults = [...searchResults, ...newResults];
      }
      
      // ファイルパスでフィルタリング
      const relativeFilePath = path.relative(workspaceRoot, filePath);
      const fileSymbols = searchResults.filter((symbol: any) => {
        // symbol.fileプロパティか、location.uriから相対パスを取得
        let symbolFile = symbol.file;
        if (!symbolFile && symbol.location?.uri) {
          symbolFile = path.relative(workspaceRoot, symbol.location.uri.replace('file://', ''));
        }
        return symbolFile === relativeFilePath;
      });
      
      logger.info(`Swift LSP: Found ${fileSymbols.length} symbols via fallback search for file: ${filePath} (from ${searchResults.length} total)`);
      
      return fileSymbols.map((symbol: any) => ({
        name: symbol.name,
        kind: symbol.kind,
        kind_name: symbolKindToString(symbol.kind),
        file: relativeFilePath,
        start_line: symbol.position?.line ?? symbol.location?.range?.start?.line ?? 0,
        start_column: symbol.position?.character ?? symbol.location?.range?.start?.character ?? 0,
        end_line: symbol.range?.end?.line ?? symbol.location?.range?.end?.line ?? 0,
        end_column: symbol.range?.end?.character ?? symbol.location?.range?.end?.character ?? 0,
        detail: symbol.detail,
        children: [],
        depth: 0
      }));
      
    } catch (error) {
      logger.warn(`Swift LSP: Failed to get symbols for ${filePath}`, { error });
      return [];
    }
  }
  
  if (language === 'typescript' || language === 'javascript') {
    // TypeScript LSPを使用
    const lspName = `typescript-${workspaceRoot}`;
    let lsp = lspManager.getClient(lspName) as TypeScriptLSP;
    
    if (!lsp) {
      const available = await TypeScriptLSP.isAvailable();
      if (!available) {
        throw new Error('TypeScript Language Server not available');
      }
      
      lsp = new TypeScriptLSP(workspaceRoot, logger);
      lspManager.registerClient(lspName, lsp);
      await lsp.connect();
    }
    
    // ファイルのシンボルを取得（SymbolInformation形式）
    const symbols = await (lsp as any).getFileSymbols(filePath);
    
    return symbols.map((symbol: any) => ({
      name: symbol.name,
      kind: symbol.kind,
      kind_name: symbolKindToString(symbol.kind),
      file: path.relative(workspaceRoot, filePath),
      start_line: symbol.location.range.start.line,
      start_column: symbol.location.range.start.character,
      end_line: symbol.location.range.end.line,
      end_column: symbol.location.range.end.character,
      detail: undefined,
      children: [],
      depth: 0
    }));
  }
  
  return [];
}


/**
 * シンボル総数を計算
 */
function countTotalSymbols(symbols: SymbolHierarchyNode[]): number {
  return symbols.reduce((count, symbol) => {
    return count + 1 + countTotalSymbols(symbol.children);
  }, 0);
}

/**
 * 最大深度を取得
 */
function getMaxDepth(symbols: SymbolHierarchyNode[]): number {
  if (symbols.length === 0) return 0;
  
  return Math.max(...symbols.map(symbol => {
    return Math.max(symbol.depth, getMaxDepth(symbol.children));
  }));
}