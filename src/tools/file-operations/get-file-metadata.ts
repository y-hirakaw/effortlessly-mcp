import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../../services/logger.js';
import type { MdcToolImplementation } from '../../types/mcp.js';

const logger = Logger.getInstance();

// ファイルタイプの列挙型
export enum FileType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SYMLINK = 'symlink',
  BLOCK_DEVICE = 'block_device',
  CHARACTER_DEVICE = 'character_device',
  FIFO = 'fifo',
  SOCKET = 'socket',
  UNKNOWN = 'unknown',
}

// ツールのパラメータスキーマ
const GetFileMetadataParams = z.object({
  file_path: z.string().describe('メタデータを取得するファイルのパス'),
});

type GetFileMetadataParamsType = z.infer<typeof GetFileMetadataParams>;

// ツールの結果スキーマ
const GetFileMetadataResult = z.object({
  path: z.string().describe('ファイルの絶対パス'),
  name: z.string().describe('ファイル名'),
  type: z.enum(['file', 'directory', 'symlink', 'block_device', 'character_device', 'fifo', 'socket', 'unknown']).describe('ファイルタイプ'),
  size: z.number().describe('ファイルサイズ（バイト）'),
  created: z.string().describe('作成日時（ISO 8601）'),
  modified: z.string().describe('最終更新日時（ISO 8601）'),
  accessed: z.string().describe('最終アクセス日時（ISO 8601）'),
  permissions: z.string().optional().describe('ファイルパーミッション（8進数）'),
  owner: z.object({
    uid: z.number().optional().describe('ユーザーID'),
    gid: z.number().optional().describe('グループID'),
  }).optional().describe('所有者情報'),
  is_readable: z.boolean().describe('読み取り可能かどうか'),
  is_writable: z.boolean().describe('書き込み可能かどうか'),
  is_executable: z.boolean().describe('実行可能かどうか'),
});

type GetFileMetadataResultType = z.infer<typeof GetFileMetadataResult>;

/**
 * get_file_metadata ツールの実装
 * 指定されたファイルのメタデータを取得する
 */
export const getFileMetadataTool: MdcToolImplementation<GetFileMetadataParamsType, GetFileMetadataResultType> = {
  name: 'get_file_metadata',
  description: '指定されたファイルのメタデータ（サイズ、更新日時、パーミッション情報）を取得します',
  inputSchema: GetFileMetadataParams,

  async execute(params: GetFileMetadataParamsType): Promise<GetFileMetadataResultType> {
    logger.info('get_file_metadata tool called', { params });

    try {
      // ファイルパスの正規化
      const filePath = path.resolve(params.file_path);
      logger.debug('Resolved file path', { filePath });

      // ファイルの存在確認
      try {
        await fs.access(filePath);
      } catch (error) {
        logger.error('File not found', { filePath, error });
        throw new Error(`ファイルが見つかりません: ${params.file_path}`);
      }

      // ファイルの統計情報を取得
      const stats = await fs.stat(filePath);
      
      // ファイル名を取得
      const fileName = path.basename(filePath);

      // ファイルタイプを判定
      const fileType = getFileType(stats);

      // アクセス権限をチェック
      const [isReadable, isWritable, isExecutable] = await Promise.all([
        checkAccess(filePath, fs.constants.R_OK),
        checkAccess(filePath, fs.constants.W_OK),
        checkAccess(filePath, fs.constants.X_OK),
      ]);

      // パーミッション情報（Unix系システムのみ）
      let permissions: string | undefined;
      let owner: { uid?: number; gid?: number } | undefined;

      if (process.platform !== 'win32') {
        permissions = (stats.mode & parseInt('777', 8)).toString(8);
        owner = {
          uid: stats.uid,
          gid: stats.gid,
        };
      }

      logger.info('File metadata retrieved successfully', { 
        filePath,
        type: fileType,
        size: stats.size,
      });

      return {
        path: filePath,
        name: fileName,
        type: fileType,
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        permissions,
        owner,
        is_readable: isReadable,
        is_writable: isWritable,
        is_executable: isExecutable,
      };

    } catch (error) {
      // 既にスローされたエラーはそのまま再スロー
      if (error instanceof Error && error.message.includes('ファイル')) {
        throw error;
      }

      // その他のエラー
      logger.error('Unexpected error in get_file_metadata', { error });
      throw new Error(`ファイルメタデータの取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

/**
 * ファイルタイプを判定
 */
function getFileType(stats: fs.Stats): FileType {
  if (stats.isFile()) return FileType.FILE;
  if (stats.isDirectory()) return FileType.DIRECTORY;
  if (stats.isSymbolicLink()) return FileType.SYMLINK;
  if (stats.isBlockDevice()) return FileType.BLOCK_DEVICE;
  if (stats.isCharacterDevice()) return FileType.CHARACTER_DEVICE;
  if (stats.isFIFO()) return FileType.FIFO;
  if (stats.isSocket()) return FileType.SOCKET;
  return FileType.UNKNOWN;
}

/**
 * ファイルアクセス権限をチェック
 */
async function checkAccess(filePath: string, mode: number): Promise<boolean> {
  try {
    await fs.access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}