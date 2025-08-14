# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.11] - 2025-08-14

### Added
- 🗃️ **override_text機能の実装**
  - ファイル全体の安全な上書き機能を追加
  - 自動バックアップ機能付きでリスク軽減
  - プレビューモード対応で事前確認可能
  - セキュリティ警告表示で高リスク操作の明確化
  - 新規ファイル作成・既存ファイル完全置換の両対応

### Enhanced
- 🛡️ **ファイル操作安全性の強化**
  - タイムスタンプ付きバックアップファイル自動生成
  - ファイルサイズ制限とセキュリティ警告機能
  - 操作メタデータ（元サイズ、新サイズ、バックアップパス）の詳細提供

### Technical Details
- 新規ファイル: `src/tools/file-operations/override-text.ts`
- 対応テスト: `src/tools/file-operations/override-text.test.ts`
- バックアップ保存先: `.claude/workspace/effortlessly/backups/`

## [1.0.10] - 2025-08-11

### Added
- 🔧 **ワークスペース設定自動生成機能**
  - `workspace_activate` 実行時に `.claude/workspace/effortlessly/config.yaml` を自動生成
  - ワークスペース固有の設定（LSPサーバー、インデックス設定、ログ設定等）を統一フォーマットで出力
  - 既存の統合config.yamlとの互換性を保持

### Changed
- 🏗️ **ワークスペース構造の最適化**
  - `configフォルダ`の生成を廃止、設定ファイルを直接 `.claude/workspace/effortlessly/config.yaml` に統一
  - デフォルトLSPサーバーを `['typescript']` に変更（従来の `['typescript', 'python']` から簡素化）
  - デフォルト設定値を既存設定ファイルと完全統一

### Fixed
- 🐛 **設定管理の改善**
  - ワークスペース活性化時の設定ファイル作成処理を確実に実行
  - TypeScriptビルドエラーの修正（未使用パラメータ、型エラー等）

## [1.0.9] - 2025-08-10

### Added
- 🧪 **Java LSP統合（検証中）**
  - Eclipse JDT Language Server統合による基本診断機能
  - `java_lsp_basic_diagnostics`: Java LSPの基本状態確認・エラー統計ツール
  - `java_lsp_diagnostics`: Java LSP包括的診断・トラブルシューティングツール
  - Phase 2A エラーハンドリングシステム実装
    - 基本的なエラー記録とカウント機能
    - LSP接続状態の監視とヘルスチェック
    - 診断結果の日本語表示対応
- 🚀 **プロジェクトメモリ管理システム改善**
  - `project_update_workflow` → `project_memory_update_workflow` に改名して機能の明確化
  - プロジェクトメモリ分類システムの導入（generic/project_specific/template）
  - 各分類に特化した適切なプロンプト自動生成システム
- 📂 **メモリ分類システム**
  - `generic/`: 汎用・再利用可能な知識（他プロジェクトでも活用可能）
  - `project_specific/`: effortlessly-mcp固有の実装情報
  - `templates/`: 新規プロジェクト用のテンプレート構造
- 🎯 **分類対応プロンプト生成機能**
  - テンプレート用：プレースホルダー置換による構造化ドキュメント生成
  - 汎用用：再利用可能な知識として価値のある内容重視
  - プロジェクト固有用：実装固有の詳細な技術情報記録

### Changed
- ⚡ **Swift LSP パフォーマンス向上**
  - `swift --version` コマンドタイムアウトを120秒→3秒に最適化
  - vitest設定でテストタイムアウトを10秒に延長
  - Swift LSP関連テスト全10件の安定動作実現
- 📈 **テスト品質大幅向上**
  - 全テスト数: 282 → **551テスト**（196%増加）
  - テスト成功率: **100%維持**（失敗0件）
  - DiffLoggerテストの非同期処理対応とmock修正

### Fixed
- 🔧 **テスト安定性改善**
  - DiffLoggerテストにおけるLogManager統合への対応
  - 実装の詳細ではなく動作保証に重点を置いたテスト設計
  - 全テストスイートでの一貫した成功を実現

### Technical Details
- ファイル改名: `src/tools/project-update-workflow.ts` → `src/tools/project-memory-update-workflow.ts`
- 新規ディレクトリ構造: `.claude/workspace/effortlessly/memory/{generic,project_specific,templates}/`
- テスト実行時間: 約20秒（最適化により短縮）
- コミットハッシュ: 7c2ef3f

## [1.0.8] - 2025-08-09

### Added
- 🎯 **LSP設定システム改善**
  - 新しい `enabled_languages` リスト形式による直感的な言語サーバー選択
  - 各言語サーバーの詳細設定を `language_configurations` セクションに分離
  - コメントアウト（`# - python`）による簡単な有効/無効切り替え
  - 利用可能言語とセットアップ要件の包括的なドキュメント化
- 🚀 **LSP自動起動機能統合**
  - AutoWorkspaceManagerにLSP自動初期化機能を追加
  - LSPManager、LSPAutoLauncher、LSPDependencyManager の統合
  - ワークスペースアクティベーション時のLSPサーバー自動起動
  - 依存関係の自動検出・インストール機能

### Changed
- 📖 **設定構造の大幅改善**
  - 従来の複雑な階層構造（`lsp_servers.supported_languages.{language}.enabled`）を簡素化
  - 設定の可視性向上：有効な言語が一目で確認可能
  - 保守性向上：新しい言語の追加が容易
  - エラーの削減：YAML構造エラーのリスク最小化
- 🔧 **ドキュメント更新**
  - `docs/RDD/RDD_lsp.md` を最新の設定構造で更新
  - 設定改善の利点を詳細に説明
  - `docs/RDD/RDD_ts_lsp.md` を統合・再構成

### Fixed
- ⚡ **LSP動作検証**
  - Claude Code再起動後のLSP自動起動動作確認完了
  - TypeScript Language Server（PID: 66330）とSwift SourceKit-LSP（PID: 66515）の正常動作確認
  - LSPプロキシサーバー（ポート3001）の安定動作確認

### Technical Details
- Package version: 1.0.7 → 1.0.8
- 12ファイル変更、2379行追加、535行削除
- 新規ファイル：4つのLSP関連コンポーネント
- テストファイル追加：LSP自動起動機能の統合テスト

## [1.0.7] - 2025-08-09

### Added
- 🚀 **LSP自動起動とワークスペース管理統合システム**
  - AutoWorkspaceManagerによる自動ワークスペース検出・アクティベーション
  - プロジェクトタイプ自動判定とLSPサーバー自動選択
  - LSPサーバー自動起動機能の基盤実装
- 📦 **新規ファイル作成時のdiff表示機能**
  - 新規ファイル作成時の視覚的フィードバック強化
  - 作成前/作成後の差分表示でファイル内容確認可能

### Enhanced
- ⚡ **workspace_activate大幅高速化**
  - LSP/インデックス自動起動対応
  - プロジェクト設定の自動検出と適用
- 🔧 **全10のコード解析ツールでLSP自動起動対応**
  - LSPサーバーが起動していない場合の自動起動
  - シンボル検索、参照検索、階層取得等の信頼性向上

### Technical Infrastructure
- LSPAutoLauncher, LSPDependencyManager基盤コンポーネント追加
- AutoWorkspaceConfigManager実装
- 統合テストスイート拡充

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
