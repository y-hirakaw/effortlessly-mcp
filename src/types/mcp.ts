import { z } from 'zod';

/**
 * MCP互換のツール実装インターフェース
 */
export interface MdcToolImplementation<TParams = any, TResult = any> {
  /**
   * ツールの名前
   */
  name: string;

  /**
   * ツールの説明
   */
  description: string;

  /**
   * 入力パラメータのスキーマ
   */
  inputSchema: z.ZodSchema<TParams>;

  /**
   * ツールの実行関数
   */
  execute(params: TParams): Promise<TResult>;
}

/**
 * MCPツール呼び出しパラメータ
 */
export interface McpToolCallParams {
  arguments?: Record<string, unknown>;
}

/**
 * MCPツール実行結果
 */
export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}