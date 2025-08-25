# Requirements and Design Document (RDD) v2.0

## エグゼクティブサマリー

effortlessly-mcpは、Claude Code向けの実用的なMCPサーバーとして、**ファイル編集**、**プロジェクト管理**、**ワークフロー自動化**に特化した開発を進めます。LSP統合機能は最小限に縮小し、ユーザーが本当に必要とする機能に集中します。

## 1. プロジェクト目標

### 1.1 ビジョン
シンプルで確実、そして強力なファイル操作とプロジェクト管理機能を提供し、Claude Codeユーザーの生産性を最大化する。

### 1.2 コア価値提案
- **確実性**: 100%動作する基本機能
- **速度**: 高速なファイル操作とレスポンス
- **簡潔性**: セットアップと使用が簡単
- **拡張性**: ワークフロー自動化による生産性向上

## 2. 機能要件

### 2.1 優先度1: コアファイル操作機能 ✅ **実装済み・強化予定**

#### 2.1.1 スマート編集機能
```typescript
// 現在の機能（維持・強化）
- smart_edit_file: テキスト置換、バックアップ、プレビュー
- smart_insert_text: 柔軟な位置指定挿入
- override_text: 安全な完全上書き

// 新規追加機能
- batch_edit: 複数ファイルの一括編集
- template_apply: テンプレートベースの編集
- regex_replace_multi: 複数パターンの一括置換
```

#### 2.1.2 高速ファイル読み込み機能
```typescript
// 複数範囲一括読み込み機能（read_file拡張）
read_file({
  file_path: "src/UserService.ts",
  ranges: [
    {start: 10, end: 50, label: "クラス定義"},
    {start: 200, end: 250, label: "メソッド実装"},
    {start: 800, end: 850, label: "使用例・テスト"}
  ]
})

// 効果
- レスポンス速度: 3倍以上高速化（往復回数削減）
- AI効率化: 複数箇所の文脈を保持したまま分析可能
- 使用場面: 関数定義・使用箇所・テスト確認、バグ調査、コードレビュー

// 従来 vs 新機能
従来: read_file × 3回実行 → 3往復の遅延
新機能: read_file × 1回実行 → 1往復、複数範囲同時取得

// AI強化機能: smart_range_optimizer（新規追加）
smart_range_optimizer: {
  // AIによる最適読み込み範囲の自動提案
  suggest_optimal_ranges: (file_path, intent) => OptimalRange[]
  
  // 使用例
  optimizer.suggest_ranges("UserService.ts", "バグ調査") => [
    {start: 10, end: 50, label: "クラス定義", relevance: 0.9},
    {start: 200, end: 250, label: "問題のメソッド", relevance: 0.95},
    {start: 800, end: 850, label: "関連テスト", relevance: 0.85}
  ]
  
  // 期待効果
  - 読み込み精度: 70% → 95%
  - 不要データ削減: 60%
  - AI応答速度: 50%向上
  - ROI: 400%（実装工数2-3週間）
}
```

#### 2.1.3 高度な検索機能
```typescript
// 現在の機能（維持）
- search_files: ファイル名・内容検索
- list_directory: ディレクトリ一覧

// 新規追加機能
- fuzzy_search: あいまい検索
- content_index: 高速全文検索インデックス
- search_history: 検索履歴と再利用

// AI強化機能: search_learning_engine（新規追加）
search_learning_engine: {
  // 検索履歴から学習して検索精度を向上
  learn_search_patterns: (history) => OptimizedQuery[]
  optimize_content_index: (usage_stats) => IndexStrategy
  
  // 使用例
  engine.learn_patterns(searchHistory) => {
    common_patterns: ["class.*Service", "function.*test"],
    personalized_shortcuts: {"bugs": "error|exception|fail"},
    optimization_suggestions: ["Use file_pattern for *.ts files"]
  }
  
  // 期待効果
  - 検索精度: 60% → 90%
  - 検索時間: 50%短縮
  - キャッシュヒット率: 30% → 80%
  - ROI: 350%（実装工数1-2週間）
}
```

### 2.2 優先度2: プロジェクトメモリ機能 ✅ **実装済み・AI強化予定**

#### 2.2.1 知識管理システム
```typescript
// 現在の機能（維持）
- project_memory_write/read: 知識の保存と読み取り
- project_memory_list: 保存済み知識一覧

// 新規追加機能
- smart_memory_organize: AI駆動の知識整理
- memory_suggest: 文脈に応じた知識提案
- memory_template: プロジェクトタイプ別テンプレート
- auto_document: コードから自動文書生成
```

#### 2.2.2 プロジェクトコンテキスト
```typescript
// 新規機能
- context_capture: プロジェクト状態の自動記録
- context_restore: 以前の状態への復元
- context_share: チーム間でのコンテキスト共有
```

### 2.3 優先度3: ワークフロー自動化 🆕 **新規開発**

#### 2.3.1 タスク自動化
```typescript
interface WorkflowTask {
  name: string;
  trigger: 'manual' | 'file_change' | 'schedule' | 'pattern';
  actions: Action[];
  conditions?: Condition[];
}

// 実装予定機能
- workflow_create: ワークフロー定義
- workflow_execute: ワークフロー実行
- workflow_schedule: スケジュール実行
- workflow_monitor: 実行状況監視
```

#### 2.3.2 ファイル監視と自動処理
```typescript
// 新規機能
- watch_files: ファイル変更監視
- auto_format: 自動フォーマット適用
- auto_backup: 変更時自動バックアップ
- change_notification: 変更通知
```

