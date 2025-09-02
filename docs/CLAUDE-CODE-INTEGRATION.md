# Claude Code統合設定

プロジェクトの`CLAUDE.md`ファイルに以下をコピー&ペーストしてください：

```markdown
# ファイル操作について

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
```

## 主な機能

- **AI検索**: `search_with_learning` - 学習型高速検索
- **プロジェクトメモリ**: `project_memory_*` - AI駆動知識管理
- **安全編集**: `smart_edit_file` - バックアップ付き編集
- **ワークスペース**: `workspace_setup` - プロジェクト環境管理

## トラブルシューティング

問題が発生した場合は、プロジェクトルートで以下を実行：

```bash
npm run build  # ビルド
node build/index.js  # 直接実行テスト
```

詳細なエラーは`.claude/workspace/effortlessly/logs/`に保存されます。