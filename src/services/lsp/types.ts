/**
 * LSP統合に関する型定義
 */

import type { 
  Position, 
  Range, 
  Location, 
  SymbolInformation, 
  DocumentSymbol,
  SymbolKind 
} from 'vscode-languageserver-protocol';

// LSPから継承した基本型
export type { Position, Range, Location, SymbolInformation, DocumentSymbol, SymbolKind };

/**
 * シンボル検索結果
 */
export interface SymbolSearchResult {
  /** シンボル名 */
  name: string;
  /** シンボルの種類 */
  kind: SymbolKind;
  /** ファイルパス */
  file: string;
  /** 位置情報 */
  position: Position;
  /** 範囲情報 */
  range: Range;
  /** 親シンボル（ある場合） */
  parent?: string;
  /** シンボルの詳細情報 */
  detail?: string;
  /** ドキュメント */
  documentation?: string;
}

/**
 * 参照検索結果
 */
export interface ReferenceSearchResult {
  /** ファイルパス */
  file: string;
  /** 位置情報 */
  position: Position;
  /** 範囲情報 */
  range: Range;
  /** 参照の種類（定義、宣言、使用など） */
  kind: 'definition' | 'declaration' | 'reference';
  /** 周辺のコードコンテキスト */
  context: string;
}

/**
 * LSPサーバー設定
 */
export interface LSPServerConfig {
  /** サーバー名 */
  name: string;
  /** 実行可能ファイルのパス */
  command: string;
  /** コマンドライン引数 */
  args: string[];
  /** 対応ファイル拡張子 */
  fileExtensions: string[];
  /** ワークスペースルート */
  workspaceRoot: string;
}

/**
 * シンボルインデックスエントリ
 */
export interface SymbolIndexEntry {
  id?: number;
  name: string;
  kind: SymbolKind;
  file_path: string;
  line: number;
  column: number;
  parent_id?: number;
  signature?: string;
  documentation?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * LSPクライアント状態
 */
export interface LSPClientState {
  /** 接続状態 */
  connected: boolean;
  /** 初期化完了状態 */
  initialized: boolean;
  /** 最後のアクティビティ時刻 */
  lastActivity: Date;
  /** エラー状態 */
  errorState?: string;
}

/**
 * TypeScript固有の設定
 */
export interface TypeScriptLSPConfig extends LSPServerConfig {
  /** TypeScriptバージョン */
  tsVersion?: string;
  /** tsconfig.jsonのパス */
  tsconfigPath?: string;
  /** インクリメンタルコンパイル有効 */
  incremental?: boolean;
}

/**
 * Swift固有の設定（SourceKit-LSP）
 */
export interface SwiftLSPConfig extends LSPServerConfig {
  /** Swiftバージョン */
  swiftVersion?: string;
  /** Package.swiftのパス */
  packageSwiftPath?: string;
  /** Swift Package Manager対応 */
  packageSwiftSupported?: boolean;
  /** CocoaPods Podfileのパス */
  podfilePath?: string;
  /** CocoaPods対応 */
  cocoapodsSupported?: boolean;
}

/**
 * LSP JSON-RPC メッセージの基本型
 */
export interface LSPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: LSPError;
}

/**
 * LSP エラー型
 */
export interface LSPError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * LSP リクエスト型
 */
export interface LSPRequest extends LSPMessage {
  id: number | string;
  method: string;
  params?: unknown;
}

/**
 * LSP レスポンス型
 */
export interface LSPResponse extends LSPMessage {
  id: number | string;
  result?: unknown;
  error?: LSPError;
}

/**
 * LSP 通知型
 */
export interface LSPNotification extends LSPMessage {
  method: string;
  params?: unknown;
}

/**
 * シンボル検索レスポンス型
 */
export interface SymbolSearchResponse {
  symbols: SymbolInformation[];
}

/**
 * 参照検索レスポンス型
 */
export interface ReferencesResponse {
  references: Location[];
}

/**
 * ドキュメントシンボルレスポンス型
 */
export interface DocumentSymbolResponse {
  symbols: DocumentSymbol[] | SymbolInformation[];
}

/**
 * ワークスペースシンボルパラメータ型
 */
export interface WorkspaceSymbolParams {
  query: string;
}

/**
 * 参照検索パラメータ型
 */
export interface ReferenceParams {
  textDocument: { uri: string };
  position: Position;
  context: {
    includeDeclaration: boolean;
  };
}

/**
 * ドキュメントシンボルパラメータ型
 */
export interface DocumentSymbolParams {
  textDocument: { uri: string };
}

/**
 * LSPプロセス状態型
 */
export interface LSPProcessStatus {
  pid?: number;
  running: boolean;
  initialized: boolean;
  lastActivity?: Date;
  errorCount: number;
  requestCount: number;
}

/**
 * HTTP LSP クライアントレスポンス型
 */
export interface HttpLSPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}