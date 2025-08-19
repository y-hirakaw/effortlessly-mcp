/**
 * code_find_references 機能実装  
 * TypeScript/Swift LSPを使用した参照検索
 */

import { z } from 'zod';
import path from 'path';
import { FileSystemService } from '../../services/FileSystemService.js';
import { WorkspaceManager } from '../project-management/workspace-manager.js';
import { LSPServerManager } from '../../services/LSPServerManager.js';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import { getOrCreateSwiftLSP } from './swift-lsp-helper.js';
import { TypeScriptLSPHelper } from '../../services/lsp/typescript-lsp-helper.js';

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
  description: '指定された位置のシンボルの参照（使用箇所）を検索します。TypeScript/Swift LSPを使用してセマンティック参照検索を提供します。',
  inputSchema: CodeFindReferencesParamsSchema,

  async execute(params: CodeFindReferencesParams): Promise<{
    error?: string;
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
      // LSPサーバー自動起動確認
      const lspServerManager = new LSPServerManager();
      if (!(await lspServerManager.isProxyRunning())) {
        logger.info('LSP proxy server not running, attempting to start...');
        try {
          const started = await lspServerManager.startLSPProxy(process.cwd());
          if (!started) {
            logger.warn('LSP proxy server failed to start, continuing without LSP support');
          }
        } catch (error) {
          logger.warn('LSP proxy server startup failed', { error });
        }
      }

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
      const fsService = FileSystemService.getInstance();
      try {
        await fsService.access(absoluteFilePath);
      } catch {
        throw new Error(`File not found: ${params.file_path}`);
      }

      // ファイル拡張子をチェックして対応するLSPを選択
      const fileExtension = path.extname(absoluteFilePath);
      
      let references: any[] = [];
      
      if (['.swift'].includes(fileExtension)) {
        // Swift LSPを使用（エラーハンドリング付き）
        logger.info('Using Swift LSP for reference search');
        try {
          const swiftLsp = await getOrCreateSwiftLSP(workspaceRoot, logger);
          
          // SwiftLSPで参照検索を実行
          references = await swiftLsp.searchReferences(
            absoluteFilePath,
            {
              line: params.line,
              character: params.column
            },
            params.include_declaration
          );
          logger.info(`Swift LSP found ${references.length} references`);
        } catch (lspError) {
          logger.warn('Swift LSP reference search failed, falling back to text search', { 
            error: lspError, 
            file: params.file_path,
            line: params.line,
            column: params.column 
          });
          
          // フォールバック: テキストベース検索
          references = await performTextBasedReferenceSearch(
            absoluteFilePath,
            params.line,
            params.column,
            workspaceRoot,
            logger
          );
        }
      } else if (['.ts', '.tsx', '.js', '.jsx'].includes(fileExtension)) {
        // TypeScript LSPを使用
        logger.info('Using TypeScript LSP for reference search');
        const helper = TypeScriptLSPHelper.getInstance();
        const lsp = await helper.getOrCreateTypeScriptLSP(workspaceRoot);
        
        // TypeScript LSPで参照検索を実行
        references = await lsp.searchReferences(
          absoluteFilePath,
          {
            line: params.line,
            character: params.column
          },
          params.include_declaration
        );
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}. This tool supports TypeScript, JavaScript, and Swift files.`);
      }

      // 結果を変換（contextの安全なハンドリングを追加）
      const results: CodeReferenceResult[] = references.map((ref, index) => {
        try {
          logger.debug(`Processing reference ${index}:`, {
            file: ref.file,
            position: ref.position,
            kind: ref.kind,
            context: typeof ref.context,
            contextValue: ref.context
          });
          
          return {
            file: path.relative(workspaceRoot, ref.file),
            line: ref.position?.line ?? 0,
            column: ref.position?.character ?? 0,
            kind: ref.kind || 'reference',
            context: (ref.context || '').toString().trim()
          };
        } catch (error) {
          logger.error(`Error processing reference ${index}: ${error instanceof Error ? error.message : String(error)}`, ref);
          return {
            file: path.relative(workspaceRoot, ref.file || ''),
            line: 0,
            column: 0,
            kind: 'reference',
            context: ''
          };
        }
      });

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

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logLSPOperation(
        'FIND_REFERENCES',
        `${params.line}:${params.column}`,
        absoluteFilePath,
        results.length
      );

      return {
        references: results,
        references_by_file: fileGroups,
        stats
      };

    } catch (error) {
      logger.error('Reference search failed', error as Error);
      
      // エラー詳細をレスポンスに含める
      return {
        error: error instanceof Error ? error.message : String(error),
        references: [],
        references_by_file: {},
        stats: {
          total_references: 0,
          files_with_references: 0,
          include_declaration: params.include_declaration,
          search_position: {
            file: params.file_path,
            line: params.line,
            column: params.column
          }
        }
      };
    }
  }
};
/**
 * テキストベース参照検索（フォールバック機能）
 */
async function performTextBasedReferenceSearch(
  targetFile: string,
  line: number,
  column: number,
  workspaceRoot: string,
  logger: Logger
): Promise<any[]> {
  try {
    const fsService = FileSystemService.getInstance();
    const buffer = await fsService.readFile(targetFile);
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    
    if (line >= lines.length) {
      logger.warn(`Line ${line} exceeds file length ${lines.length}`);
      return [];
    }
    
    const targetLine = lines[line];
    if (column >= targetLine.length) {
      logger.warn(`Column ${column} exceeds line length ${targetLine.length}`);
      return [];
    }
    
    // カーソル位置からシンボル名を抽出
    const symbolName = extractSymbolAtPosition(targetLine, column);
    if (!symbolName) {
      logger.warn('No symbol found at cursor position');
      return [];
    }
    
    logger.info(`Searching for references to symbol: "${symbolName}"`);
    
    // ワークスペース内でシンボルを検索
    const references: any[] = [];
    const searchPattern = new RegExp(`\\b${escapeRegExp(symbolName)}\\b`, 'g');
    
    // Swiftファイルを検索
    const swiftFiles = await findSwiftFiles(workspaceRoot, fsService);
    
    for (const filePath of swiftFiles) {
      try {
        const fileBuffer = await fsService.readFile(filePath);
        const fileContent = fileBuffer.toString('utf-8');
        const fileLines = fileContent.split('\n');
        
        for (let lineIndex = 0; lineIndex < fileLines.length; lineIndex++) {
          const fileLine = fileLines[lineIndex];
          let match;
          
          while ((match = searchPattern.exec(fileLine)) !== null) {
            references.push({
              file: filePath,
              position: {
                line: lineIndex,
                character: match.index
              },
              kind: 'reference',
              context: fileLine.trim()
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to search in file: ${filePath}`);
      }
    }
    
    logger.info(`Text-based search found ${references.length} references`);
    return references;
    
  } catch (error) {
    logger.error('Text-based reference search failed');
    return [];
  }
}

