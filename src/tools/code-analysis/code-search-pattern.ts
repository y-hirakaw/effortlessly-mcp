import { z } from 'zod';
import { FileSystemService } from '../../services/FileSystemService.js';
import * as path from 'path';
import { Logger } from '../../services/logger.js';
import { LogManager } from '../../utils/log-manager.js';
import type { MdcToolImplementation } from '../../types/mcp.js';

const logger = Logger.getInstance();

// 検索結果の型
interface CodeSearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  language?: string;
  size?: number;
  matches: CodeSearchMatch[];
}

// コード検索のマッチ情報
interface CodeSearchMatch {
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
  context_before: string[];
  context_after: string[];
  symbol_context?: SymbolContext;
}

// シンボルコンテキスト情報
interface SymbolContext {
  function_name?: string;
  class_name?: string;
  namespace?: string;
  symbol_type?: string;
}

// ツールのパラメータスキーマ
const CodeSearchPatternParams = z.object({
  pattern: z.string().describe('検索パターン（正規表現）'),
  file_types: z.array(z.string()).optional().describe('検索対象ファイル拡張子 (例: ["ts", "js", "py"])'),
  exclude_patterns: z.array(z.string()).optional().describe('除外パターン（glob形式、例: ["node_modules/*", "*.test.ts"]）'),
  workspace_path: z.string().optional().describe('検索範囲のワークスペースパス（未指定時は現在のワークスペース）'),
  max_results: z.number().default(100).describe('最大結果数'),
  context_lines: z.number().default(3).describe('マッチ箇所前後のコンテキスト行数'),
  case_sensitive: z.boolean().default(false).describe('大文字小文字を区別するかどうか'),
  whole_word: z.boolean().default(false).describe('単語全体のマッチングを行うかどうか'),
  include_symbol_context: z.boolean().default(true).describe('シンボルコンテキスト（関数名、クラス名等）を含めるかどうか'),
  search_mode: z.enum(['content', 'symbol', 'hybrid']).default('hybrid').describe('検索モード: content=内容のみ, symbol=シンボルのみ, hybrid=両方'),
  file_size_limit: z.number().default(5 * 1024 * 1024).describe('検索対象ファイルの最大サイズ（バイト）'),
});

export type CodeSearchPatternParams = z.infer<typeof CodeSearchPatternParams>;
export const CodeSearchPatternParamsSchema = CodeSearchPatternParams;

// ツールの結果スキーマ
const CodeSearchPatternResult = z.object({
  total_found: z.number().describe('見つかったファイル数'),
  total_matches: z.number().describe('見つかったマッチ数'),
  results: z.array(z.object({
    path: z.string().describe('ファイルの絶対パス'),
    name: z.string().describe('ファイル名'),
    type: z.enum(['file', 'directory']).describe('ファイルタイプ'),
    language: z.string().optional().describe('プログラミング言語'),
    size: z.number().optional().describe('ファイルサイズ'),
    matches: z.array(z.object({
      line_number: z.number().describe('マッチした行番号'),
      line_content: z.string().describe('マッチした行の内容'),
      match_start: z.number().describe('マッチ開始位置'),
      match_end: z.number().describe('マッチ終了位置'),
      context_before: z.array(z.string()).describe('マッチ箇所前のコンテキスト'),
      context_after: z.array(z.string()).describe('マッチ箇所後のコンテキスト'),
      symbol_context: z.object({
        function_name: z.string().optional().describe('所属する関数名'),
        class_name: z.string().optional().describe('所属するクラス名'),
        namespace: z.string().optional().describe('所属する名前空間'),
        symbol_type: z.string().optional().describe('シンボルタイプ'),
      }).optional().describe('シンボルコンテキスト情報'),
    })).describe('マッチ情報'),
  })).describe('検索結果'),
  search_info: z.object({
    pattern: z.string().describe('使用した検索パターン'),
    file_types: z.array(z.string()).optional().describe('検索対象ファイル拡張子'),
    exclude_patterns: z.array(z.string()).optional().describe('除外パターン'),
    workspace_path: z.string().describe('検索したワークスペースパス'),
    search_mode: z.string().describe('使用した検索モード'),
    files_scanned: z.number().describe('スキャンしたファイル数'),
    execution_time_ms: z.number().describe('実行時間（ミリ秒）'),
  }).describe('検索情報'),
});

type CodeSearchPatternResultType = z.infer<typeof CodeSearchPatternResult>;

/**
 * code_search_pattern ツールの実装
 * 柔軟なパターン検索機能を提供し、コードコンテキストを含む詳細な検索結果を返す
 */
