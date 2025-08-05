/**
 * code_find_symbol 機能実装
 * TypeScript LSPを使用したシンボル検索
 */

import { z } from 'zod';
import path from 'path';
import { execSync } from 'child_process';
import type { SymbolKind, SymbolInformation } from 'vscode-languageserver-protocol';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { Logger } from '../../services/logger.js';
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
  max_results: z.number().min(1).max(1000).optional().default(100).describe('最大結果数')
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
    
    // TypeScriptファイルでシンボルを検索するコマンド
    const searchPatterns = [
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
    
    const results: SymbolInformation[] = [];
    
    for (const pattern of searchPatterns) {
      try {
        // grep コマンドでパターン検索
        const grepCommand = `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -E "${pattern}" "${workspaceRoot}"`;
        const output = execSync(grepCommand, { encoding: 'utf8', timeout: 5000 }).toString();
        
        if (output.trim()) {
          const lines = output.trim().split('\n');
          logger.info(`Found ${lines.length} matches with pattern: ${pattern}`);
          
          for (const line of lines.slice(0, params.max_results || 10)) {
            const match = line.match(/^([^:]+):(\d+):(.+)$/);
            if (match) {
              const [, filePath, lineNumber, content] = match;
              
              // シンボルの種類を推測
              let symbolKind = 12; // Function as default
              if (content.includes('class')) symbolKind = 5; // Class
              else if (content.includes('interface')) symbolKind = 11; // Interface
              else if (content.includes('const') || content.includes('let') || content.includes('var')) symbolKind = 13; // Variable
              
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
        logger.debug(`Pattern search failed: ${pattern}`, { error: (error as Error).message });
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
      languages: ['typescript'],
      total: uniqueResults.length,
      symbols: uniqueResults
    };
    
  } catch (error) {
    logger.error('Text-based symbol search failed', error as Error);
    
    // 空の結果を返す
    return {
      query: symbolName,
      languages: ['typescript'],
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
  description: 'TypeScript/JavaScriptファイル内のシンボル（関数、クラス、変数など）を検索します。LSPサーバーを使用してセマンティック検索を提供します。',
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
      // アクティブなワークスペースを確認
      const workspaceManager = WorkspaceManager.getInstance();
      const workspace = await workspaceManager.getCurrentWorkspace();
      
      if (!workspace) {
        throw new Error('No active workspace. Please activate a workspace first using workspace_activate.');
      }

      const workspaceRoot = workspace.root_path;
      logger.info(`Searching symbols in workspace: ${workspaceRoot}`);

      // HTTP LSPクライアントを取得
      const httpLSPClient = getHttpLSPClient();
      
      // シンボル検索を実行
      let searchResponse;
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