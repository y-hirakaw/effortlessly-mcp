import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../../services/logger.js';
import type { MdcToolImplementation } from '../../types/mcp.js';

const logger = Logger.getInstance();

// ツールのパラメータスキーマ
const ReadFileParams = z.object({
  file_path: z.string().describe('読み取るファイルのパス'),
  encoding: z.string().optional().default('utf-8').describe('ファイルのエンコーディング（デフォルト: utf-8）'),
});

type ReadFileParamsType = z.infer<typeof ReadFileParams>;

// ツールの結果スキーマ
const ReadFileResult = z.object({
  content: z.string().describe('ファイルの内容'),
  encoding: z.string().describe('使用されたエンコーディング'),
  size: z.number().describe('ファイルサイズ（バイト）'),
});

type ReadFileResultType = z.infer<typeof ReadFileResult>;

/**
 * read_file ツールの実装
 * 指定されたファイルの内容を読み取る
 */
export const readFileTool: MdcToolImplementation<ReadFileParamsType, ReadFileResultType> = {
  name: 'read_file',
  description: '指定されたファイルの内容を読み取ります',
  inputSchema: ReadFileParams,

  async execute(params: ReadFileParamsType): Promise<ReadFileResultType> {
    logger.info('read_file tool called', { params });

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
      
      // ディレクトリの場合はエラー
      if (stats.isDirectory()) {
        logger.error('Path is a directory', { filePath });
        throw new Error(`指定されたパスはディレクトリです: ${params.file_path}`);
      }

      // ファイルサイズの上限チェック（100MB）
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        logger.error('File too large', { filePath, size: stats.size, maxSize });
        throw new Error(`ファイルサイズが大きすぎます: ${stats.size} バイト（最大: ${maxSize} バイト）`);
      }

      // ファイルの読み取り
      const encoding = params.encoding || 'utf-8';
      const content = await fs.readFile(filePath, { encoding: encoding as BufferEncoding });
      
      logger.info('File read successfully', { 
        filePath, 
        size: stats.size,
        encoding: params.encoding 
      });

      return {
        content,
        encoding: encoding,
        size: stats.size,
      };

    } catch (error) {
      // 既にスローされたエラーはそのまま再スロー
      if (error instanceof Error && error.message.includes('ファイル')) {
        throw error;
      }

      // その他のエラー
      logger.error('Unexpected error in read_file', { error });
      throw new Error(`ファイルの読み取り中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};