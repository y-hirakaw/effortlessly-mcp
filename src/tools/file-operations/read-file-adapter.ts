import { ITool, IToolResult, IToolMetadata } from '../../types/common.js';
import { readFileTool } from './read-file.js';
import { z } from 'zod';

/**
 * read_file ツールのアダプター
 * MdcToolImplementation を ITool インターフェースに適合させる
 */
export class ReadFileTool implements ITool {
  readonly metadata: IToolMetadata = {
    name: 'read_file',
    description: readFileTool.description,
    parameters: {
      file_path: {
        type: 'string',
        description: '読み取るファイルのパス',
        required: true,
      },
      encoding: {
        type: 'string',
        description: 'ファイルのエンコーディング（デフォルト: utf-8）',
        required: false,
      },
    },
  };

  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    try {
      // パラメータの検証
      const validatedParams = readFileTool.inputSchema.parse(parameters);
      
      // ツールの実行
      const result = await readFileTool.execute(validatedParams);
      
      // 結果を IToolResult 形式に変換
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            encoding: result.encoding,
            size: result.size,
          },
        }],
        isError: false,
      };
    } catch (error) {
      // エラーハンドリング
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof z.ZodError) {
        errorMessage = `パラメータ検証エラー: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        content: [{
          type: 'text',
          text: errorMessage,
        }],
        isError: true,
      };
    }
  }
}