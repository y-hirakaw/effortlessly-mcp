/**
 * code_get_symbols_overview 機能実装
 * ファイル・ディレクトリの包括的シンボル構造概要を提供
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
 * シンボル概要取得パラメータスキーマ
 */
export const CodeGetSymbolsOverviewParamsSchema = z.object({
  relative_path: z.string().describe('シンボル概要を取得する相対パス（ファイルまたはディレクトリ）'),
  max_files: z.number().min(1).max(500).optional().default(50).describe('最大処理ファイル数（LLMトークン制限対策: Claude=50推奨, Gemini=200可能）'),
  include_private: z.boolean().optional().default(false).describe('プライベートシンボルも含めるか'),
  include_test_files: z.boolean().optional().default(true).describe('テストファイルも含めるか'),
  symbol_kinds: z.array(z.number()).optional().describe('含めるシンボル種類の配列（SymbolKind）'),
  depth: z.number().min(0).max(3).optional().default(1).describe('ネストされたシンボルの深度（0=トップレベルのみ）')
});

export type CodeGetSymbolsOverviewParams = z.infer<typeof CodeGetSymbolsOverviewParamsSchema>;

/**
 * シンボル概要情報
 */
export interface SymbolOverview {
  /** シンボル名 */
  name: string;
  /** シンボルの種類 */
  kind: SymbolKind;
  /** シンボル種類の説明 */
  kind_name: string;
  /** 開始行番号（0から開始） */
  start_line: number;
  /** シンボルの詳細情報 */
  detail?: string;
  /** 子シンボル（depth > 0の場合） */
  children?: SymbolOverview[];
}

/**
 * ファイル別シンボル概要
 */
export interface FileSymbolsOverview {
  /** ファイルパス（相対パス） */
  relative_path: string;
  /** 言語タイプ */
  language: 'typescript' | 'javascript' | 'swift' | 'unknown';
  /** ファイルサイズ（バイト） */
  file_size: number;
  /** 行数 */
  line_count: number;
  /** トップレベルシンボル */
  symbols: SymbolOverview[];
  /** シンボル種類別の統計 */
  symbol_stats: Record<string, number>;
}

/**
 * code_get_symbols_overview ツール実装
 */
