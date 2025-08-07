import { z } from 'zod';
import * as path from 'path';
import { Logger } from '../../services/logger.js';
import { FileSystemService } from '../../services/FileSystemService.js';
import type { MdcToolImplementation } from '../../types/mcp.js';

const logger = Logger.getInstance();

// 検索結果の型
interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  matches?: SearchMatch[];
}

// テキスト検索のマッチ情報
interface SearchMatch {
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

// ツールのパラメータスキーマ
const SearchFilesParams = z.object({
  directory: z.string().describe('検索対象のディレクトリパス'),
  file_pattern: z.string().optional().describe('ファイル名パターン（glob形式、例: *.ts, test*.js）'),
  content_pattern: z.string().optional().describe('ファイル内容の検索パターン（正規表現）'),
  recursive: z.boolean().default(true).describe('再帰的に検索するかどうか'),
  case_sensitive: z.boolean().default(false).describe('大文字小文字を区別するかどうか'),
  max_depth: z.number().optional().describe('最大検索深度（recursiveがtrueの場合のみ有効）'),
  max_results: z.number().default(100).describe('最大結果数'),
  include_content: z.boolean().default(false).describe('マッチした行の内容を含めるかどうか'),
  file_size_limit: z.number().default(10 * 1024 * 1024).describe('テキスト検索対象ファイルの最大サイズ（バイト）'),
});

type SearchFilesParamsType = z.infer<typeof SearchFilesParams>;

// ツールの結果スキーマ
const SearchFilesResult = z.object({
  total_found: z.number().describe('見つかったファイル数'),
  results: z.array(z.object({
    path: z.string().describe('ファイルの絶対パス'),
    name: z.string().describe('ファイル名'),
    type: z.enum(['file', 'directory']).describe('ファイルタイプ'),
    size: z.number().optional().describe('ファイルサイズ（ディレクトリの場合は未定義）'),
    matches: z.array(z.object({
      line_number: z.number().describe('マッチした行番号'),
      line_content: z.string().describe('マッチした行の内容'),
      match_start: z.number().describe('マッチ開始位置'),
      match_end: z.number().describe('マッチ終了位置'),
    })).optional().describe('テキスト検索のマッチ情報'),
  })).describe('検索結果'),
  search_info: z.object({
    directory: z.string().describe('検索したディレクトリ'),
    file_pattern: z.string().optional().describe('使用したファイルパターン'),
    content_pattern: z.string().optional().describe('使用したコンテンツパターン'),
    recursive: z.boolean().describe('再帰検索したかどうか'),
    max_depth: z.number().optional().describe('最大深度'),
    files_scanned: z.number().describe('スキャンしたファイル数'),
    directories_scanned: z.number().describe('スキャンしたディレクトリ数'),
  }).describe('検索情報'),
});

type SearchFilesResultType = z.infer<typeof SearchFilesResult>;

/**
 * search_files ツールの実装
 * 指定されたディレクトリでファイル名やファイル内容を検索する
 */
export const searchFilesTool: MdcToolImplementation<SearchFilesParamsType, SearchFilesResultType> = {
  name: 'search_files',
  description: '指定されたディレクトリでファイル名パターンやファイル内容のテキスト検索を行います',
  inputSchema: SearchFilesParams as z.ZodSchema<SearchFilesParamsType>,

  async execute(params: SearchFilesParamsType): Promise<SearchFilesResultType> {
    logger.info('search_files tool called', { params });

    try {
      // ディレクトリパスの正規化
      const directoryPath = path.resolve(params.directory);
      logger.debug('Resolved directory path', { directoryPath });

      // FileSystemServiceのインスタンスを取得
      const fsService = FileSystemService.getInstance();
      
      // ディレクトリの存在確認
      try {
        const stats = await fsService.stat(directoryPath);
        if (!stats.isDirectory()) {
          throw new Error(`指定されたパスはディレクトリではありません: ${params.directory}`);
        }
      } catch (error) {
        // ファイルが存在するがディレクトリでない場合
        if (error instanceof Error && error.message.includes('ディレクトリではありません')) {
          throw error;
        }
        // ファイル/ディレクトリが存在しない場合
        logger.error(`Directory not found or not accessible: ${directoryPath}`);
        throw new Error(`ディレクトリが見つからないかアクセスできません: ${params.directory}`);
      }

      // 検索実行
      const searchContext: SearchContext = {
        filePattern: params.file_pattern,
        contentPattern: params.content_pattern,
        recursive: params.recursive,
        caseSensitive: params.case_sensitive,
        maxDepth: params.max_depth,
        maxResults: params.max_results,
        includeContent: params.include_content,
        fileSizeLimit: params.file_size_limit,
        filesScanned: 0,
        directoriesScanned: 0,
      };

      const results = await searchDirectory(directoryPath, searchContext, 0);
      
      // 結果を最大数で制限
      const limitedResults = results.slice(0, params.max_results);

      logger.info('Search completed successfully', {
        totalFound: results.length,
        limitedTo: limitedResults.length,
        filesScanned: searchContext.filesScanned,
        directoriesScanned: searchContext.directoriesScanned,
      });

      return {
        total_found: results.length,
        results: limitedResults,
        search_info: {
          directory: directoryPath,
          file_pattern: params.file_pattern,
          content_pattern: params.content_pattern,
          recursive: params.recursive,
          max_depth: params.max_depth,
          files_scanned: searchContext.filesScanned,
          directories_scanned: searchContext.directoriesScanned,
        },
      };

    } catch (error) {
      // 既にスローされたエラーはそのまま再スロー
      if (error instanceof Error && (error.message.includes('ディレクトリ') || error.message.includes('パス'))) {
        throw error;
      }

      // その他のエラー
      logger.error(`Unexpected error in search_files: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`ファイル検索中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

// 検索コンテキスト
interface SearchContext {
  filePattern?: string;
  contentPattern?: string;
  recursive: boolean;
  caseSensitive: boolean;
  maxDepth?: number;
  maxResults: number;
  includeContent: boolean;
  fileSizeLimit: number;
  filesScanned: number;
  directoriesScanned: number;
}

/**
 * ディレクトリを再帰的に検索
 */
async function searchDirectory(
  dirPath: string,
  context: SearchContext,
  currentDepth: number
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  // 最大深度のチェック
  if (context.maxDepth !== undefined && currentDepth > context.maxDepth) {
    return results;
  }

  try {
    const fsService = FileSystemService.getInstance();
    const entries = await fsService.readdir(dirPath, { withFileTypes: true }) as import('fs').Dirent[];
    context.directoriesScanned++;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // ディレクトリの処理
        const dirResult = await processDirectory(fullPath, entry.name, context);
        if (dirResult) {
          results.push(dirResult);
        }

        // 再帰検索
        if (context.recursive) {
          const subResults = await searchDirectory(fullPath, context, currentDepth + 1);
          results.push(...subResults);
        }
      } else if (entry.isFile()) {
        // ファイルの処理
        const fileResult = await processFile(fullPath, entry.name, context);
        if (fileResult) {
          results.push(fileResult);
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to read directory', { dirPath, error });
    // ディレクトリの読み取りエラーは無視して続行
  }

  return results;
}

/**
 * ディレクトリの処理
 */
async function processDirectory(
  dirPath: string,
  dirName: string,
  context: SearchContext
): Promise<SearchResult | null> {
  // ファイル名パターンのマッチング
  if (context.filePattern && !matchPattern(dirName, context.filePattern, context.caseSensitive)) {
    return null;
  }

  return {
    path: dirPath,
    name: dirName,
    type: 'directory',
  };
}

/**
 * ファイルの処理
 */
async function processFile(
  filePath: string,
  fileName: string,
  context: SearchContext
): Promise<SearchResult | null> {
  context.filesScanned++;

  // ファイル名パターンのマッチング
  if (context.filePattern && !matchPattern(fileName, context.filePattern, context.caseSensitive)) {
    return null;
  }

  try {
    const fsService = FileSystemService.getInstance();
    const stats = await fsService.stat(filePath);
    const result: SearchResult = {
      path: filePath,
      name: fileName,
      type: 'file',
      size: stats.size,
    };

    // コンテンツ検索
    if (context.contentPattern) {
      // ファイルサイズのチェック
      if (stats.size > context.fileSizeLimit) {
        logger.debug('File too large for content search', { filePath, size: stats.size });
        return null;
      }

      // バイナリファイルのスキップ（簡易チェック）
      if (await isBinaryFile(filePath)) {
        logger.debug('Skipping binary file', { filePath });
        return null;
      }

      const matches = await searchFileContent(filePath, context.contentPattern, context.caseSensitive, context.includeContent);
      if (matches.length === 0) {
        return null;
      }

      result.matches = matches;
    }

    return result;
  } catch (error) {
    logger.warn('Failed to process file', { filePath, error });
    return null;
  }
}

/**
 * ファイル名パターンのマッチング（簡易glob実装）
 */
function matchPattern(fileName: string, pattern: string, caseSensitive: boolean): boolean {
  // 大文字小文字の処理
  const normalizedFileName = caseSensitive ? fileName : fileName.toLowerCase();
  const normalizedPattern = caseSensitive ? pattern : pattern.toLowerCase();

  // globパターンを正規表現に変換
  const regexPattern = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
    .replace(/\*/g, '.*') // * を .* に変換
    .replace(/\?/g, '.'); // ? を . に変換

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedFileName);
}

/**
 * ファイル内容の検索
 */
async function searchFileContent(
  filePath: string,
  pattern: string,
  caseSensitive: boolean,
  includeContent: boolean
): Promise<SearchMatch[]> {
  try {
    const fsService = FileSystemService.getInstance();
    const content = await fsService.readFile(filePath, { encoding: 'utf-8' }) as string;
    const lines = content.split('\n');
    const matches: SearchMatch[] = [];

    // 正規表現パターンを作成
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      // 行内のすべてのマッチを検索
      regex.lastIndex = 0; // グローバル検索のリセット
      while ((match = regex.exec(line)) !== null) {
        matches.push({
          line_number: i + 1,
          line_content: includeContent ? line : '',
          match_start: match.index,
          match_end: match.index + match[0].length,
        });
      }
    }

    return matches;
  } catch (error) {
    logger.warn('Failed to search file content', { filePath, error });
    return [];
  }
}

/**
 * バイナリファイルかどうかの簡易チェック
 */
async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    // ファイルの最初の512バイトを読み取り
    // TODO: FileSystemServiceにopen操作を追加したら移行する
    const { promises: fs } = await import('fs');
    const buffer = Buffer.alloc(512);
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