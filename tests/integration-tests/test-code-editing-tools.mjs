#!/usr/bin/env node

/**
 * 精密コード編集ツール群の統合テスト
 */

import { ToolRegistry } from './build/tools/registry.js';
import { Logger } from './build/services/logger.js';

async function runCodeEditingToolsTest() {
  console.log('✂️ 精密コード編集ツール群テスト開始...\n');
  
  const logger = Logger.getInstance();
  const toolRegistry = ToolRegistry.getInstance();
  
  // 精密編集ツールの存在確認
  const editingTools = [
    'code_replace_symbol_body',
    'code_insert_at_symbol',
    'code_replace_with_regex'
  ];
  
  console.log('🔍 精密コード編集ツール確認:');
  for (const toolName of editingTools) {
    const exists = toolRegistry.hasTool(toolName);
    console.log(`  ${toolName}: ${exists ? '✅' : '❌'}`);
    
    if (!exists) {
      console.error(`❌ ${toolName} ツールが登録されていません`);
      return false;
    }
  }
  
  console.log('\n📋 各ツールの詳細情報:');
  
  try {
    // 1. Symbol Body Replace Tool テスト
    console.log('\n🔧 code_replace_symbol_body:');
    const replaceBodyTool = toolRegistry.getTool('code_replace_symbol_body');
    console.log(`  説明: ${replaceBodyTool.metadata.description}`);
    console.log('  必須パラメータ:');
    Object.entries(replaceBodyTool.metadata.parameters).forEach(([key, param]) => {
      if (param.required) {
        console.log(`    • ${key}: ${param.description}`);
      }
    });
    console.log('  オプションパラメータ:');
    Object.entries(replaceBodyTool.metadata.parameters).forEach(([key, param]) => {
      if (!param.required) {
        console.log(`    • ${key}: ${param.description}`);
      }
    });
    
    // 2. Insert At Symbol Tool テスト
    console.log('\n📍 code_insert_at_symbol:');
    const insertTool = toolRegistry.getTool('code_insert_at_symbol');
    console.log(`  説明: ${insertTool.metadata.description}`);
    console.log('  必須パラメータ:');
    Object.entries(insertTool.metadata.parameters).forEach(([key, param]) => {
      if (param.required) {
        console.log(`    • ${key}: ${param.description}`);
      }
    });
    console.log('  オプションパラメータ:');
    Object.entries(insertTool.metadata.parameters).forEach(([key, param]) => {
      if (!param.required) {
        console.log(`    • ${key}: ${param.description}`);
      }
    });
    
    // 3. Regex Replace Tool テスト
    console.log('\n🔤 code_replace_with_regex:');
    const regexTool = toolRegistry.getTool('code_replace_with_regex');
    console.log(`  説明: ${regexTool.metadata.description}`);
    console.log('  必須パラメータ:');
    Object.entries(regexTool.metadata.parameters).forEach(([key, param]) => {
      if (param.required) {
        console.log(`    • ${key}: ${param.description}`);
      }
    });
    console.log('  オプションパラメータ:');
    Object.entries(regexTool.metadata.parameters).forEach(([key, param]) => {
      if (!param.required) {
        console.log(`    • ${key}: ${param.description}`);
      }
    });
    
    // 4. 登録済みツール総数確認
    console.log('\n📊 登録済み全ツール統計:');
    const allTools = toolRegistry.getAllTools();
    console.log(`  総ツール数: ${allTools.size}`);
    
    // カテゴリ別集計
    const categories = {
      '基本操作': ['echo'],
      'ファイル操作': ['read_file', 'list_directory', 'get_file_metadata', 'search_files'],
      'プロジェクト管理': ['workspace_activate', 'workspace_get_info', 'workspace_list_all'],
      'コード解析': ['code_find_symbol', 'code_find_references', 'code_get_symbol_hierarchy', 'code_analyze_dependencies', 'code_search_pattern', 'code_find_referencing_symbols', 'code_get_symbols_overview'],
      'プロジェクト知識': ['project_memory_write', 'project_memory_read', 'project_memory_list'],
      'ワークフロー': ['project_update_workflow'],
      '精密編集': ['code_replace_symbol_body', 'code_insert_at_symbol', 'code_replace_with_regex']
    };
    
    console.log('\n  カテゴリ別内訳:');
    Object.entries(categories).forEach(([category, toolNames]) => {
      const count = toolNames.filter(name => toolRegistry.hasTool(name)).length;
      console.log(`    ${category}: ${count}/${toolNames.length}ツール`);
    });
    
    console.log('\n✅ 精密コード編集ツール群の基本構造テスト完了！');
    console.log('\n💡 使用例:');
    console.log('1. 関数本体置換: code_replace_symbol_body symbol_path="myFunction" new_body="return newValue;"');
    console.log('2. シンボル前後挿入: code_insert_at_symbol target_symbol="MyClass" position="after" content="// 新しいコメント"');
    console.log('3. 正規表現置換: code_replace_with_regex file_path="src/main.ts" pattern="old(\\\\w+)" replacement="new$1" flags="g"');
    
    console.log('\n⚠️  注意事項:');
    console.log('• バックアップは自動作成されます (.claude/workspace/effortlessly/backups/)');
    console.log('• LSP接続が必要なツールは事前にワークスペース有効化が必要です');
    console.log('• プレビューモードで事前確認することを推奨します');
    
    return true;
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// メイン実行
runCodeEditingToolsTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });