import { z } from 'zod';
import { promises as fs } from 'fs';
import type { Stats } from 'node:fs';
import * as path from 'path';
import { Logger } from '../../services/logger.js';
import type { MdcToolImplementation } from '../../types/mcp.js';

const logger = Logger.getInstance();

// ファイルタイプの列挙型
export enum FileType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SYMLINK = 'symlink',
  OTHER = 'other',
}

// ディレクトリエントリの情報
export interface DirectoryEntry {
  name: string;
  path: string;
  type: FileType;
  size: number;
  modified: string;
  permissions?: string;
}

// ツールのパラメータスキーマ
const ListDirectoryParams = z.object({
  directory_path: z.string().describe('一覧表示するディレクトリのパス'),
  recursive: z.boolean().optional().default(false).describe('サブディレクトリも再帰的に表示するか'),
  pattern: z.string().optional().describe('ファイル名のフィルタパターン（正規表現）'),
  max_results: z.number().min(1).max(1000).optional().default(100).describe('最大結果数（LLMトークン制限対策: Claude=100推奨, GPT-4=50推奨, Gemini=500可能）'),
});

type ListDirectoryParamsType = z.infer<typeof ListDirectoryParams>;

// ツールの結果スキーマ
const ListDirectoryResult = z.object({
  entries: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'directory', 'symlink', 'other']),
    size: z.number(),
    modified: z.string(),
    permissions: z.string().optional(),
  })).describe('ディレクトリエントリの配列'),
  total_count: z.number().describe('エントリの総数'),
  directory: z.string().describe('対象ディレクトリのパス'),
});

type ListDirectoryResultType = z.infer<typeof ListDirectoryResult>;

/**
 * list_directory ツールの実装
 * 指定されたディレクトリ内のファイル・フォルダ一覧を表示
 */
export const listDirectoryTool: MdcToolImplementation<ListDirectoryParamsType, ListDirectoryResultType> = {
  name: 'list_directory',
  description: '指定されたディレクトリ内のファイル・フォルダ一覧を表示します',
  inputSchema: ListDirectoryParams as z.ZodSchema<ListDirectoryParamsType>,

  async execute(params: ListDirectoryParamsType): Promise<ListDirectoryResultType> {
    logger.info('list_directory tool called', { params });

    try {
      // ディレクトリパスの正規化
      const dirPath = path.resolve(params.directory_path);
      logger.debug('Resolved directory path', { dirPath });

      // ディレクトリの存在確認
      try {
        await fs.access(dirPath);
      } catch (error) {
        logger.error(`Directory not found: ${dirPath}`);
        throw new Error(`ディレクトリが見つかりません: ${params.directory_path}`);
      }

      // ディレクトリかどうかの確認
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        logger.error(`Path is not a directory: ${dirPath}`);
        throw new Error(`指定されたパスはディレクトリではありません: ${params.directory_path}`);
      }

      // エントリ一覧を取得
      const entries: DirectoryEntry[] = [];
      
      if (params.recursive) {
        // 再帰的に取得
        await listDirectoryRecursive(dirPath, dirPath, entries, params.pattern);
      } else {
        // 単一ディレクトリのみ
        await listDirectorySingle(dirPath, entries, params.pattern);
      }

      // 結果をパスでソート
      entries.sort((a, b) => a.path.localeCompare(b.path));

      // max_results制限を適用
      const maxResults = params.max_results || 100;
      const limitedEntries = entries.slice(0, maxResults);
      const wasLimited = entries.length > maxResults;

      logger.info('Directory listed successfully', { 
        dirPath, 
        totalEntries: entries.length,
        returnedEntries: limitedEntries.length,
        wasLimited,
        recursive: params.recursive,
        pattern: params.pattern,
      });

      return {
        entries: limitedEntries,
        total_count: entries.length,
        directory: dirPath,
      };

    } catch (error) {
      // 既にスローされたエラーはそのまま再スロー
      if (error instanceof Error && error.message.includes('ディレクトリ')) {
        throw error;
      }

      // その他のエラー
      logger.error(`Unexpected error in list_directory: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`ディレクトリの一覧取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

/**
 * 単一ディレクトリのエントリを取得
 */
async function listDirectorySingle(
  dirPath: string, 
  entries: DirectoryEntry[], 
  pattern?: string
): Promise<void> {
  const items = await fs.readdir(dirPath);
  const regex = pattern ? new RegExp(pattern) : undefined;

  for (const item of items) {
    // パターンフィルタ
    if (regex && !regex.test(item)) {
      continue;
    }

    const itemPath = path.join(dirPath, item);
    
    try {
      const stats = await fs.stat(itemPath);
      const entry: DirectoryEntry = {
        name: item,
        path: itemPath,
        type: getFileType(stats),
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };

      // パーミッション情報を追加（Unix系のみ）
      if (process.platform !== 'win32') {
        entry.permissions = (stats.mode & parseInt('777', 8)).toString(8);
      }

      entries.push(entry);
    } catch (error) {
      // アクセスできないファイルはスキップ
      logger.debug('Failed to stat file', { itemPath, error });
    }
  }
}

/**
 * ディレクトリを再帰的に取得
 */
async function listDirectoryRecursive(
  rootPath: string,
  currentPath: string,
  entries: DirectoryEntry[],
  pattern?: string
): Promise<void> {
  await listDirectorySingle(currentPath, entries, pattern);

  // サブディレクトリを取得
  const subDirs = entries
    .filter(e => e.type === FileType.DIRECTORY && path.dirname(e.path) === currentPath)
    .map(e => e.path);

  // 各サブディレクトリを再帰的に処理
  for (const subDir of subDirs) {
    await listDirectoryRecursive(rootPath, subDir, entries, pattern);
  }
}

/**
 * ファイルタイプを判定
 */
function getFileType(stats: Stats): FileType {
  if (stats.isFile()) return FileType.FILE;
  if (stats.isDirectory()) return FileType.DIRECTORY;
  if (stats.isSymbolicLink()) return FileType.SYMLINK;
  return FileType.OTHER;
}