### 2.4 優先度4: チーム連携機能 🆕 **将来開発**

```typescript
// 将来的な拡張
- shared_workspace: 共有ワークスペース
- conflict_resolution: 競合解決支援
- review_workflow: レビューワークフロー
```

## 3. 非機能要件

### 3.1 パフォーマンス目標
- ファイル読み込み: <50ms
- 検索応答: <100ms
- 編集操作: <100ms
- メモリ使用量: <200MB（LSP削減により大幅改善）

### 3.2 信頼性
- エラー率: <0.1%
- 自動リカバリー: 100%のケースで実装
- データ保護: 全編集操作でバックアップ

### 3.3 使いやすさ
- セットアップ時間: <5分
- 学習曲線: 基本機能は即座に使用可能
- ドキュメント: 全機能に実例付き

## 4. 技術設計

### 4.1 アーキテクチャ簡素化

```
旧アーキテクチャ（複雑）:
Claude Code → MCP Server → HTTP Proxy → LSP Servers → Files

新アーキテクチャ（シンプル）:
Claude Code → MCP Server → File System
                  ↓
            SQLite Index
```

### 4.2 コンポーネント削減

#### 削除・縮小するコンポーネント
- ❌ LSP Proxy Server（最小限のTypeScript LSPのみ残す）
- ❌ Swift LSP統合
- ❌ Java LSP統合  
- ❌ 複雑な依存関係解析

#### 強化するコンポーネント
- ✅ FileSystemService（バッチ操作、テンプレート）
- ✅ ProjectMemoryService（AI機能、自動整理）
- ✅ WorkspaceManager（ワークフロー管理）
- ✅ SQLiteインデックス（高速検索）

### 4.3 データモデル

```typescript
// シンプルなファイル操作モデル
interface FileOperation {
  type: 'edit' | 'insert' | 'delete' | 'create';
  path: string;
  content?: string;
  backup?: boolean;
  preview?: boolean;
}

// プロジェクトメモリモデル
interface ProjectMemory {
  id: string;
  category: 'knowledge' | 'pattern' | 'workflow' | 'documentation';
  content: string;
  metadata: {
    created: Date;
    updated: Date;
    tags: string[];
    relations: string[];
  };
}

// ワークフローモデル
interface Workflow {
  id: string;
  name: string;
  triggers: Trigger[];
  steps: Step[];
  schedule?: CronExpression;
}
```

## 5. 実装計画

### Phase 1: LSP機能の縮小（Week 1-2） ✅ **完了**
- [x] Swift/Java LSP機能を非推奨化
- [x] TypeScript LSPを最小機能に縮小  
- [x] **10個のLSPツールを完全無効化**（2025-01-25完了）
- [x] ドキュメント更新

### Phase 2: コア機能強化（Week 3-4）
- [ ] **smart_range_optimizer機能の実装**（優先度1: ROI 400%）
- [ ] **search_learning_engine機能の実装**（優先度2: ROI 350%）
- [ ] batch_edit機能の実装
- [ ] template_apply機能の実装
- [ ] smart_memory_organize機能の実装
- [ ] パフォーマンス最適化

### Phase 3: ワークフロー基盤（Month 2）
- [ ] workflow_createの実装
- [ ] workflow_executeの実装
- [ ] watch_filesの実装
- [ ] auto_format/auto_backupの実装

### Phase 4: 高度な機能（Month 3）
- [ ] AI駆動のメモリ整理
- [ ] 自動文書生成
- [ ] ワークフローテンプレート
- [ ] チーム連携基盤

## 6. 成功指標

### 6.1 技術指標
- ✅ **MCPツール削減**: 23個 → 13個（43%削減完了）
- ✅ **LSP機能無効化**: 10個のLSPツール完全無効化完了
- 🎯 **目標**: LSP関連コード70%削減（8,000行 → 2,400行）
- 🎯 **目標**: 全操作で応答時間50%改善
- 🎯 **目標**: エラー率90%削減

### 6.2 ユーザー指標
- セットアップ成功率: 95%以上
- 基本機能使用率: 80%以上
- ユーザー満足度: 4.5/5.0以上

### 6.3 開発効率
- バグ修正時間: 70%削減
- 新機能追加時間: 50%削減
- テスト実行時間: 60%削減

## 7. リスクと対策

### 7.1 移行リスク
- **リスク**: 既存のLSPユーザーからの反発
- **対策**: TypeScript LSPは維持、段階的な移行サポート

### 7.2 機能不足リスク
- **リスク**: セマンティック検索が必要なユーザー
- **対策**: 高度なテキスト検索とインデックス機能で代替

### 7.3 競合リスク
- **リスク**: 他のMCPサーバーとの差別化不足
- **対策**: project_memory、ワークフロー機能での独自性確保

## 8. まとめ

effortlessly-mcp v2.0は、**複雑さを捨てて実用性を取る**戦略的な方向転換です。LSP統合という技術的挑戦から、ユーザーが本当に必要とする確実で高速なファイル操作とプロジェクト管理機能に注力することで、より多くのユーザーに価値を提供できるMCPサーバーを目指します。

**次のステップ**:
1. このRDDの承認
2. LSP機能の段階的縮小開始
3. コア機能強化の実装
4. ユーザーフィードバックの収集と反映

---
*Document Version: 2.0*  
*Created: 2025-01-25*  
*Status: Draft*