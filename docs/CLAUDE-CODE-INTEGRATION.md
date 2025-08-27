# Claude Code Integration Guide

プロジェクトの`CLAUDE.md`ファイルに以下をコピー&ペーストしてください。

---

## effortlessly-mcp ツール必須使用設定

### 🚨 MUST: effortlessly-mcpツール優先使用

利用可能な場合は**必ず優先的に使用**:

**ファイル探索**: `mcp__effortlessly-mcp__search_with_learning`, `mcp__effortlessly-mcp__list_directory`

**ファイル読取**: `mcp__effortlessly-mcp__read_file`, `mcp__effortlessly-mcp__smart_range_optimizer`

**ファイル編集**: `mcp__effortlessly-mcp__smart_edit_file`, `mcp__effortlessly-mcp__smart_insert_text`, `mcp__effortlessly-mcp__override_text`

**エラー時のみ標準ツール使用**: `Read`, `Edit`, `Glob`, `Grep`

### 📏 ファイルサイズ判断基準

**Large (>50KB)**: `smart_range_optimizer` 使用
**Small (<50KB)**: `read_file` 使用

---

**重要**: この設定により、Claude Codeは自動的にeffortlessly-mcpツールを優先使用し、より高性能で安全なファイル操作が実現されます。