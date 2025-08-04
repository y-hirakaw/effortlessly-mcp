#!/usr/bin/env node

/**
 * プロジェクト更新ワークフローツールのテスト
 */

import { ToolRegistry } from './build/tools/registry.js';
import { Logger } from './build/services/logger.js';

async function testWorkflowTool() {
  console.log('🔄 プロジェクト更新ワークフローツールテスト開始...\n');
  
  const logger = Logger.getInstance();
  const toolRegistry = ToolRegistry.getInstance();
  
  // ツールの存在確認
  const toolName = 'project_update_workflow';
  const hasTool = toolRegistry.hasTool(toolName);
  console.log(`🔍 ${toolName}ツール: ${hasTool ? '✅ 登録済み' : '❌ 未登録'}`);
  
  if (!hasTool) {
    console.error('❌ ツールが登録されていません');
    return false;
  }
  
  const tool = toolRegistry.getTool(toolName);
  console.log(`📋 説明: ${tool.metadata.description}`);
  console.log(`🔧 パラメータ: ${Object.keys(tool.metadata.parameters).join(', ')}\n`);
  
  try {
    // テスト1: 利用可能タスクの一覧表示
    console.log('📋 テスト1: 利用可能タスクの一覧表示');
    console.log('実行: project_update_workflow (パラメータなし)\n');
    
    const listResult = await tool.execute({});
    const listData = JSON.parse(listResult.content[0].text);
    
    console.log('🎯 利用可能タスク:');
    Object.entries(listData.available_tasks).forEach(([taskName, taskInfo]) => {
      console.log(`  • ${taskName}: ${taskInfo.description}`);
      console.log(`    推定時間: ${taskInfo.estimated_time}`);
      console.log(`    用途: ${taskInfo.use_cases.slice(0, 2).join(', ')}${taskInfo.use_cases.length > 2 ? '...' : ''}`);
      console.log('');
    });
    
    // テスト2: 特定ワークフローのプレビュー
    console.log('📋 テスト2: プロジェクト構造インデックス更新のプレビュー');
    console.log('実行: project_update_workflow task="structure_index" preview=true\n');
    
    const previewResult = await tool.execute({
      task: 'structure_index',
      preview: true
    });
    const previewData = JSON.parse(previewResult.content[0].text);
    
    console.log(`📊 ワークフロー: ${previewData.workflow_name}`);
    console.log(`⏱️  推定時間: ${previewData.estimated_time}`);
    console.log(`📝 説明: ${previewData.description}\n`);
    
    console.log('🔄 実行手順:');
    previewData.steps.forEach(step => {
      console.log(`  ${step.step}. ${step.tool}`);
      console.log(`     目的: ${step.purpose}`);
      if (step.expected_output) {
        console.log(`     期待出力: ${step.expected_output}`);
      }
      console.log('');
    });
    
    if (previewData.next_actions) {
      console.log('🔄 次のアクション:');
      previewData.next_actions.forEach(action => {
        console.log(`  • ${action}`);
      });
      console.log('');
    }
    
    // テスト3: 実行用ワークフロー生成
    console.log('📋 テスト3: 実行用ワークフロー生成');
    console.log('実行: project_update_workflow task="structure_index" scope="full"\n');
    
    const execResult = await tool.execute({
      task: 'structure_index',
      scope: 'full'
    });
    const execData = JSON.parse(execResult.content[0].text);
    
    console.log(`📊 実行用ワークフロー: ${execData.workflow_name}`);
    console.log(`🎯 ステップ数: ${execData.steps.length}`);
    console.log(`⏱️  推定時間: ${execData.estimated_time}\n`);
    
    console.log('📝 実行手順（詳細版）:');
    execData.steps.forEach(step => {
      console.log(`  ${step.step}. [${step.tool}]`);
      console.log(`     パラメータ: ${JSON.stringify(step.params)}`);
      console.log(`     目的: ${step.purpose}`);
      console.log('');
    });
    
    // テスト4: 他のワークフロー種類の確認
    console.log('📋 テスト4: 依存関係マップ更新ワークフロー');
    console.log('実行: project_update_workflow task="dependencies_map" preview=true\n');
    
    const depsResult = await tool.execute({
      task: 'dependencies_map',
      preview: true
    });
    const depsData = JSON.parse(depsResult.content[0].text);
    
    console.log(`📊 ワークフロー: ${depsData.workflow_name}`);
    console.log(`🔄 ステップ数: ${depsData.steps.length}`);
    console.log(`⏱️  推定時間: ${depsData.estimated_time}\n`);
    
    // テスト5: 不正なタスク名での確認
    console.log('📋 テスト5: 不正なタスク名でのエラーハンドリング');
    console.log('実行: project_update_workflow task="invalid_task"\n');
    
    const errorResult = await tool.execute({
      task: 'invalid_task'
    });
    
    if (errorResult.isError) {
      console.log('✅ 適切にエラーハンドリングされました');
      console.log(`エラー内容: ${errorResult.content[0].text}\n`);
    }
    
    console.log('🎉 すべてのテストが完了しました！');
    
    console.log('\n💡 実際の使用例:');
    console.log('1. 利用可能タスクを確認: project_update_workflow');
    console.log('2. 手順をプレビュー: project_update_workflow task="structure_index" preview=true');
    console.log('3. 実行用手順を取得: project_update_workflow task="structure_index" scope="full"');
    console.log('4. AIが手順に従って実際のツールを順次実行');
    
    return true;
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// メイン実行
testWorkflowTool()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });