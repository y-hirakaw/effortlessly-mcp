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

// LSPClientBaseの再エクスポート（循環参照回避のため）
export type { LSPClientBase } from './lsp-client.js';

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
 * LSPサーバー自動起動設定
 */
export interface LSPAutoStartConfig {
  /** 自動起動有効 */
  enabled: boolean;
  /** 自動インストール有効 */
  auto_install: boolean;
  /** 依存関係 */
  dependencies?: LSPDependency[];
  /** 環境変数 */
  env?: Record<string, string>;
  /** インストールディレクトリ */
  install_dir?: string;
  /** バージョン固定 */
  version?: string;
  /** インストール済み確認コマンド */
  check_command?: string[];
  /** プリインストールコマンド */
  pre_install_commands?: string[];
}

/**
 * LSP依存関係定義
 */
export interface LSPDependency {
  /** パッケージ名 */
  name: string;
  /** バージョン */
  version?: string;
  /** インストール方法 */
  installer: 'npm' | 'pip' | 'cargo' | 'system' | 'binary';
  /** 必須かオプションか */
  required: boolean;
  /** インストール引数 */
  install_args?: string[];
}

/**
 * LSP拡張サーバー設定
 */
export interface ExtendedLSPServerConfig extends LSPServerConfig {
  /** 自動起動設定 */
  auto_start?: LSPAutoStartConfig;
  /** 最大再起動回数 */
  max_restarts?: number;
  /** 起動タイムアウト（ミリ秒） */
  startup_timeout?: number;
  /** ヘルスチェック設定 */
  health_check?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
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
 * Java固有の設定（Eclipse JDT Language Server）
 */
export interface JavaLSPConfig extends LSPServerConfig {
  /** Javaバージョン */
  javaVersion?: string;
  /** JDKのホームパス */
  javaHome?: string;
  /** Maven project.xmlのパス */
  mavenProjectPath?: string;
  /** Maven対応 */
  mavenSupported?: boolean;
  /** Gradle build.gradleのパス */
  gradleProjectPath?: string;
  /** Gradle対応 */
  gradleSupported?: boolean;
  /** Classpathエントリ */
  classpathEntries?: string[];
  /** ソースパス */
  sourcePaths?: string[];
  /** JVMオプション */
  vmOptions?: string[];
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