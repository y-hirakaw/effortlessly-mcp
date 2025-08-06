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
  offset: z.number().optional().describe('読み取り開始行番号（1から始まる）'),
  limit: z.number().optional().describe('読み取る行数'),
  include_line_numbers: z.boolean().optional().default(false).describe('行番号を含めるかどうか'),
});

type ReadFileParamsType = z.infer<typeof ReadFileParams>;

// ツールの結果スキーマ
const ReadFileResult = z.object({
  content: z.string().describe('ファイルの内容'),
  encoding: z.string().describe('使用されたエンコーディング'),
  size: z.number().describe('ファイルサイズ（バイト）'),
  total_lines: z.number().optional().describe('ファイル全体の行数'),
  lines_read: z.number().optional().describe('読み取った行数'),
  range: z.object({
    start: z.number(),
    end: z.number()
  }).optional().describe('読み取り範囲（行番号）'),
});

type ReadFileResultType = z.infer<typeof ReadFileResult>;

/**
 * read_file ツールの実装
 * 指定されたファイルの内容を読み取る
 */
export const readFileTool: MdcToolImplementation<ReadFileParamsType, ReadFileResultType> = {
  name: 'read_file',
  description: '指定されたファイルの内容を読み取ります。部分読み取り（offset/limit）と行番号表示に対応',
  inputSchema: ReadFileParams as z.ZodSchema<ReadFileParamsType>,

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
        logger.error(`File not found: ${filePath}`);
        throw new Error(`ファイルが見つかりません: ${params.file_path}`);
      }

      // ファイルの統計情報を取得
      const stats = await fs.stat(filePath);
      
      // ディレクトリの場合はエラー
      if (stats.isDirectory()) {
        logger.error(`Path is a directory: ${filePath}`);
        throw new Error(`指定されたパスはディレクトリです: ${params.file_path}`);
      }

      // ファイルサイズの上限チェック（100MB）
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        logger.error(`File too large: ${filePath}, size: ${stats.size}, maxSize: ${maxSize}`);
        throw new Error(`ファイルサイズが大きすぎます: ${stats.size} バイト（最大: ${maxSize} バイト）`);
      }

      // ファイルの読み取り
      const encoding = params.encoding || 'utf-8';
      let content = await fs.readFile(filePath, { encoding: encoding as BufferEncoding });
      
      // 部分読み取りが指定されている場合
      let totalLines: number | undefined;
      let linesRead: number | undefined;
      let range: { start: number; end: number } | undefined;
      
      const lines = content.split('\n');
      totalLines = lines.length;
      
      if (params.offset !== undefined || params.limit !== undefined) {
        const startLine = Math.max(1, params.offset || 1) - 1; // 0-indexed
        const endLine = params.limit 
          ? Math.min(lines.length, startLine + params.limit)
          : lines.length;
        
        const selectedLines = lines.slice(startLine, endLine);
        linesRead = selectedLines.length;
        range = { start: startLine + 1, end: endLine }; // 1-indexed for output
        
        // 行番号を含める場合
        if (params.include_line_numbers) {
          content = selectedLines
            .map((line, index) => `${String(startLine + index + 1).padStart(4)}→${line}`)
            .join('\n');
        } else {
          content = selectedLines.join('\n');
        }
      } else if (params.include_line_numbers) {
        // 全ファイルに行番号を付ける場合
        linesRead = lines.length;
        content = lines
          .map((line, index) => `${String(index + 1).padStart(4)}→${line}`)
          .join('\n');
      }
      
      logger.info('File read successfully', { 
        filePath, 
        size: stats.size,
        encoding: params.encoding,
        totalLines,
        linesRead,
        range
      });

      return {
        content,
        encoding: encoding,
        size: stats.size,
        total_lines: totalLines,
        lines_read: linesRead,
        range,
      };

    } catch (error) {
      // 既にスローされたエラーはそのまま再スロー
      if (error instanceof Error && error.message.includes('ファイル')) {
        throw error;
      }

      // その他のエラー
      logger.error(`Unexpected error in read_file: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`ファイルの読み取り中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};