# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/y-hirakaw/effortlessly-mcp/releases/tag/v1.0.0
