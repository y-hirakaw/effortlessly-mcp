#!/usr/bin/env node

/**
 * プロジェクトメモリ管理システムの統合テスト
 */

import { ToolRegistry } from './build/tools/registry.js';
import { Logger } from './build/services/logger.js';

async function runProjectMemoryTest() {
  console.log('🧠 プロジェクトメモリ管理システムテスト開始...\n');
  
  const logger = Logger.getInstance();
  const toolRegistry = ToolRegistry.getInstance();
  
  // 利用可能なツールを確認
  console.log('📋 登録済みツール一覧:');
  const toolNames = toolRegistry.getToolNames();
  toolNames.forEach(name => console.log(`  • ${name}`));
  
  // プロジェクトメモリツールの存在確認
  const memoryTools = [
    'project_memory_write',
    'project_memory_read', 
    'project_memory_list'
  ];
  
  console.log('\n🔍 プロジェクトメモリツール確認:');
  for (const toolName of memoryTools) {
    const exists = toolRegistry.hasTool(toolName);
    console.log(`  ${toolName}: ${exists ? '✅' : '❌'}`);
    
    if (exists) {
      const tool = toolRegistry.getTool(toolName);
      console.log(`    説明: ${tool.metadata.description}`);
      console.log(`    パラメータ: ${Object.keys(tool.metadata.parameters).join(', ')}`);
    }
  }
  
  // 実際のツール実行テスト（ワークスペースが必要）
  console.log('\n⚠️  注意: 実際のツール実行にはアクティブなワークスペースが必要です');
  console.log('次のコマンドでワークスペースを作成できます:');
  console.log('workspace_activate tool を使用してワークスペースを有効化');
  
  try {
    // ワークスペースツールの存在確認
    const workspaceTools = [
      'workspace_activate',
      'workspace_get_info',
      'workspace_list_all'
    ];
    
    console.log('\n🏗️  ワークスペース管理ツール確認:');
    for (const toolName of workspaceTools) {
      const exists = toolRegistry.hasTool(toolName);
      console.log(`  ${toolName}: ${exists ? '✅' : '❌'}`);
    }
    
    // 基本的なツール情報テスト
    console.log('\n📊 プロジェクトメモリツール詳細:');
    
    if (toolRegistry.hasTool('project_memory_write')) {
      const writeTool = toolRegistry.getTool('project_memory_write');
      console.log('\n📝 project_memory_write:');
      console.log(`  名前: ${writeTool.metadata.name}`);
      console.log(`  説明: ${writeTool.metadata.description}`);
      console.log('  必須パラメータ:');
      Object.entries(writeTool.metadata.parameters).forEach(([key, param]) => {
        if (param.required) {
          console.log(`    • ${key}: ${param.description}`);
        }
      });
      console.log('  オプションパラメータ:');
      Object.entries(writeTool.metadata.parameters).forEach(([key, param]) => {
        if (!param.required) {
          console.log(`    • ${key}: ${param.description}`);
        }
      });
    }
    
    if (toolRegistry.hasTool('project_memory_read')) {
      const readTool = toolRegistry.getTool('project_memory_read');
      console.log('\n📖 project_memory_read:');
      console.log(`  名前: ${readTool.metadata.name}`);
      console.log(`  説明: ${readTool.metadata.description}`);
      console.log('  必須パラメータ:');
      Object.entries(readTool.metadata.parameters).forEach(([key, param]) => {
        if (param.required) {
          console.log(`    • ${key}: ${param.description}`);
        }
      });
    }
    
    if (toolRegistry.hasTool('project_memory_list')) {
      const listTool = toolRegistry.getTool('project_memory_list');
      console.log('\n📋 project_memory_list:');
      console.log(`  名前: ${listTool.metadata.name}`);
      console.log(`  説明: ${listTool.metadata.description}`);
      console.log('  パラメータ:');
      Object.entries(listTool.metadata.parameters).forEach(([key, param]) => {
        console.log(`    • ${key}: ${param.description} (${param.required ? '必須' : 'オプション'})`);
      });
    }
    
    console.log('\n✅ プロジェクトメモリシステムの基本構造テスト完了！');
    console.log('\n💡 次のステップ:');
    console.log('1. workspace_activate でワークスペースを有効化');
    console.log('2. project_memory_write でテストデータを保存');
    console.log('3. project_memory_read でデータを読み取り');
    console.log('4. project_memory_list で一覧を確認');
    
    return true;
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// メイン実行
runProjectMemoryTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });