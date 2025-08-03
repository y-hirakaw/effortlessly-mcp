import { ITool, IToolResult, IToolMetadata } from '../../types/common.js';
import { searchFilesTool } from './search-files.js';
import { z } from 'zod';

/**
 * search_files ツールのアダプター
 * MdcToolImplementation を ITool インターフェースに適合させる
 */
export class SearchFilesTool implements ITool {
  readonly metadata: IToolMetadata = {
    name: 'search_files',
    description: searchFilesTool.description,
    parameters: {
      directory: {
        type: 'string',
        description: '検索対象のディレクトリパス',
        required: true,
      },
      file_pattern: {
        type: 'string',
        description: 'ファイル名パターン（glob形式、例: *.ts, test*.js）',
        required: false,
      },
      content_pattern: {
        type: 'string',
        description: 'ファイル内容の検索パターン（正規表現）',
        required: false,
      },
      recursive: {
        type: 'boolean',
        description: '再帰的に検索するかどうか',
        required: false,
        default: true,
      },
      case_sensitive: {
        type: 'boolean',
        description: '大文字小文字を区別するかどうか',
        required: false,
        default: false,
      },
      max_depth: {
        type: 'number',
        description: '最大検索深度（recursiveがtrueの場合のみ有効）',
        required: false,
      },
      max_results: {
        type: 'number',
        description: '最大結果数',
        required: false,
        default: 100,
      },
      include_content: {
        type: 'boolean',
        description: 'マッチした行の内容を含めるかどうか',
        required: false,
        default: false,
      },
      file_size_limit: {
        type: 'number',
        description: 'テキスト検索対象ファイルの最大サイズ（バイト）',
        required: false,
        default: 10485760, // 10MB
      },
    },
  };

  async execute(parameters: Record<string, unknown>): Promise<IToolResult> {
    try {
      // パラメータの検証
      const validatedParams = searchFilesTool.inputSchema.parse(parameters);
      
      // ツールの実行
      const result = await searchFilesTool.execute(validatedParams);
      
      // 結果を IToolResult 形式に変換
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
          _meta: {
            total_found: result.total_found,
            files_scanned: result.search_info.files_scanned,
            directories_scanned: result.search_info.directories_scanned,
            search_directory: result.search_info.directory,
            file_pattern: result.search_info.file_pattern,
            content_pattern: result.search_info.content_pattern,
            recursive: result.search_info.recursive,
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