# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.6] - 2025-08-09

### Added
- 🎛️ **設定ファイル統合化**
  - 設定ファイルを `.claude/workspace/effortlessly/config.yaml` に統合
  - `logging.operations.enabled` でoperationsログの有効/無効制御
  - `logging.diff` セクションでdiffログ設定を一元管理
- ⚙️ **FileSystemService機能拡張** 
  - `existsSync()` 同期ファイル存在確認メソッド追加
  - `readFileSync()` 同期ファイル読み込みメソッド追加
  - 設定ファイル読み込みでの一貫性向上
- 🎨 **diffログ表示改善**
  - `use_colors` 設定を削除し、常にANSIカラーコード使用
  - ログファイルでの視認性向上（Claude Codeでは非表示）

### Changed
- LogManagerに設定読み込み機能追加
  - 1分間設定キャッシュでパフォーマンス向上
  - デフォルト設定との適切なマージ処理
- 設定構造の階層化: `logging.operations` と `logging.diff` 

### Fixed
- 設定ファイルパス参照の統一
- 同期/非同期メソッドの適切な使い分け

## [1.0.5] - 2025-08-09

### Added
- 🎯 **設定可能なdiff表示システム**
  - YAML設定ファイル (`diff-display.yaml`) による大規模ファイル判定閾値のカスタマイズ
  - `max_lines_for_detailed_diff` パラメータで詳細diff vs サマリー表示の切り替え
  - `default_context_lines` でdiff表示時のコンテキスト行数を調整可能
  - `use_colors` でANSI色コードの有効/無効を制御
- ⚙️ **設定システムの堅牢性**
  - 1分間の設定キャッシュ機能
  - 無効YAML/設定未存在時の安全なフォールバック
  - 部分設定でのデフォルト値マージ機能
- 🧪 **包括的テスト追加**
  - `high-quality-diff-config.test.ts` - 7つの設定機能テスト
  - デフォルト設定、カスタム閾値、表示オプション、エラーハンドリングのテスト
  - 既存テストの設定変更対応修正

### Changed  
- `HighQualityDiff.loadConfig()` メソッドをpublicに変更
- `DiffLogger` でハードコードされた値を設定ファイル準拠に変更

### Documentation
- 📚 **新規ドキュメント作成**
  - `docs/LOGGING-CONFIGURATION.md` - ログとdiff設定の詳細ガイド
- 📝 **既存ドキュメント更新**
  - `README.md` - v1.0.5機能追加、ワークスペース構造更新
  - `docs/USAGE.md` - 設定セクション追加、関連ドキュメントリンク更新

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

[unreleased]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.6...HEAD
[1.0.6]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/y-hirakaw/effortlessly-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/y-hirakaw/effortlessly-mcp/releases/tag/v1.0.0
