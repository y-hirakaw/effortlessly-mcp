/**
 * code_find_references 機能実装  
 * TypeScript LSPを使用した参照検索
 */

import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { TypeScriptLSP, LSPManager } from '../../services/lsp/index.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { Logger } from '../../services/logger.js';

/**
 * 参照検索パラメータスキーマ
 */
export const CodeFindReferencesParamsSchema = z.object({
  file_path: z.string().min(1).describe('ファイルパス'),
  line: z.number().min(0).describe('行番号（0から開始）'),
  column: z.number().min(0).describe('列番号（0から開始）'),
  include_declaration: z.boolean().optional().default(true).describe('宣言も含めるかどうか')
});

export type CodeFindReferencesParams = z.infer<typeof CodeFindReferencesParamsSchema>;

/**
 * 参照検索結果の型定義
 */
export interface CodeReferenceResult {
  /** ファイルパス */
  file: string;
  /** 行番号（0から開始） */
  line: number;
  /** 列番号（0から開始） */
  column: number;
  /** 参照の種類 */
  kind: 'definition' | 'declaration' | 'reference';
  /** 周辺のコードコンテキスト */
  context: string;
}

/**
 * code_find_references ツール実装
 */
export const codeFindReferencesTool = {
  name: 'code_find_references',
  description: '指定された位置のシンボルの参照（使用箇所）を検索します。TypeScript LSPを使用してセマンティック参照検索を提供します。',
  inputSchema: CodeFindReferencesParamsSchema,

  async execute(params: CodeFindReferencesParams): Promise<{
    references: CodeReferenceResult[];
    references_by_file: Record<string, CodeReferenceResult[]>;
    stats: {
      total_references: number;
      files_with_references: number;
      include_declaration: boolean;
      search_position: {
        file: string;
        line: number;
        column: number;
      };
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
      
      // ファイルパスを絶対パスに変換
      const absoluteFilePath = path.isAbsolute(params.file_path)
        ? params.file_path
        : path.resolve(workspaceRoot, params.file_path);

      logger.info(`Searching references in: ${absoluteFilePath} at ${params.line}:${params.column}`);

      // ファイルが存在することを確認
      try {
        await fs.access(absoluteFilePath);
      } catch {
        throw new Error(`File not found: ${params.file_path}`);
      }

      // TypeScript/JavaScriptファイルかどうかチェック
      const fileExtension = path.extname(absoluteFilePath);
      if (!['.ts', '.tsx', '.js', '.jsx'].includes(fileExtension)) {
        throw new Error(`Unsupported file type: ${fileExtension}. This tool supports TypeScript and JavaScript files only.`);
      }

      // TypeScript LSPを初期化
      const lsp = await getOrCreateTypeScriptLSP(workspaceRoot, logger);
      
      // 参照検索を実行
      const references = await lsp.searchReferences(
        absoluteFilePath,
        {
          line: params.line,
          character: params.column
        },
        params.include_declaration
      );

      // 結果を変換
      const results: CodeReferenceResult[] = references.map(ref => ({
        file: path.relative(workspaceRoot, ref.file),
        line: ref.position.line,
        column: ref.position.character,
        kind: ref.kind,
        context: ref.context.trim()
      }));

      // ファイル別に集計
      const fileGroups = results.reduce((acc, ref) => {
        if (!acc[ref.file]) {
          acc[ref.file] = [];
        }
        acc[ref.file].push(ref);
        return acc;
      }, {} as Record<string, CodeReferenceResult[]>);

      // 統計情報
      const stats = {
        total_references: results.length,
        files_with_references: Object.keys(fileGroups).length,
        include_declaration: params.include_declaration,
        search_position: {
          file: path.relative(workspaceRoot, absoluteFilePath),
          line: params.line,
          column: params.column
        }
      };

      logger.info(`Found ${results.length} references in ${Object.keys(fileGroups).length} files`);

      return {
        references: results,
        references_by_file: fileGroups,
        stats
      };

    } catch (error) {
      logger.error('Reference search failed', error as Error);
      throw error;
    }
  }
};

/**
 * TypeScript LSPインスタンスを取得または作成
 */
async function getOrCreateTypeScriptLSP(workspaceRoot: string, logger: Logger): Promise<TypeScriptLSP> {
  const lspManager = LSPManager.getInstance();
  const lspName = `typescript-${workspaceRoot}`;
  
  let lsp = lspManager.getClient(lspName) as TypeScriptLSP;
  
  if (!lsp) {
    // TypeScript LSPが利用可能かチェック
    const available = await TypeScriptLSP.isAvailable();
    if (!available) {
      throw new Error(
        'TypeScript Language Server not found. Please install it using: npm install -g typescript-language-server typescript'
      );
    }

    // 新しいLSPインスタンスを作成
    lsp = new TypeScriptLSP(workspaceRoot, logger);
    lspManager.registerClient(lspName, lsp);
    
    // 接続
    await lsp.connect();
    
    logger.info(`Connected to TypeScript LSP for workspace: ${workspaceRoot}`);
  }

  return lsp;
}