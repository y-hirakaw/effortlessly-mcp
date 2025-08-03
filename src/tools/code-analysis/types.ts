/**
 * コード解析ツール用の型定義
 */

import { z } from 'zod';
import type { SymbolKind } from 'vscode-languageserver-protocol';

/**
 * シンボル検索パラメータ
 */
export const FindSymbolParamsSchema = z.object({
  symbol_name: z.string().min(1).describe('検索するシンボル名'),
  search_type: z.enum(['exact', 'fuzzy']).optional().default('fuzzy').describe('検索タイプ'),
  symbol_kind: z.number().optional().describe('シンボルの種類（SymbolKind）'),
  file_pattern: z.string().optional().describe('ファイルパターン（部分マッチ）'),
  max_results: z.number().min(1).max(1000).optional().default(100).describe('最大結果数')
});

export type FindSymbolParams = z.infer<typeof FindSymbolParamsSchema>;

/**
 * 参照検索パラメータ
 */
export const FindReferencesParamsSchema = z.object({
  file_path: z.string().min(1).describe('ファイルパス'),
  line: z.number().min(0).describe('行番号（0から開始）'),
  column: z.number().min(0).describe('列番号（0から開始）'),
  include_declaration: z.boolean().optional().default(true).describe('宣言も含めるかどうか')
});

export type FindReferencesParams = z.infer<typeof FindReferencesParamsSchema>;

/**
 * シンボル検索結果の型定義
 */
export interface CodeSymbolResult {
  /** シンボル名 */
  name: string;
  /** シンボルの種類 */
  kind: SymbolKind;
  /** シンボル種類の説明 */
  kind_name: string;
  /** ファイルパス */
  file: string;
  /** 行番号（0から開始） */
  line: number;
  /** 列番号（0から開始） */
  column: number;
  /** 詳細情報（シグネチャなど） */
  detail?: string;
  /** ドキュメント */
  documentation?: string;
}

/**
 * 参照検索結果の型定義
 */
export interface CodeReferenceResult {
  /** ファイルパス */
  file: string;
  /** 行番号（0から開始） */
  line: number;
  /** 列番号（0から開始） */
  column: number;
  /** 参照の種類 */
  kind: 'definition' | 'declaration' | 'reference';
  /** 周辺のコードコンテキスト */
  context: string;
}

/**
 * SymbolKindの数値を説明文字列に変換
 */
export function symbolKindToString(kind: SymbolKind): string {
  const kindMap: Record<number, string> = {
    1: 'File',
    2: 'Module', 
    3: 'Namespace',
    4: 'Package',
    5: 'Class',
    6: 'Method',
    7: 'Property',
    8: 'Field',
    9: 'Constructor',
    10: 'Enum',
    11: 'Interface',
    12: 'Function',
    13: 'Variable',
    14: 'Constant',
    15: 'String',
    16: 'Number',
    17: 'Boolean',
    18: 'Array',
    19: 'Object',
    20: 'Key',
    21: 'Null',
    22: 'EnumMember',
    23: 'Struct',
    24: 'Event',
    25: 'Operator',
    26: 'TypeParameter'
  };
  
  return kindMap[kind] || 'Unknown';
}