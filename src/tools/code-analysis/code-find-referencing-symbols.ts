import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../../services/logger.js';
import type { MdcToolImplementation } from '../../types/mcp.js';
// import { HttpLSPClient } from '../../services/lsp-proxy/http-lsp-client.js';

const logger = Logger.getInstance();

// 参照元シンボル情報
interface ReferencingSymbolInfo {
  name: string;
  kind: number;
  path: string;
  line: number;
  column: number;
  symbol_type: string;
  context: SymbolContext;
  code_snippet?: string;
  references: SymbolReference[];
}

// シンボルコンテキスト
interface SymbolContext {
  namespace?: string;
  class_name?: string;
  function_name?: string;
  module_path: string;
  containing_symbol?: string;
}

// シンボル参照情報
interface SymbolReference {
  file_path: string;
  line: number;
  column: number;
  line_content: string;
  reference_type: 'definition' | 'reference' | 'implementation';
}

// ツールのパラメータスキーマ
const CodeFindReferencingSymbolsParams = z.object({
  target_symbol: z.string().describe('検索対象のシンボル名'),
  symbol_kinds: z.array(z.number()).optional().describe('検索対象のシンボル種類（LSP SymbolKind番号の配列）'),
  workspace_path: z.string().optional().describe('検索範囲のワークスペースパス（未指定時は現在のワークスペース）'),
  include_body: z.boolean().default(false).describe('シンボルの本体コードを含めるかどうか'),
  max_results: z.number().default(50).describe('最大結果数'),
  file_types: z.array(z.string()).optional().describe('検索対象ファイル拡張子（例: ["ts", "js"]）'),
  exclude_patterns: z.array(z.string()).optional().describe('除外パターン（glob形式）'),
  include_declarations: z.boolean().default(true).describe('宣言も含めるかどうか'),
  context_lines: z.number().default(3).describe('コードスニペット前後のコンテキスト行数'),
});

export type CodeFindReferencingSymbolsParams = z.infer<typeof CodeFindReferencingSymbolsParams>;
export const CodeFindReferencingSymbolsParamsSchema = CodeFindReferencingSymbolsParams;

// ツールの結果スキーマ
const CodeFindReferencingSymbolsResult = z.object({
  target_symbol: z.string().describe('検索対象のシンボル名'),
  total_found: z.number().describe('見つかった参照元シンボル数'),
  total_references: z.number().describe('見つかった参照の総数'),
  results: z.array(z.object({
    name: z.string().describe('参照元シンボル名'),
    kind: z.number().describe('シンボル種類（LSP SymbolKind）'),
    path: z.string().describe('ファイルパス'),
    line: z.number().describe('行番号'),
    column: z.number().describe('列番号'),
    symbol_type: z.string().describe('シンボルタイプ名'),
    context: z.object({
      namespace: z.string().optional().describe('名前空間'),
      class_name: z.string().optional().describe('クラス名'),
      function_name: z.string().optional().describe('関数名'),
      module_path: z.string().describe('モジュールパス'),
      containing_symbol: z.string().optional().describe('包含シンボル'),
    }).describe('シンボルコンテキスト'),
    code_snippet: z.string().optional().describe('コードスニペット'),
    references: z.array(z.object({
      file_path: z.string().describe('参照箇所のファイルパス'),
      line: z.number().describe('参照箇所の行番号'),
      column: z.number().describe('参照箇所の列番号'),
      line_content: z.string().describe('参照箇所の行内容'),
      reference_type: z.enum(['definition', 'reference', 'implementation']).describe('参照タイプ'),
    })).describe('このシンボルからターゲットシンボルへの参照リスト'),
  })).describe('参照元シンボル一覧'),
  search_info: z.object({
    target_symbol: z.string().describe('検索対象シンボル'),
    symbol_kinds: z.array(z.number()).optional().describe('検索対象シンボル種類'),
    workspace_path: z.string().describe('検索したワークスペースパス'),
    file_types: z.array(z.string()).optional().describe('検索対象ファイル拡張子'),
    exclude_patterns: z.array(z.string()).optional().describe('除外パターン'),
    files_scanned: z.number().describe('スキャンしたファイル数'),
    execution_time_ms: z.number().describe('実行時間（ミリ秒）'),
  }).describe('検索情報'),
});