export const codeGetSymbolsOverviewTool = {
  name: 'code_get_symbols_overview',
  description: 'ファイルやディレクトリの包括的なシンボル構造概要を取得します。各ファイルのトップレベルシンボル（クラス、関数、インターフェース等）の一覧とプロジェクト構造の理解に適しています。',
  inputSchema: CodeGetSymbolsOverviewParamsSchema,

  async execute(params: CodeGetSymbolsOverviewParams): Promise<{
    files: FileSymbolsOverview[];
    summary: {
      total_files: number;
      total_symbols: number;
      total_lines: number;
      languages: string[];
      symbol_distribution: Record<string, number>;
      largest_files: Array<{ file: string; symbols: number; lines: number }>;
      search_path: string;
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
      const targetPath = path.resolve(workspaceRoot, params.relative_path);
      
      // パスの存在確認
      try {
        const fsService = FileSystemService.getInstance();
        await fsService.access(targetPath);
      } catch {
        throw new Error(`Path not found: ${params.relative_path}`);
      }

      // 対象ファイルを決定
      const targetFiles = await determineTargetFiles(targetPath, workspaceRoot, params);
      
      if (targetFiles.length === 0) {
        return {
          files: [],
          summary: {
            total_files: 0,
            total_symbols: 0,
            total_lines: 0,
            languages: [],
            symbol_distribution: {},
            largest_files: [],
            search_path: params.relative_path
          }
        };
      }

      logger.info(`Analyzing symbols overview for ${targetFiles.length} files in ${params.relative_path}`);

      const files: FileSymbolsOverview[] = [];
      const languageStats = new Set<string>();
      const symbolDistribution: Record<string, number> = {};
      let totalSymbols = 0;
      let totalLines = 0;

      // 各ファイルを並列処理（バッチサイズで制限）
      const batchSize = 10;
      for (let i = 0; i < targetFiles.length; i += batchSize) {
        const batch = targetFiles.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (filePath) => {
          try {
            const language = getLanguageFromFile(filePath);
            languageStats.add(language);
            
            const fileOverview = await getFileSymbolsOverview(
              filePath, 
              workspaceRoot, 
              language, 
              params, 
              logger
            );
            
            // 統計情報を更新
            totalSymbols += fileOverview.symbols.length;
            totalLines += fileOverview.line_count;
            
            // シンボル種類別統計を集計
            for (const [kindName, count] of Object.entries(fileOverview.symbol_stats)) {
              symbolDistribution[kindName] = (symbolDistribution[kindName] || 0) + count;
            }
            
            return fileOverview;
          } catch (error) {
            logger.warn(`Failed to analyze file ${filePath}:`, { error: (error as Error).message });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // 成功した結果のみを収集
        for (const result of batchResults) {
          if (result) {
            files.push(result);
          }
        }
      }

      // ファイルサイズでソート（大きいファイル順）
      const largestFiles = files
        .sort((a, b) => b.symbols.length - a.symbols.length)
        .slice(0, 5)
        .map(f => ({
          file: f.relative_path,
          symbols: f.symbols.length,
          lines: f.line_count
        }));

      const summary = {
        total_files: files.length,
        total_symbols: totalSymbols,
        total_lines: totalLines,
        languages: Array.from(languageStats),
        symbol_distribution: symbolDistribution,
        largest_files: largestFiles,
        search_path: params.relative_path
      };

      logger.info(`Symbols overview completed: ${files.length} files, ${totalSymbols} symbols`);

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logLSPOperation(
        'GET_SYMBOLS_OVERVIEW',
        params.relative_path,
        undefined,
        totalSymbols
      );

      return {
        files: files.sort((a, b) => a.relative_path.localeCompare(b.relative_path)),
        summary
      };

    } catch (error) {
      logger.error('Symbols overview analysis failed', error as Error);
      throw error;
    }
  }
};

/**
 * 対象ファイルを決定
 */
async function determineTargetFiles(
  targetPath: string,
  _workspaceRoot: string,
  params: CodeGetSymbolsOverviewParams
): Promise<string[]> {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.swift'];
  const testPatterns = ['.test.', '.spec.', '__test__', '__tests__'];
  
  const fsService = FileSystemService.getInstance();
  const stat = await fsService.stat(targetPath);
  
  if (stat.isFile()) {
    // 単一ファイル
    const ext = path.extname(targetPath);
    if (supportedExtensions.includes(ext)) {
      const isTestFile = testPatterns.some(pattern => targetPath.includes(pattern));
      if (!isTestFile || params.include_test_files) {
        return [targetPath];
      }
    }
    return [];
  }

  // ディレクトリの場合
  const files: string[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const fsService = FileSystemService.getInstance();
      const entries = await fsService.readdir(dir, { withFileTypes: true }) as import('fs').Dirent[];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 除外ディレクトリをスキップ
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'Pods', '.build', 'DerivedData'].includes(entry.name)) {
            await scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (supportedExtensions.includes(ext)) {
            // テストファイルのチェック
            const isTestFile = testPatterns.some(pattern => entry.name.includes(pattern));
            if (!isTestFile || params.include_test_files) {
              files.push(fullPath);
              
              // 最大ファイル数制限
              if (files.length >= params.max_files) {
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      // ディレクトリアクセスエラーは無視
    }
  }

  await scanDirectory(targetPath);
  return files.slice(0, params.max_files);
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
 * ファイルのシンボル概要を取得
 */
async function getFileSymbolsOverview(
  filePath: string,
  workspaceRoot: string,
  language: 'typescript' | 'javascript' | 'swift' | 'unknown',
  params: CodeGetSymbolsOverviewParams,
  logger: Logger
): Promise<FileSymbolsOverview> {
  const relativePath = path.relative(workspaceRoot, filePath);
  
  // ファイル情報を取得
  const fsService = FileSystemService.getInstance();
  const fileContent = await fsService.readFile(filePath, { encoding: 'utf-8' }) as string;
  const lineCount = fileContent.split('\n').length;
  const fileSize = Buffer.byteLength(fileContent, 'utf-8');
  
  // シンボルを取得
  const symbols = await getFileSymbols(filePath, workspaceRoot, language, params, logger);
  
  // シンボル種類別統計を計算
  const symbolStats: Record<string, number> = {};
  
  function countSymbols(symbolList: SymbolOverview[]): void {
    for (const symbol of symbolList) {
      const kindName = symbol.kind_name;
      symbolStats[kindName] = (symbolStats[kindName] || 0) + 1;
      
      if (symbol.children && params.depth > 0) {
        countSymbols(symbol.children);
      }
    }
  }
  
  countSymbols(symbols);
  
  return {
    relative_path: relativePath,
    language,
    file_size: fileSize,
    line_count: lineCount,
    symbols,
    symbol_stats: symbolStats
  };
}

/**
 * ファイルのシンボルを取得
 */
async function getFileSymbols(
  filePath: string,
  workspaceRoot: string,
  language: 'typescript' | 'javascript' | 'swift' | 'unknown',
  _params: CodeGetSymbolsOverviewParams,
  logger: Logger
): Promise<SymbolOverview[]> {
  if (language === 'unknown') {
    return [];
  }

  const lspManager = LSPManager.getInstance();
  
  try {
    if (language === 'swift') {
      // Swift LSPを使用
      const lspName = `swift-${workspaceRoot}`;
      let lsp = lspManager.getClient(lspName) as SwiftLSP;
      
      if (!lsp) {
        const available = await SwiftLSP.isAvailable();
        if (!available) {
          logger.warn('Swift Language Server not available');
          return [];
        }
        
        lsp = new SwiftLSP(workspaceRoot, logger);
        lspManager.registerClient(lspName, lsp);
        await lsp.connect();
      }
      
      // Swift LSPからシンボルを取得
      const symbols = await lsp.searchSymbols('', { maxResults: 1000 });
      const relativePath = path.relative(workspaceRoot, filePath);
      const fileSymbols = symbols.filter(s => s.file === relativePath);
      
      return fileSymbols.map(symbol => ({
        name: symbol.name,
        kind: symbol.kind,
        kind_name: symbolKindToString(symbol.kind),
        start_line: symbol.position.line,
        detail: symbol.detail
      }));
    }
    
    if (language === 'typescript' || language === 'javascript') {
      // TypeScript LSPを使用
      const lspName = `typescript-${workspaceRoot}`;
      let lsp = lspManager.getClient(lspName) as TypeScriptLSP;
      
      if (!lsp) {
        const available = await TypeScriptLSP.isAvailable();
        if (!available) {
          logger.warn('TypeScript Language Server not available');
          return [];
        }
        
        lsp = new TypeScriptLSP(workspaceRoot, logger);
        lspManager.registerClient(lspName, lsp);
        await lsp.connect();
      }
      
      // ファイルのシンボルを取得
      const symbols = await (lsp as any).getFileSymbols(filePath);
      
      return symbols.map((symbol: any) => ({
        name: symbol.name,
        kind: symbol.kind,
        kind_name: symbolKindToString(symbol.kind),
        start_line: symbol.location.range.start.line,
        detail: symbol.detail
      }));
    }
    
  } catch (error) {
    logger.warn(`Failed to get symbols for ${filePath}:`, { error: (error as Error).message });
  }
  
  return [];
}