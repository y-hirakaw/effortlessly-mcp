/**
 * スマートファイル編集ツール - MCPアダプター
 */

import { SmartEditFileTool } from './smart-edit-file.js';

const tool = new SmartEditFileTool();

export const smartEditFileAdapter = {
  name: tool.metadata.name,
  description: tool.metadata.description,
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '編集対象ファイルパス'
      },
      old_text: {
        type: 'string',
        description: '置換対象の文字列'
      },
      new_text: {
        type: 'string',
        description: '置換後の文字列'
      },
      preview_mode: {
        type: 'boolean',
        description: 'プレビューモード（実際の変更は行わない）',
        default: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        default: true
      },
      case_sensitive: {
        type: 'boolean',
        description: '大文字小文字を区別（デフォルト: true）',
        default: true
      },
      replace_all: {
        type: 'boolean',
        description: 'すべての出現箇所を置換（デフォルト: false）',
        default: false
      },
      max_file_size: {
        type: 'number',
        description: '最大ファイルサイズ（バイト、デフォルト: 1MB）',
        default: 1048576
      }
    },
    required: ['file_path', 'old_text', 'new_text']
  },
  handler: async (params: any) => {
    return await tool.execute(params);
  }
};