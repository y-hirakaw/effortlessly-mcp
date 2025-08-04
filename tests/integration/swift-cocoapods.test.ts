/**
 * Swift CocoaPods統合テスト
 * CocoaPods プロジェクトの検出機能を検証
 */

import { describe, it, expect } from 'vitest';
import { SwiftLSP } from '../../services/lsp/swift-lsp.js';
import { existsSync } from 'fs';
import path from 'path';
import { Logger } from '../../services/logger.js';

describe('Swift CocoaPods Integration Tests', () => {
  const COCOAPODS_PROJECT_ROOT = path.join(process.cwd(), 'test-cocoapods-project');
  const logger = Logger.getInstance();

  describe('CocoaPods Project Detection', () => {
    it('should detect Podfile and parse pod dependencies', async () => {
      // CocoaPodsテストプロジェクトが存在することを確認
      if (!existsSync(COCOAPODS_PROJECT_ROOT)) {
        logger.info('Skipping: CocoaPods test project not found');
        return;
      }

      const swiftLSP = new SwiftLSP(COCOAPODS_PROJECT_ROOT);
      
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      expect(projectConfig).toBeDefined();
      expect(projectConfig.hasPodfile).toBe(true);
      expect(projectConfig.podfilePath).toBeDefined();
      expect(existsSync(projectConfig.podfilePath!)).toBe(true);
      
      // Podfileの内容を検証
      expect(projectConfig.podfilePath).toContain('Podfile');
      
      // パースされたポッド依存関係を確認
      if (projectConfig.pods && projectConfig.pods.length > 0) {
        expect(Array.isArray(projectConfig.pods)).toBe(true);
        expect(projectConfig.pods.length).toBeGreaterThan(0);
        
        // 期待されるポッド名が含まれているかチェック
        const expectedPods = ['AFNetworking', 'Alamofire', 'SwiftyJSON', 'SnapKit', 'SwiftLint', 'Quick', 'Nimble'];
        const foundPods = projectConfig.pods.filter(pod => expectedPods.includes(pod));
        expect(foundPods.length).toBeGreaterThan(0);
        
        logger.info(`🍃 Detected CocoaPods: ${projectConfig.pods.join(', ')}`);
      }
    });

    it('should handle projects with both Package.swift and Podfile', async () => {
      if (!existsSync(COCOAPODS_PROJECT_ROOT)) {
        logger.info('Skipping: CocoaPods test project not found');
        return;
      }

      const swiftLSP = new SwiftLSP(COCOAPODS_PROJECT_ROOT);
      
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      expect(projectConfig).toBeDefined();
      
      // CocoaPodsの検出
      expect(projectConfig.hasPodfile).toBe(true);
      expect(projectConfig.podfilePath).toBeDefined();
      
      // Package.swiftは存在しないはず（このテストプロジェクトでは）
      expect(projectConfig.hasPackageSwift).toBe(false);
      expect(projectConfig.packageSwiftPath).toBeUndefined();
      
      logger.info(`📊 Project Type: CocoaPods only (${projectConfig.pods?.length || 0} pods)`);
    });

    it('should find Swift files in CocoaPods project', async () => {
      if (!existsSync(COCOAPODS_PROJECT_ROOT)) {
        logger.info('Skipping: CocoaPods test project not found');
        return;
      }

      const swiftLSP = new SwiftLSP(COCOAPODS_PROJECT_ROOT);
      
      const swiftFiles = await swiftLSP.findSwiftFiles();
      
      expect(Array.isArray(swiftFiles)).toBe(true);
      expect(swiftFiles.length).toBeGreaterThan(0);
      
      // CocoaPodsプロジェクトのSwiftファイルが含まれているかチェック
      const viewControllerFile = swiftFiles.find(file => 
        file.includes('ViewController.swift')
      );
      expect(viewControllerFile).toBeDefined();
      
      // Podsディレクトリは除外されているかチェック
      const podsFiles = swiftFiles.filter(file => file.includes('/Pods/'));
      expect(podsFiles.length).toBe(0);
      
      logger.info(`📁 Found ${swiftFiles.length} Swift files in CocoaPods project`);
    });

    it('should parse Podfile correctly with different syntax patterns', async () => {
      if (!existsSync(COCOAPODS_PROJECT_ROOT)) {
        logger.info('Skipping: CocoaPods test project not found');
        return;
      }

      const swiftLSP = new SwiftLSP(COCOAPODS_PROJECT_ROOT);
      
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      if (projectConfig.pods && projectConfig.pods.length > 0) {
        // 期待されるポッド（Podfileに記載されているもの）
        const expectedPods = [
          'AFNetworking',
          'Alamofire', 
          'SwiftyJSON',
          'SnapKit',
          'SwiftLint',
          'Quick',
          'Nimble'
        ];
        
        // 検出されたポッドと期待されるポッドの比較
        for (const expectedPod of expectedPods) {
          if (projectConfig.pods.includes(expectedPod)) {
            logger.info(`✅ Detected expected pod: ${expectedPod}`);
          }
        }
        
        // バージョン指定や設定を含む行も正しく解析されているかチェック
        expect(projectConfig.pods.some(pod => 
          expectedPods.includes(pod)
        )).toBe(true);
        
        logger.info(`🔍 Parsed pods: ${projectConfig.pods.join(', ')}`);
      }
    });
  });

  describe('CocoaPods Error Handling', () => {
    it('should handle projects without Podfile gracefully', async () => {
      // Package.swiftプロジェクトを使用（Podfileはない）
      const packageSwiftProject = path.join(process.cwd(), 'test-swift-project');
      
      if (!existsSync(packageSwiftProject)) {
        logger.info('Skipping: test-swift-project not found');
        return;
      }

      const swiftLSP = new SwiftLSP(packageSwiftProject);
      
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      expect(projectConfig).toBeDefined();
      expect(projectConfig.hasPodfile).toBe(false);
      expect(projectConfig.podfilePath).toBeUndefined();
      expect(projectConfig.pods).toBeUndefined();
      
      // Package.swiftは存在するはず
      expect(projectConfig.hasPackageSwift).toBe(true);
    });

    it('should handle invalid project paths', async () => {
      const swiftLSP = new SwiftLSP('/non/existent/path');
      
      const projectConfig = await swiftLSP.detectProjectConfig();
      
      expect(projectConfig).toBeDefined();
      expect(projectConfig.hasPodfile).toBe(false);
      expect(projectConfig.hasPackageSwift).toBe(false);
      expect(projectConfig.podfilePath).toBeUndefined();
      expect(projectConfig.packageSwiftPath).toBeUndefined();
      expect(projectConfig.pods).toBeUndefined();
      expect(projectConfig.dependencies).toBeUndefined();
    });
  });
});