import { ITool, IToolResult, IToolMetadata } from '../../types/common.js';
import { listDirectoryTool } from './list-directory.js';
import { z } from 'zod';

/**
 * list_directory ツールのアダプター
 * MdcToolImplementation を ITool インターフェースに適合させる
 */
export class ListDirectoryTool implements ITool {
  readonly metadata: IToolMetadata = {
    name: 'list_directory',
    description: listDirectoryTool.description,
    parameters: {
      directory_path: {
        type: 'string',
        description: '一覧表示するディレクトリのパス',
        required: true,
      },
      recursive: {
        type: 'boolean',
        description: 'サブディレクトリも再帰的に表示するか（デフォルト: false）',
        required: false,
      },
      pattern: {
        type: 'string',
        description: 'ファイル名のフィルタパターン（正規表現）',
        required: false,
      },
      max_results: {
        type: 'number',
        description: '最大結果数（1-1000、デフォルト100）トークン制限に応じて調整可能',
        required: false,
      },
    },
  };

  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    try {
      // パラメータの検証
      const validatedParams = listDirectoryTool.inputSchema.parse(parameters);
      
      // ツールの実行
      const result = await listDirectoryTool.execute(validatedParams);
      
      // 結果を IToolResult 形式に変換
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            total_count: result.total_count,
            directory: result.directory,
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