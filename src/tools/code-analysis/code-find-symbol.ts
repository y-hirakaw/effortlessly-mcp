/**
 * code_find_symbol 機能実装
 * TypeScript LSPを使用したシンボル検索
 */

import { z } from 'zod';
import path from 'path';
import type { SymbolKind } from 'vscode-languageserver-protocol';
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
      const searchResponse = await httpLSPClient.searchSymbols(params.symbol_name, {
        languages: params.symbol_kind ? undefined : ['typescript'], // 種類指定がない場合はTypeScriptのみ
        maxResults: params.max_results
      });

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