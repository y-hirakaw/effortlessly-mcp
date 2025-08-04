/**
 * スマートテキスト挿入ツール - MCPアダプター
 */

import { SmartInsertTextTool } from './smart-insert-text.js';

const tool = new SmartInsertTextTool();

export const smartInsertTextAdapter = {
  name: tool.metadata.name,
  description: tool.metadata.description,
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '編集対象ファイルパス'
      },
      text: {
        type: 'string',
        description: '挿入するテキスト'
      },
      position_type: {
        type: 'string',
        enum: ['line_number', 'after_text', 'before_text', 'start', 'end'],
        description: '挿入位置の指定方法'
      },
      line_number: {
        type: 'number',
        description: '行番号（1から開始、position_type="line_number"の場合）'
      },
      reference_text: {
        type: 'string',
        description: '参照テキスト（after_text/before_textの場合）'
      },
      auto_indent: {
        type: 'boolean',
        description: '自動インデント調整（デフォルト: true）',
        default: true
      },
      preserve_empty_lines: {
        type: 'boolean',
        description: '空行を保持（デフォルト: true）',
        default: true
      },
      preview_mode: {
        type: 'boolean',
        description: 'プレビューモード（実際の挿入は行わない）',
        default: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        default: true
      },
      max_file_size: {
        type: 'number',
        description: '最大ファイルサイズ（バイト、デフォルト: 1MB）',
        default: 1048576
      }
    },
    required: ['file_path', 'text', 'position_type']
  },
  handler: async (params: any) => {
    return await tool.execute(params);
  }
};