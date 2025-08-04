/**
 * プロジェクト知識管理サービス
 * プロジェクト固有の知識・設計情報の永続化と管理
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from './logger.js';

export interface MemoryMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  size: number;
  checksum?: string;
}

export interface MemoryEntry {
  metadata: MemoryMetadata;
  content: string;
}

export interface MemoryIndex {
  version: string;
  lastUpdated: string;
  memories: Record<string, MemoryMetadata>;
}

export interface MemorySaveResult {
  success: boolean;
  metadata: MemoryMetadata;
  filePath: string;
  message: string;
}

export interface MemoryListResult {
  memories: MemoryMetadata[];
  totalCount: number;
  filteredCount: number;
  tags: string[];
}

/**
 * プロジェクト知識管理サービス
 */
export class ProjectMemoryService {
  private workspaceRoot: string;
  private memoryDir: string;
  private indexPath: string;
  private logger: Logger;
  private memoryIndex: MemoryIndex | null = null;

  constructor(workspaceRoot: string, logger?: Logger) {
    this.workspaceRoot = workspaceRoot;
    this.memoryDir = path.join(this.workspaceRoot, '.claude', 'workspace', 'effortlessly', 'memory');
    this.indexPath = path.join(this.memoryDir, 'index.json');
    this.logger = logger || Logger.getInstance();
  }

  /**
   * メモリディレクトリを初期化
   */
  private async ensureMemoryDirectory(): Promise<void> {
    try {
      await fs.access(this.memoryDir);
    } catch {
      this.logger.info(`Creating memory directory: ${this.memoryDir}`);
      await fs.mkdir(this.memoryDir, { recursive: true });
    }
  }