/**
 * カーソル位置からシンボル名を抽出
 */
function extractSymbolAtPosition(line: string, column: number): string | null {
  // Swift識別子の文字パターン
  const identifierPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  let match;
  
  while ((match = identifierPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    
    if (column >= start && column <= end) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * ワークスペース内のSwiftファイルを検索
 */
async function findSwiftFiles(workspaceRoot: string, fsService: FileSystemService): Promise<string[]> {
  const swiftFiles: string[] = [];
  
  async function searchDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fsService.readdir(dirPath);
      
      for (const entry of entries) {
        const entryName = typeof entry === 'string' ? entry : entry.name;
        const fullPath = path.join(dirPath, entryName);
        
        // .git, node_modules, .buildなどを除外
        if (entryName.startsWith('.') || entryName === 'node_modules' || entryName === 'Pods') {
          continue;
        }
        
        try {
          const stats = await fsService.stat(fullPath);
          
          if (stats.isDirectory()) {
            await searchDirectory(fullPath);
          } else if (entryName.endsWith('.swift')) {
            swiftFiles.push(fullPath);
          }
        } catch (error) {
          // アクセスできないファイル/ディレクトリはスキップ
        }
      }
    } catch (error) {
      // ディレクトリアクセスエラーはスキップ
    }
  }
  
  await searchDirectory(workspaceRoot);
  return swiftFiles;
}

/**
 * 正規表現エスケープ
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 注: getOrCreateTypeScriptLSP関数は削除されました。
// TypeScriptLSPHelperクラスのgetOrCreateTypeScriptLSPメソッドを使用してください。