type CodeFindReferencingSymbolsResultType = z.infer<typeof CodeFindReferencingSymbolsResult>;

/**
 * code_find_referencing_symbols ツールの実装
 * 指定されたシンボルを参照しているすべてのシンボルを検索する
 */
export const codeFindReferencingSymbolsTool: MdcToolImplementation<CodeFindReferencingSymbolsParams, CodeFindReferencingSymbolsResultType> = {
  name: 'code_find_referencing_symbols',
  description: '指定されたシンボルを参照しているすべてのシンボルを検索し、詳細なコンテキスト情報を提供します',
  inputSchema: CodeFindReferencingSymbolsParams as z.ZodSchema<CodeFindReferencingSymbolsParams>,

  async execute(params: CodeFindReferencingSymbolsParams): Promise<CodeFindReferencingSymbolsResultType> {
    const startTime = Date.now();
    logger.info('code_find_referencing_symbols tool called', { params });

    try {
      // ワークスペースパスの決定
      const workspacePath = params.workspace_path || process.cwd();
      const resolvedWorkspacePath = path.resolve(workspacePath);
      
      logger.debug('Resolved workspace path', { workspacePath: resolvedWorkspacePath });

      // ワークスペースの存在確認
      try {
        const stats = await fs.stat(resolvedWorkspacePath);
        if (!stats.isDirectory()) {
          throw new Error(`指定されたワークスペースパスはディレクトリではありません: ${workspacePath}`);
        }
      } catch (error) {
        logger.error(`Workspace not found or not accessible: ${resolvedWorkspacePath}`);
        throw new Error(`ワークスペースが見つからないかアクセスできません: ${workspacePath}`);
      }

      // 検索コンテキスト
      const searchContext: SearchContext = {
        targetSymbol: params.target_symbol,
        symbolKinds: params.symbol_kinds,
        includeBody: params.include_body,
        maxResults: params.max_results,
        fileTypes: params.file_types,
        excludePatterns: params.exclude_patterns || [],
        includeDeclarations: params.include_declarations,
        contextLines: params.context_lines,
        workspacePath: resolvedWorkspacePath,
        filesScanned: 0,
      };

      // 検索実行
      const results = await searchReferencingSymbols(searchContext);
      
      // 結果を最大数で制限
      const limitedResults = results.slice(0, params.max_results);
      
      // 総参照数の計算
      const totalReferences = results.reduce((sum, result) => sum + result.references.length, 0);

      const executionTime = Date.now() - startTime;

      logger.info('Referencing symbols search completed successfully', {
        targetSymbol: params.target_symbol,
        totalFound: results.length,
        totalReferences,
        limitedTo: limitedResults.length,
        filesScanned: searchContext.filesScanned,
        executionTimeMs: executionTime,
      });

      return {
        target_symbol: params.target_symbol,
        total_found: results.length,
        total_references: totalReferences,
        results: limitedResults,
        search_info: {
          target_symbol: params.target_symbol,
          symbol_kinds: params.symbol_kinds,
          workspace_path: resolvedWorkspacePath,
          file_types: params.file_types,
          exclude_patterns: params.exclude_patterns,
          files_scanned: searchContext.filesScanned,
          execution_time_ms: executionTime,
        },
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Error in code_find_referencing_symbols: ${error instanceof Error ? error.message : String(error)}`, {
        executionTimeMs: executionTime,
      } as any);
      throw new Error(`参照元シンボル検索中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

// 検索コンテキスト
interface SearchContext {
  targetSymbol: string;
  symbolKinds?: number[];
  includeBody: boolean;
  maxResults: number;
  fileTypes?: string[];
  excludePatterns: string[];
  includeDeclarations: boolean;
  contextLines: number;
  workspacePath: string;
  filesScanned: number;
}

/**
 * 参照元シンボルを検索
 */
async function searchReferencingSymbols(context: SearchContext): Promise<ReferencingSymbolInfo[]> {
  const results: ReferencingSymbolInfo[] = [];
  
  try {
    // ワークスペース内のファイルを取得
    const files = await findTargetFiles(context.workspacePath, context);
    
    // 各ファイルで検索
    for (const filePath of files) {
      if (results.length >= context.maxResults) {
        break;
      }
      
      const fileResults = await searchFileForReferencingSymbols(filePath, context);
      results.push(...fileResults);
      context.filesScanned++;
    }
    
    // LSP統合検索（利用可能な場合）
    try {
      const lspResults = await searchWithLSP(context);
      
      // LSP結果を既存結果とマージ（重複を除去）
      for (const lspResult of lspResults) {
        const existing = results.find(r => 
          r.path === lspResult.path && 
          r.line === lspResult.line && 
          r.column === lspResult.column
        );
        
        if (!existing) {
          results.push(lspResult);
        } else {
          // 既存結果にLSP情報を統合
          existing.references.push(...lspResult.references);
        }
      }
    } catch (lspError) {
      logger.warn('LSP search failed, using text-based search only', { error: lspError });
    }
    
  } catch (error) {
    logger.error(`Error during referencing symbols search: ${(error as Error).message}`);
    throw error;
  }
  
  return results.slice(0, context.maxResults);
}

/**
 * 検索対象ファイルを取得
 */
async function findTargetFiles(workspacePath: string, context: SearchContext): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(workspacePath, entry.name);
      
      // 除外パターンのチェック
      if (shouldExcludePath(fullPath, context.excludePatterns)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // 再帰的にディレクトリを検索
        const subFiles = await findTargetFiles(fullPath, context);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // ファイルタイプのチェック
        if (isTargetFile(entry.name, context.fileTypes)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to read directory', { workspacePath, error });
  }
  
  return files;
}

/**
 * 単一ファイルで参照元シンボルを検索
 */
async function searchFileForReferencingSymbols(
  filePath: string,
  context: SearchContext
): Promise<ReferencingSymbolInfo[]> {
  const results: ReferencingSymbolInfo[] = [];
  
  try {
    // バイナリファイルのスキップ
    if (await isBinaryFile(filePath)) {
      return results;
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // ターゲットシンボルを参照している行を検索
    const referenceLines = findReferenceLines(lines, context.targetSymbol);
    
    if (referenceLines.length === 0) {
      return results;
    }
    
    // 各参照行の周辺にあるシンボル定義を検索
    for (const refLine of referenceLines) {
      const containingSymbol = await findContainingSymbol(lines, refLine.lineNumber, filePath);
      
      if (containingSymbol) {
        // シンボル種類のフィルタリング
        if (context.symbolKinds && !context.symbolKinds.includes(containingSymbol.kind)) {
          continue;
        }
        
        const references: SymbolReference[] = [{
          file_path: filePath,
          line: refLine.lineNumber + 1,
          column: refLine.column,
          line_content: refLine.content,
          reference_type: 'reference',
        }];
        
        // コードスニペットの取得
        let codeSnippet: string | undefined;
        if (context.includeBody) {
          codeSnippet = getCodeSnippet(lines, containingSymbol.line, context.contextLines);
        }
        
        results.push({
          name: containingSymbol.name,
          kind: containingSymbol.kind,
          path: filePath,
          line: containingSymbol.line + 1,
          column: containingSymbol.column,
          symbol_type: getSymbolTypeName(containingSymbol.kind),
          context: {
            module_path: filePath,
            containing_symbol: containingSymbol.containerName,
          },
          code_snippet: codeSnippet,
          references,
        });
      }
    }
    
  } catch (error) {
    logger.warn('Failed to search file for referencing symbols', { filePath, error });
  }
  
  return results;
}

/**
 * LSPを使用した検索
 */
async function searchWithLSP(_context: SearchContext): Promise<ReferencingSymbolInfo[]> {
  // LSP統合は現在未実装のため、空の結果を返す
  logger.info('LSP search not implemented, skipping');
  return [];
}

// ユーティリティ関数群

interface ReferenceLine {
  lineNumber: number;
  column: number;
  content: string;
}

interface ContainingSymbol {
  name: string;
  kind: number;
  line: number;
  column: number;
  containerName?: string;
}

/**
 * ターゲットシンボルを参照している行を検索
 */
function findReferenceLines(lines: string[], targetSymbol: string): ReferenceLine[] {
  const results: ReferenceLine[] = [];
  const regex = new RegExp(`\\b${targetSymbol}\\b`, 'g');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    
    regex.lastIndex = 0;
    while ((match = regex.exec(line)) !== null) {
      results.push({
        lineNumber: i,
        column: match.index,
        content: line,
      });
    }
  }
  
  return results;
}

/**
 * 指定行を含むシンボルを検索
 */
async function findContainingSymbol(
  lines: string[],
  lineNumber: number,
  _filePath: string
): Promise<ContainingSymbol | null> {
  // 現在行から上に向かってシンボル定義を検索
  for (let i = lineNumber; i >= 0; i--) {
    const line = lines[i].trim();
    
    // 関数定義のパターン
    const functionPatterns = [
      /(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*[=:]?\s*(?:\([^)]*\)|\([^)]*\)\s*=>)/,
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/,
      /(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\([^)]*\)/,
    ];
    
    // クラス定義のパターン
    const classPatterns = [
      /(?:class|interface|type)\s+(\w+)/,
      /(?:export\s+)?(?:class|interface|type)\s+(\w+)/,
    ];
    
    // 関数定義のチェック
    for (const pattern of functionPatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          name: match[1],
          kind: 12, // LSP SymbolKind.Function
          line: i,
          column: line.indexOf(match[1]),
        };
      }
    }
    
    // クラス定義のチェック
    for (const pattern of classPatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          name: match[1],
          kind: 5, // LSP SymbolKind.Class
          line: i,
          column: line.indexOf(match[1]),
        };
      }
    }
  }
  
  return null;
}

