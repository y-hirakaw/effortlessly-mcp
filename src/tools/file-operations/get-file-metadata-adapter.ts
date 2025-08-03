import { ITool, IToolResult, IToolMetadata } from '../../types/common.js';
import { getFileMetadataTool } from './get-file-metadata.js';
import { z } from 'zod';

/**
 * get_file_metadata ツールのアダプター
 * MdcToolImplementation を ITool インターフェースに適合させる
 */
export class GetFileMetadataTool implements ITool {
  readonly metadata: IToolMetadata = {
    name: 'get_file_metadata',
    description: getFileMetadataTool.description,
    parameters: {
      file_path: {
        type: 'string',
        description: 'メタデータを取得するファイルのパス',
        required: true,
      },
    },
  };

  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    try {
      // パラメータの検証
      const validatedParams = getFileMetadataTool.inputSchema.parse(parameters);
      
      // ツールの実行
      const result = await getFileMetadataTool.execute(validatedParams);
      
      // 結果を IToolResult 形式に変換
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            file_type: result.type,
            size: result.size,
            is_readable: result.is_readable,
            is_writable: result.is_writable,
            is_executable: result.is_executable,
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