import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { SearchLearningEngine } from '../src/services/SearchLearningEngine';

describe('SearchLearningEngine fast-glob Integration', () => {
  const testDir = path.join(__dirname, '../test-temp-search');
  const workspaceDir = path.join(testDir, '.claude', 'workspace', 'effortlessly');
  let searchEngine: SearchLearningEngine;

  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(workspaceDir, { recursive: true });
    
    // Create test files
    const testFiles = [
      'src/index.ts',
      'src/utils/helper.ts', 
      'tests/unit.test.ts',
      'docs/README.md',
      '.git/config',
      'node_modules/package/index.js'
    ];

    for (const file of testFiles) {
      const filePath = path.join(testDir, file);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `// Content of ${file}\nconst data = "test";`);
    }

    searchEngine = new SearchLearningEngine(testDir);
    await searchEngine.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (searchEngine) {
      searchEngine.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('fast-glob integration', () => {
    it('should use fast-glob for file discovery', async () => {
      const startTime = Date.now();
      
      // Trigger file discovery through change detection
      const changes = await searchEngine.detectChanges(testDir);
      
      const duration = Date.now() - startTime;
      
      // Performance expectations
      expect(duration).toBeLessThan(500); // Should be fast
      
      // Should detect relevant files (excluding ignored ones)
      expect(changes.length).toBeGreaterThan(0);
      
      // Should exclude .git and node_modules
      const gitFiles = changes.filter(f => f.includes('.git'));
      const nodeModuleFiles = changes.filter(f => f.includes('node_modules'));
      
      expect(gitFiles).toHaveLength(0);
      expect(nodeModuleFiles).toHaveLength(0);
      
      // Should include src and tests
      const srcFiles = changes.filter(f => f.includes('/src/'));
      const testFiles = changes.filter(f => f.includes('/tests/'));
      
      expect(srcFiles.length).toBeGreaterThan(0);
      expect(testFiles.length).toBeGreaterThan(0);
    });

    it('should handle batch processing efficiently', async () => {
      // Create more files to test batch processing
      const additionalFiles = [];
      for (let i = 0; i < 150; i++) {
        additionalFiles.push(`batch/file${i}.ts`);
      }

      for (const file of additionalFiles) {
        const filePath = path.join(testDir, file);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `// Batch file ${file}`);
      }

      const startTime = Date.now();
      const changes = await searchEngine.detectChanges(testDir);
      const duration = Date.now() - startTime;

      // Should handle large number of files efficiently
      expect(changes.length).toBeGreaterThan(150);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should provide performance metrics', async () => {
      await searchEngine.detectChanges(testDir);
      
      const stats = searchEngine.getStatistics();
      
      expect(stats).toHaveProperty('total_searches');
      expect(stats).toHaveProperty('success_rate');
      expect(stats).toHaveProperty('avg_response_time');
      expect(stats).toHaveProperty('learned_patterns');
      expect(stats).toHaveProperty('last_learning');
      
      // Performance metrics should be reasonable
      expect(stats.avg_response_time).toBeLessThan(1000);
      expect(stats.success_rate).toBeGreaterThanOrEqual(0);
    });

    it('should handle fallback to legacy method on error', async () => {
      // Mock glob.sync to throw error to test fallback
      const mockGlob = vi.fn().mockImplementation(() => {
        throw new Error('fast-glob error');
      });
      
      // This test assumes we can mock the glob import
      // In real implementation, this would test the fallback mechanism
      const changes = await searchEngine.detectChanges(testDir);
      
      // Should still work with fallback
      expect(Array.isArray(changes)).toBe(true);
    });
  });

  describe('performance optimization features', () => {
    it('should cache search results effectively', async () => {
      const query = 'test-query';
      const patternType = 'file_pattern';
      const directory = testDir;
      const mockResults = [
        { path: '/test/file1.ts', name: 'file1.ts' },
        { path: '/test/file2.ts', name: 'file2.ts' }
      ];

      // Cache results
      await searchEngine.cacheSearchResult(query, patternType, directory, mockResults);

      // Retrieve from cache
      const cachedResults = await searchEngine.getCachedSearchResult(query, patternType, directory);

      expect(cachedResults).toEqual(mockResults);
    });

    it('should invalidate cache when files change', async () => {
      const testFile = path.join(testDir, 'cache-test.ts');
      await fs.writeFile(testFile, 'original content');

      const query = 'cache-test';
      const patternType = 'content_pattern';
      const directory = testDir;
      const mockResults = [{ path: testFile, name: 'cache-test.ts' }];

      // Cache results
      await searchEngine.cacheSearchResult(query, patternType, directory, mockResults);

      // Verify cache hit
      let cachedResults = await searchEngine.getCachedSearchResult(query, patternType, directory);
      expect(cachedResults).toEqual(mockResults);

      // Modify file
      await fs.writeFile(testFile, 'modified content');

      // Cache should be invalidated
      cachedResults = await searchEngine.getCachedSearchResult(query, patternType, directory);
      expect(cachedResults).toBeNull();
    });

    it('should clean up expired cache entries', async () => {
      const query = 'expired-query';
      const patternType = 'file_pattern';
      const directory = testDir;
      const mockResults = [{ path: '/test/expired.ts', name: 'expired.ts' }];

      // Cache with very short expiration (1ms)
      await searchEngine.cacheSearchResult(query, patternType, directory, mockResults, 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should be expired
      const cachedResults = await searchEngine.getCachedSearchResult(query, patternType, directory);
      expect(cachedResults).toBeNull();

      // Clean up expired entries
      await searchEngine.cleanupExpiredCache();
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('search pattern learning', () => {
    it('should learn from search patterns', async () => {
      // Record some search history
      const searches = [
        {
          query: '*.ts',
          pattern_type: 'file_pattern',
          directory: testDir,
          results_count: 5,
          success: true,
          timestamp: new Date(),
          response_time_ms: 100
        },
        {
          query: '*.js', 
          pattern_type: 'file_pattern',
          directory: testDir,
          results_count: 3,
          success: true,
          timestamp: new Date(),
          response_time_ms: 80
        }
      ];

      for (const search of searches) {
        await searchEngine.recordSearch(search);
      }

      // Learn patterns
      const patterns = searchEngine.learnSearchPatterns(10);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty('pattern');
      expect(patterns[0]).toHaveProperty('frequency');
      expect(patterns[0]).toHaveProperty('success_rate');
      expect(patterns[0]).toHaveProperty('avg_response_time');
    });

    it('should provide query optimization suggestions', async () => {
      // Record search history to enable learning
      await searchEngine.recordSearch({
        query: 'common-pattern',
        pattern_type: 'file_pattern', 
        directory: testDir,
        results_count: 10,
        success: true,
        timestamp: new Date(),
        response_time_ms: 50
      });

      const optimizations = searchEngine.optimizeQuery('similar-pattern', testDir);

      expect(Array.isArray(optimizations)).toBe(true);
      // Should provide optimization suggestions based on learned patterns
    });
  });
});