/**
 * 指定位置にあるシンボルを検索（LSP用）
 * 現在未使用のため無効化
 */
/*
async function findSymbolAtPosition(
  filePath: string,
  line: number,
  character: number
): Promise<ContainingSymbol | null> {
  // 簡易実装：実際のプロジェクトではLSPのdocumentSymbolsを使用
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    return await findContainingSymbol(lines, line, filePath);
  } catch (error) {
    logger.warn('Failed to find symbol at position', { filePath, line, character, error });
    return null;
  }
}
*/

/**
 * コードスニペットの取得
 */
function getCodeSnippet(lines: string[], startLine: number, contextLines: number): string {
  const start = Math.max(0, startLine - contextLines);
  const end = Math.min(lines.length, startLine + contextLines + 1);
  
  return lines.slice(start, end).join('\n');
}

/**
 * シンボル種類名の取得
 */
function getSymbolTypeName(kind: number): string {
  const symbolKindNames: Record<number, string> = {
    1: 'File',
    2: 'Module',
    3: 'Namespace',
    4: 'Package',
    5: 'Class',
    6: 'Method',
    7: 'Property',
    8: 'Field',
    9: 'Constructor',
    10: 'Enum',
    11: 'Interface',
    12: 'Function',
    13: 'Variable',
    14: 'Constant',
    15: 'String',
    16: 'Number',
    17: 'Boolean',
    18: 'Array',
    19: 'Object',
    20: 'Key',
    21: 'Null',
    22: 'EnumMember',
    23: 'Struct',
    24: 'Event',
    25: 'Operator',
    26: 'TypeParameter',
  };
  
  return symbolKindNames[kind] || 'Unknown';
}

/**
 * 除外パターンのチェック
 */
function shouldExcludePath(filePath: string, excludePatterns: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);
  
  for (const pattern of excludePatterns) {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(regexPattern);
    if (regex.test(relativePath) || regex.test(path.basename(filePath))) {
      return true;
    }
  }
  
  return false;
}

/**
 * 対象ファイルかどうかのチェック
 */
function isTargetFile(fileName: string, fileTypes?: string[]): boolean {
  if (!fileTypes || fileTypes.length === 0) {
    return true;
  }
  
  const ext = path.extname(fileName).slice(1);
  return fileTypes.includes(ext);
}

/**
 * バイナリファイルかどうかの簡易チェック
 */
async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    const buffer = Buffer.alloc(512);
    const fileHandle = await fs.open(filePath, 'r');
    const { bytesRead } = await fileHandle.read(buffer, 0, 512, 0);
    await fileHandle.close();
    
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.warn('Failed to check if file is binary', { filePath, error });
    return true;
  }
}