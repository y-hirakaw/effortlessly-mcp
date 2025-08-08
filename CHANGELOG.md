# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.4] - 2025-08-08

### Added
- Insert diff機能の大幅強化
  - `smart_insert_text`での柔軟な位置指定による挿入処理
  - プレビュー機能付きで安全な挿入操作
  - 自動インデント調整機能
- 包括テスト追加
  - 各種挿入パターンのテストケース拡充
  - diff機能の品質保証体制強化

## [1.0.3] - 2025-08-08

### Improved
- smart_edit_fileツールの安全性とパフォーマンス最適化
  - バックアップ機能の改善
  - エラーハンドリングの強化
  - 処理速度の向上

### Fixed
- ログ出力量最適化によるClaude Code停止問題の対策
  - 大量ログ出力時のメモリ使用量削減
  - Claude Code との互換性改善
- smart_edit_file診断機能強化
  - パラメータundefinedエラーの根本的対策
  - 診断メッセージの改善

### Changed  
- FileSystemService Phase2A完全移行
  - LSP・プロジェクト管理・コード解析の統合完了
  - 統一ファイル操作プロキシによる一貫性向上
  - 基本ファイル操作ツールの全面移行

## [1.0.2] - 2025-08-06

### Changed
- プロジェクトメモリシステムの構造化改善
  - 固定ファイル名構造に変更（dated形式から脱却）
  - 5つの特化インデックスに分離：構造概要、Manager、アーキテクチャ、セキュリティ、LSP統合
  - `.claude/workspace/effortlessly/memory/`で一元管理
  - 古い情報参照問題の根本解決

### Added
- 特化プロジェクトインデックスシステム
  - `project_structure_index.md` - メイン目次とクイックリファレンス
  - `manager_classes_index.md` - 4つのManagerクラス詳細
  - `architecture_overview.md` - 5層アーキテクチャ構造
  - `security_implementation_map.md` - セキュリティ実装状況マップ
  - `lsp_integration_status.md` - LSP統合詳細状況

### Fixed
- プロジェクト情報アクセスの一貫性向上
  - `project_update_workflow`ツールの固定ファイル名対応
  - CLAUDE.mdガイドの更新で正しい活用方法を明示

## [1.0.1] - 2025-08-06

### Fixed
- MCPツールのトークン制限対策を実装
  - `list_directory`: max_results制限（デフォルト100、最大1000）でLLMトークン制限に対応
  - `code_get_symbols_overview`: max_files制限調整（デフォルト50、最大500）とパラメータ受け渡し問題修正
- Issue #1修正: smart_edit_file精度向上
  - 大きなファイルでの単一文字置換問題を解決
  - 絶対位置ベースの置換アルゴリズムに改良

### Added
- read_file機能拡張
  - 部分読み取り機能追加（offset/limit）
  - 行番号表示対応（include_line_numbers）
  - READツール相当の機能を統合

### Changed
- 対応するアダプター・テストケースの統一インターフェース更新
- LLM別推奨値の文書化追加

## [1.0.0] - 2025-08-05

### Added
- 初回リリース
- 基本的なMCPサーバー機能
- ファイル操作ツール群
- コード解析ツール群
- セキュリティ機能
- プロジェクトメモリ機能

[unreleased]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/y-hirakaw/effortlessly-mcp/releases/tag/v1.0.0