  /**
   * メモリインデックスを読み込み
   */
  private async loadIndex(): Promise<MemoryIndex> {
    if (this.memoryIndex) {
      return this.memoryIndex;
    }

    try {
      const indexContent = await fs.readFile(this.indexPath, 'utf8');
      this.memoryIndex = JSON.parse(indexContent);
      return this.memoryIndex!;
    } catch {
      // インデックスが存在しない場合は新規作成
      this.memoryIndex = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        memories: {}
      };
      await this.saveIndex();
      return this.memoryIndex;
    }
  }

  /**
   * メモリインデックスを保存
   */
  private async saveIndex(): Promise<void> {
    if (!this.memoryIndex) {
      throw new Error('Memory index not loaded');
    }

    this.memoryIndex.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.indexPath, JSON.stringify(this.memoryIndex, null, 2), 'utf8');
  }

  /**
   * チェックサムを計算
   */
  private calculateChecksum(content: string): string {
    // シンプルなハッシュ関数（本格的な実装では crypto.createHash を使用）
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * メモリファイル名を正規化
   */
  private normalizeMemoryName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\-_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * プロジェクト知識を保存
   */
  async writeMemory(
    memoryName: string,
    content: string,
    tags: string[] = []
  ): Promise<MemorySaveResult> {
    try {
      await this.ensureMemoryDirectory();
      const index = await this.loadIndex();

      const normalizedName = this.normalizeMemoryName(memoryName);
      const fileName = `${normalizedName}.md`;
      const filePath = path.join(this.memoryDir, fileName);

      // メタデータを作成
      const now = new Date().toISOString();
      const existingMemory = index.memories[normalizedName];
      const metadata: MemoryMetadata = {
        name: normalizedName,
        createdAt: existingMemory?.createdAt || now,
        updatedAt: now,
        tags: [...new Set(tags)], // 重複除去
        size: Buffer.byteLength(content, 'utf8'),
        checksum: this.calculateChecksum(content)
      };

      // コンテンツを保存
      await fs.writeFile(filePath, content, 'utf8');

      // インデックスを更新
      index.memories[normalizedName] = metadata;
      await this.saveIndex();

      this.logger.info(`Memory saved: ${normalizedName}`, {
        filePath,
        size: metadata.size,
        tags: tags.join(', ')
      });

      return {
        success: true,
        metadata,
        filePath,
        message: `Memory '${normalizedName}' saved successfully`
      };

    } catch (error) {
      this.logger.error('Failed to save memory', error as Error);
      throw new Error(`Failed to save memory '${memoryName}': ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト知識を読み取り
   */
  async readMemory(memoryName: string): Promise<MemoryEntry> {
    try {
      const index = await this.loadIndex();
      const normalizedName = this.normalizeMemoryName(memoryName);

      const metadata = index.memories[normalizedName];
      if (!metadata) {
        throw new Error(`Memory '${normalizedName}' not found`);
      }

      const fileName = `${normalizedName}.md`;
      const filePath = path.join(this.memoryDir, fileName);

      const content = await fs.readFile(filePath, 'utf8');

      // チェックサム検証
      const currentChecksum = this.calculateChecksum(content);
      if (metadata.checksum && metadata.checksum !== currentChecksum) {
        this.logger.warn(`Checksum mismatch for memory: ${normalizedName}`, {
          expected: metadata.checksum,
          actual: currentChecksum
        });
      }

      this.logger.info(`Memory read: ${normalizedName}`, {
        size: content.length,
        tags: metadata.tags.join(', ')
      });

      return {
        metadata,
        content
      };

    } catch (error) {
      this.logger.error('Failed to read memory', error as Error);
      throw new Error(`Failed to read memory '${memoryName}': ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト知識の一覧を取得
   */
  async listMemories(filterTags?: string[]): Promise<MemoryListResult> {
    try {
      const index = await this.loadIndex();
      let memories = Object.values(index.memories);

      // タグフィルタリング
      if (filterTags && filterTags.length > 0) {
        memories = memories.filter(memory =>
          filterTags.some(tag => memory.tags.includes(tag))
        );
      }

      // 更新日時で降順ソート
      memories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // 全体で使用されているタグを取得
      const allTags = [...new Set(
        Object.values(index.memories).flatMap(memory => memory.tags)
      )].sort();

      this.logger.info(`Listed memories: ${memories.length}/${Object.keys(index.memories).length}`, {
        filterTags: filterTags?.join(', ') || 'none',
        totalTags: allTags.length
      });

      return {
        memories,
        totalCount: Object.keys(index.memories).length,
        filteredCount: memories.length,
        tags: allTags
      };

    } catch (error) {
      this.logger.error('Failed to list memories', error as Error);
      throw new Error(`Failed to list memories: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト知識を削除
   */
  async deleteMemory(memoryName: string): Promise<{ success: boolean; message: string }> {
    try {
      const index = await this.loadIndex();
      const normalizedName = this.normalizeMemoryName(memoryName);

      if (!index.memories[normalizedName]) {
        throw new Error(`Memory '${normalizedName}' not found`);
      }

      const fileName = `${normalizedName}.md`;
      const filePath = path.join(this.memoryDir, fileName);

      // ファイルを削除
      await fs.unlink(filePath);

      // インデックスから削除
      delete index.memories[normalizedName];
      await this.saveIndex();

      this.logger.info(`Memory deleted: ${normalizedName}`, { filePath });

      return {
        success: true,
        message: `Memory '${normalizedName}' deleted successfully`
      };

    } catch (error) {
      this.logger.error('Failed to delete memory', error as Error);
      throw new Error(`Failed to delete memory '${memoryName}': ${(error as Error).message}`);
    }
  }

  /**
   * メモリ検索（内容とタグでの検索）
   */
  async searchMemories(query: string, options?: {
    searchContent?: boolean;
    searchTags?: boolean;
    matchExact?: boolean;
  }): Promise<MemoryListResult> {
    const { searchContent = true, searchTags = true, matchExact = false } = options || {};

    try {
      const index = await this.loadIndex();
      const allMemories = Object.values(index.memories);
      const matchingMemories: MemoryMetadata[] = [];

      for (const memory of allMemories) {
        let matches = false;

        // タグ検索
        if (searchTags) {
          const tagMatch = matchExact
            ? memory.tags.includes(query)
            : memory.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
          if (tagMatch) matches = true;
        }

        // 名前検索
        const nameMatch = matchExact
          ? memory.name === query
          : memory.name.toLowerCase().includes(query.toLowerCase());
        if (nameMatch) matches = true;

        // 内容検索
        if (searchContent && !matches) {
          try {
            const fileName = `${memory.name}.md`;
            const filePath = path.join(this.memoryDir, fileName);
            const content = await fs.readFile(filePath, 'utf8');
            
            const contentMatch = matchExact
              ? content.includes(query)
              : content.toLowerCase().includes(query.toLowerCase());
            if (contentMatch) matches = true;
          } catch {
            // ファイル読み取りエラーは無視
          }
        }

        if (matches) {
          matchingMemories.push(memory);
        }
      }

      // 更新日時で降順ソート
      matchingMemories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const allTags = [...new Set(
        allMemories.flatMap(memory => memory.tags)
      )].sort();

      this.logger.info(`Memory search completed: "${query}"`, {
        matches: matchingMemories.length,
        total: allMemories.length,
        searchContent,
        searchTags,
        matchExact
      });

      return {
        memories: matchingMemories,
        totalCount: allMemories.length,
        filteredCount: matchingMemories.length,
        tags: allTags
      };

    } catch (error) {
      this.logger.error('Failed to search memories', error as Error);
      throw new Error(`Failed to search memories: ${(error as Error).message}`);
    }
  }

  /**
   * メモリ統計情報を取得
   */
  async getMemoryStatistics(): Promise<{
    totalMemories: number;
    totalSize: number;
    averageSize: number;
    tagCount: number;
    oldestMemory: MemoryMetadata | null;
    newestMemory: MemoryMetadata | null;
    tagDistribution: Record<string, number>;
  }> {
    try {
      const index = await this.loadIndex();
      const memories = Object.values(index.memories);

      if (memories.length === 0) {
        return {
          totalMemories: 0,
          totalSize: 0,
          averageSize: 0,
          tagCount: 0,
          oldestMemory: null,
          newestMemory: null,
          tagDistribution: {}
        };
      }

      const totalSize = memories.reduce((sum, memory) => sum + memory.size, 0);
      const averageSize = totalSize / memories.length;

      // 最古・最新のメモリを特定
      const sortedByCreated = [...memories].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const oldestMemory = sortedByCreated[0];
      const newestMemory = sortedByCreated[sortedByCreated.length - 1];

      // タグの分布を計算
      const tagDistribution: Record<string, number> = {};
      memories.forEach(memory => {
        memory.tags.forEach(tag => {
          tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
        });
      });

      const allTags = Object.keys(tagDistribution);

      return {
        totalMemories: memories.length,
        totalSize,
        averageSize: Math.round(averageSize),
        tagCount: allTags.length,
        oldestMemory,
        newestMemory,
        tagDistribution
      };

    } catch (error) {
      this.logger.error('Failed to get memory statistics', error as Error);
      throw new Error(`Failed to get memory statistics: ${(error as Error).message}`);
    }
  }
}