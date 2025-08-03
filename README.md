# effortlessly-mcp

TypeScript製のMCP（Model Context Protocol）サーバーです。セキュアなファイル操作とワークスペース管理機能を提供します。

## 機能

現在実装済みの機能：

- **ファイル操作**
  - `read_file` - ファイル内容の読み取り
  - `list_directory` - ディレクトリ一覧の取得
  - `get_file_metadata` - ファイル/ディレクトリのメタデータ取得
  - `search_files` - ファイル検索（名前・内容）

- **ワークスペース管理**
  - `workspace_activate` - プロジェクトワークスペースの活性化
  - `workspace_get_info` - 現在のワークスペース情報取得
  - `workspace_list_all` - 登録済みワークスペース一覧

- **基本機能**
  - `echo` - 接続テスト用

## インストール

```bash
npm install
npm run build
```

## 使用方法

```bash
npm run dev
```

## 技術仕様

- **言語**: TypeScript (ES2022)
- **ランタイム**: Node.js 20+
- **テストフレームワーク**: Vitest
- **リンター**: ESLint with TypeScript
- **設定形式**: YAML
- **ワークスペース**: `~/.claude/workspace/effortlessly/`

## 開発

```bash
npm run typecheck  # 型チェック
npm run lint      # コード品質チェック
npm test          # テスト実行
```

## ライセンス

MIT
