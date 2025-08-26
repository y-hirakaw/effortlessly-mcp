# Claude Code Integration Guide

プロジェクトの`CLAUDE.md`ファイルに以下をコピー&ペーストしてください。

---

## effortlessly-mcp ツール使用設定

### 🚨 必須：ツール使用優先順位

effortlessly-mcpツールが利用可能な場合は、**必ず優先的に使用**してください。

### 🔍 ファイル操作

**第一選択**: effortlessly-mcpツール（必ず優先使用）
- `mcp__effortlessly-mcp__search_with_learning` - **AI学習・最適化検索**
- `mcp__effortlessly-mcp__read_file` - ファイル読取（エンコーディング・部分読取対応）
- `mcp__effortlessly-mcp__list_directory` - ディレクトリ一覧（再帰・パターン対応）
- `mcp__effortlessly-mcp__get_file_metadata` - ファイル・ディレクトリ詳細情報

**フォールバック**: 標準ツール（effortlessly-mcpでエラー時のみ）
- `Read`, `Glob`, `Grep`, `LS`

### 📝 ファイル編集

**第一選択**: effortlessly-mcpツール（必ず優先使用）
- `mcp__effortlessly-mcp__smart_edit_file` - **安全編集（バックアップ・プレビュー付き）**
- `mcp__effortlessly-mcp__smart_insert_text` - **柔軟位置指定挿入**
- `mcp__effortlessly-mcp__override_text` - ファイル完全上書き（注意深く使用）

**フォールバック**: 標準ツール（effortlessly-mcpでエラー時のみ）
- `Edit`, `MultiEdit`, `Write`

### ⚡ search_with_learning 最適化設定

**推奨設定**:
```json
{
  "query": "検索クエリ",
  "directory": "検索対象ディレクトリ", 
  "content_pattern": "正規表現パターン",
  "recursive": true,
  "case_sensitive": false,
  "max_results": 50,
  "learn_patterns": true
}
```

**モード選択**:
- `learn_patterns: true` - **AI学習・キャッシュ・最適化（推奨）**
- `learn_patterns: false` - 軽量・高速シンプル検索

### 📋 基本的な使用パターン

```
1. 検索: mcp__effortlessly-mcp__search_with_learning
2. 読取: mcp__effortlessly-mcp__read_file  
3. 編集: mcp__effortlessly-mcp__smart_edit_file
4. 確認: mcp__effortlessly-mcp__read_file
```

### 🔄 エラー処理

effortlessly-mcpツールでエラーが発生した場合のみ標準ツールを使用：
```
mcp__effortlessly-mcp__smart_edit_file エラー → Edit ツール使用
```

### 📈 期待できる効果

- **パフォーマンス**: AI学習・キャッシュで43%高速化
- **安全性**: 自動バックアップ・プレビュー機能  
- **使いやすさ**: 統合された高機能API
- **信頼性**: エラーハンドリング・復旧機能

---

**重要**: この設定により、Claude Codeは自動的にeffortlessly-mcpツールを優先使用し、より高性能で安全なファイル操作が実現されます。