export const codeSearchPatternTool: MdcToolImplementation<CodeSearchPatternParams, CodeSearchPatternResultType> = {
  name: 'code_search_pattern',
  description: 'プロジェクト内で柔軟なパターン検索を行い、コードコンテキストを含む詳細な結果を提供します',
  inputSchema: CodeSearchPatternParams as z.ZodSchema<CodeSearchPatternParams>,

  async execute(params: CodeSearchPatternParams): Promise<CodeSearchPatternResultType> {
    const startTime = Date.now();
    logger.info('code_search_pattern tool called', { params });

    try {
      // ワークスペースパスの決定
      const workspacePath = params.workspace_path || process.cwd();
      const resolvedWorkspacePath = path.resolve(workspacePath);
      
      logger.debug('Resolved workspace path', { workspacePath: resolvedWorkspacePath });

      // ワークスペースの存在確認
      try {
        const fsService = FileSystemService.getInstance();
        const stats = await fsService.stat(resolvedWorkspacePath);
        if (!stats.isDirectory()) {
          throw new Error(`指定されたワークスペースパスはディレクトリではありません: ${workspacePath}`);
        }
      } catch (error) {
        logger.error(`Workspace not found or not accessible: ${resolvedWorkspacePath}`);
        throw new Error(`ワークスペースが見つからないかアクセスできません: ${workspacePath}`);
      }

      // 検索コンテキスト
      const searchContext: SearchContext = {
        pattern: params.pattern,
        fileTypes: params.file_types,
        excludePatterns: params.exclude_patterns || [],
        maxResults: params.max_results,
        contextLines: params.context_lines,
        caseSensitive: params.case_sensitive,
        wholeWord: params.whole_word,
        includeSymbolContext: params.include_symbol_context,
        searchMode: params.search_mode,
        fileSizeLimit: params.file_size_limit,
        filesScanned: 0,
      };

      // 検索実行
      const results = await searchWorkspace(resolvedWorkspacePath, searchContext);
      
      // 結果を最大数で制限
      const limitedResults = results.slice(0, params.max_results);
      
      // 総マッチ数の計算
      const totalMatches = results.reduce((sum, result) => sum + result.matches.length, 0);

      const executionTime = Date.now() - startTime;

      logger.info('Code search completed successfully', {
        totalFound: results.length,
        totalMatches,
        limitedTo: limitedResults.length,
        filesScanned: searchContext.filesScanned,
        executionTimeMs: executionTime,
      });

      // 操作ログ記録
      const logManager = LogManager.getInstance();
      await logManager.logSearchOperation(
        'CODE_SEARCH_PATTERN',
        params.pattern,
        totalMatches,
        params.workspace_path || 'workspace'
      );

      return {
        total_found: results.length,
        total_matches: totalMatches,
        results: limitedResults,
        search_info: {
          pattern: params.pattern,
          file_types: params.file_types,
          exclude_patterns: params.exclude_patterns,
          workspace_path: resolvedWorkspacePath,
          search_mode: params.search_mode,
          files_scanned: searchContext.filesScanned,
          execution_time_ms: executionTime,
        },
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Error in code_search_pattern: ${error instanceof Error ? error.message : String(error)}`, {
        executionTimeMs: executionTime,
      } as any);
      throw new Error(`コード検索中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

// 検索コンテキスト
interface SearchContext {
  pattern: string;
  fileTypes?: string[];
  excludePatterns: string[];
  maxResults: number;
  contextLines: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  includeSymbolContext: boolean;
  searchMode: 'content' | 'symbol' | 'hybrid';
  fileSizeLimit: number;
  filesScanned: number;
}

/**
 * ワークスペース全体を検索
 */
async function searchWorkspace(
  workspacePath: string,
  context: SearchContext
): Promise<CodeSearchResult[]> {
  const results: CodeSearchResult[] = [];
  
  const files = await findFiles(workspacePath, context);
  
  for (const filePath of files) {
    if (results.length >= context.maxResults) {
      break;
    }
    
    const fileResult = await searchFile(filePath, context);
    if (fileResult && fileResult.matches.length > 0) {
      results.push(fileResult);
    }
  }
  
  return results;
}

/**
 * 検索対象ファイルを再帰的に検索
 */
async function findFiles(
  dirPath: string,
  context: SearchContext
): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const fsService = FileSystemService.getInstance();
    const entries = await fsService.readdir(dirPath, { withFileTypes: true }) as import('fs').Dirent[];
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // 除外パターンのチェック
      if (shouldExcludePath(fullPath, context.excludePatterns)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // 再帰的にディレクトリを検索
        const subFiles = await findFiles(fullPath, context);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // ファイルタイプのチェック
        if (isTargetFile(entry.name, context.fileTypes)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to read directory', { dirPath, error });
  }
  
  return files;
}

/**
 * 単一ファイルの検索
 */
async function searchFile(
  filePath: string,
  context: SearchContext
): Promise<CodeSearchResult | null> {
  context.filesScanned++;
  
  try {
    const fsService = FileSystemService.getInstance();
    const stats = await fsService.stat(filePath);
    
    // ファイルサイズのチェック
    if (stats.size > context.fileSizeLimit) {
      logger.debug('File too large for search', { filePath, size: stats.size });
      return null;
    }
    
    // バイナリファイルのスキップ
    if (await isBinaryFile(filePath)) {
      logger.debug('Skipping binary file', { filePath });
      return null;
    }
    
    const content = await fsService.readFile(filePath, { encoding: 'utf-8' }) as string;
    const lines = content.split('\n');
    
    // パターンマッチング
    const matches = await findMatches(lines, filePath, context);
    
    if (matches.length === 0) {
      return null;
    }
    
    const fileName = path.basename(filePath);
    const language = detectLanguage(fileName);
    
    return {
      path: filePath,
      name: fileName,
      type: 'file',
      language,
      size: stats.size,
      matches,
    };
    
  } catch (error) {
    logger.warn('Failed to search file', { filePath, error });
    return null;
  }
}

/**
 * ファイル内のマッチを検索
 */
async function findMatches(
  lines: string[],
  filePath: string,
  context: SearchContext
): Promise<CodeSearchMatch[]> {
  const matches: CodeSearchMatch[] = [];
  
  // 正規表現パターンの作成
  let pattern = context.pattern;
  if (context.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }
  
  const flags = context.caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(pattern, flags);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    
    regex.lastIndex = 0; // グローバル検索のリセット
    while ((match = regex.exec(line)) !== null) {
      // コンテキスト行の取得
      const contextBefore = getContextLines(lines, i, -context.contextLines, 0);
      const contextAfter = getContextLines(lines, i, 1, context.contextLines);
      
      // シンボルコンテキストの取得
      let symbolContext: SymbolContext | undefined;
      if (context.includeSymbolContext) {
        symbolContext = await getSymbolContext(lines, i, filePath);
      }
      
      matches.push({
        line_number: i + 1,
        line_content: line,
        match_start: match.index,
        match_end: match.index + match[0].length,
        context_before: contextBefore,
        context_after: contextAfter,
        symbol_context: symbolContext,
      });
      
      // 無限ループ防止
      if (match[0].length === 0) {
        break;
      }
    }
  }
  
  return matches;
}

/**
 * コンテキスト行の取得
 */
function getContextLines(
  lines: string[],
  currentLine: number,
  offset: number,
  count: number
): string[] {
  const contextLines: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const lineIndex = currentLine + offset + i;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      contextLines.push(lines[lineIndex]);
    }
  }
  
  return contextLines;
}

/**
 * シンボルコンテキストの取得（簡易実装）
 */
async function getSymbolContext(
  lines: string[],
  currentLine: number,
  _filePath: string
): Promise<SymbolContext | undefined> {
  // 現在の行から上に向かって関数やクラスの定義を探す
  const symbolContext: SymbolContext = {};
  
  // 関数定義のパターン（TypeScript/JavaScript向け）
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
  
  for (let i = currentLine; i >= 0; i--) {
    const line = lines[i].trim();
    
    // 関数定義の検索
    if (!symbolContext.function_name) {
      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          symbolContext.function_name = match[1];
          symbolContext.symbol_type = 'function';
          break;
        }
      }
    }
    
    // クラス定義の検索
    if (!symbolContext.class_name) {
      for (const pattern of classPatterns) {
        const match = line.match(pattern);
        if (match) {
          symbolContext.class_name = match[1];
          break;
        }
      }
    }
    
    // 両方見つかったら終了
    if (symbolContext.function_name && symbolContext.class_name) {
      break;
    }
  }
  
  return Object.keys(symbolContext).length > 0 ? symbolContext : undefined;
}

/**
 * 除外パターンのチェック
 */
function shouldExcludePath(filePath: string, excludePatterns: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);
  
  for (const pattern of excludePatterns) {
    // glob pattern を正規表現に変換
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
    return true; // ファイルタイプが指定されていない場合はすべて対象
  }
  
  const ext = path.extname(fileName).slice(1); // 拡張子から . を除去
  return fileTypes.includes(ext);
}

/**
 * プログラミング言語の検出
 */
function detectLanguage(fileName: string): string | undefined {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  
  const languageMap: Record<string, string> = {
    'ts': 'TypeScript',
    'tsx': 'TypeScript',
    'js': 'JavaScript',
    'jsx': 'JavaScript',
    'py': 'Python',
    'java': 'Java',
    'go': 'Go',
    'rs': 'Rust',
    'cpp': 'C++',
    'c': 'C',
    'h': 'C/C++',
    'hpp': 'C++',
    'cs': 'C#',
    'php': 'PHP',
    'rb': 'Ruby',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'scala': 'Scala',
    'sh': 'Shell',
    'bash': 'Bash',
    'zsh': 'Zsh',
    'yaml': 'YAML',
    'yml': 'YAML',
    'json': 'JSON',
    'xml': 'XML',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'md': 'Markdown',
  };
  
  return languageMap[ext];
}

/**
 * バイナリファイルかどうかの簡易チェック
 */
async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    // ファイルの最初の512バイトを読み取り
    const buffer = Buffer.alloc(512);
    const { promises: fs } = await import('fs');
    const fileHandle = await fs.open(filePath, 'r');
    const { bytesRead } = await fileHandle.read(buffer, 0, 512, 0);
    await fileHandle.close();
    
    // NULL文字が含まれているかチェック
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.warn('Failed to check if file is binary', { filePath, error });
    return true; // エラーの場合はバイナリとして扱う
  }
}