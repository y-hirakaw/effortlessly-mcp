/**
 * シンボルインデックス実装
 * SQLiteを使用した高速なシンボル検索インデックス
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import type { SymbolKind } from 'vscode-languageserver-protocol';
import type { SymbolSearchResult } from './types.js';
import { Logger } from '../logger.js';

/**
 * シンボルインデックス管理クラス
 */
export class SymbolIndexer {
  private db?: Database.Database;
  private readonly dbPath: string;

  constructor(
    private workspaceId: string,
    private indexDir: string,
    private logger: Logger = Logger.getInstance()
  ) {
    this.dbPath = path.join(indexDir, 'symbols.db');
  }

  /**
   * インデックスを初期化
   */
  async initialize(): Promise<void> {
    try {
      // インデックスディレクトリを作成
      await fs.mkdir(this.indexDir, { recursive: true });

      // SQLiteデータベースを開く
      this.db = new Database(this.dbPath);
      
      // テーブルを作成
      this.createTables();
      
      this.logger.info(`Symbol indexer initialized: ${this.dbPath}`);
    } catch (error) {
      this.logger.error('Failed to initialize symbol indexer', error as Error);
      throw error;
    }
  }

  /**
   * インデックスを閉じる
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
      this.logger.info('Symbol indexer closed');
    }
  }

  /**
   * シンボルを一括追加
   */
  async addSymbols(symbols: SymbolSearchResult[]): Promise<void> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbols 
      (name, kind, file_path, line, column, parent_id, signature, documentation, workspace_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const transaction = this.db.transaction((symbols: SymbolSearchResult[]) => {
      for (const symbol of symbols) {
        insertStmt.run(
          symbol.name,
          symbol.kind,
          symbol.file,
          symbol.position.line,
          symbol.position.character,
          null, // parent_idは将来の拡張用
          symbol.detail || null,
          symbol.documentation || null,
          this.workspaceId
        );
      }
    });

    try {
      transaction(symbols);
      this.logger.info(`Added ${symbols.length} symbols to index`);
    } catch (error) {
      this.logger.error('Failed to add symbols to index', error as Error);
      throw error;
    }
  }

  /**
   * シンボル名で検索
   */
  async searchByName(
    query: string, 
    options?: {
      kind?: SymbolKind;
      exactMatch?: boolean;
      maxResults?: number;
      filePattern?: string;
    }
  ): Promise<SymbolSearchResult[]> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    const { kind, exactMatch = false, maxResults = 100, filePattern } = options || {};
    
    let sql = `
      SELECT name, kind, file_path, line, column, signature, documentation
      FROM symbols 
      WHERE workspace_id = ?
    `;
    const params: any[] = [this.workspaceId];

    // 名前検索条件
    if (exactMatch) {
      sql += ' AND name = ?';
      params.push(query);
    } else {
      sql += ' AND name LIKE ?';
      params.push(`%${query}%`);
    }

    // 種類フィルタ
    if (kind !== undefined) {
      sql += ' AND kind = ?';
      params.push(kind);
    }

    // ファイルパターンフィルタ
    if (filePattern) {
      sql += ' AND file_path LIKE ?';
      params.push(`%${filePattern}%`);
    }

    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(maxResults);

    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => ({
        name: row.name,
        kind: row.kind,
        file: row.file_path,
        position: {
          line: row.line,
          character: row.column
        },
        range: {
          start: { line: row.line, character: row.column },
          end: { line: row.line, character: row.column + row.name.length }
        },
        detail: row.signature,
        documentation: row.documentation
      }));
    } catch (error) {
      this.logger.error('Failed to search symbols by name', error as Error);
      throw error;
    }
  }

  /**
   * ファイル内のシンボルを取得
   */
  async getSymbolsInFile(filePath: string): Promise<SymbolSearchResult[]> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        SELECT name, kind, file_path, line, column, signature, documentation
        FROM symbols 
        WHERE workspace_id = ? AND file_path = ?
        ORDER BY line ASC, column ASC
      `);

      const rows = stmt.all(this.workspaceId, filePath) as any[];

      return rows.map(row => ({
        name: row.name,
        kind: row.kind,
        file: row.file_path,
        position: {
          line: row.line,
          character: row.column
        },
        range: {
          start: { line: row.line, character: row.column },
          end: { line: row.line, character: row.column + row.name.length }
        },
        detail: row.signature,
        documentation: row.documentation
      }));
    } catch (error) {
      this.logger.error('Failed to get symbols in file', error as Error);
      throw error;
    }
  }

  /**
   * ファイルのシンボルを削除
   */
  async removeFileSymbols(filePath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        DELETE FROM symbols 
        WHERE workspace_id = ? AND file_path = ?
      `);

      const result = stmt.run(this.workspaceId, filePath);
      this.logger.info(`Removed ${result.changes} symbols from ${filePath}`);
    } catch (error) {
      this.logger.error('Failed to remove file symbols', error as Error);
      throw error;
    }
  }

  /**
   * インデックス統計を取得
   */
  async getStats(): Promise<{
    totalSymbols: number;
    symbolsByKind: Record<string, number>;
    fileCount: number;
    lastUpdated: string;
  }> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    try {
      // 総シンボル数
      const totalStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM symbols WHERE workspace_id = ?
      `);
      const totalResult = totalStmt.get(this.workspaceId) as any;
      const totalSymbols = totalResult.count;

      // 種類別統計
      const kindStmt = this.db.prepare(`
        SELECT kind, COUNT(*) as count 
        FROM symbols 
        WHERE workspace_id = ? 
        GROUP BY kind
      `);
      const kindResults = kindStmt.all(this.workspaceId) as any[];
      const symbolsByKind: Record<string, number> = {};
      for (const row of kindResults) {
        symbolsByKind[row.kind] = row.count;
      }

      // ファイル数
      const fileStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT file_path) as count 
        FROM symbols 
        WHERE workspace_id = ?
      `);
      const fileResult = fileStmt.get(this.workspaceId) as any;
      const fileCount = fileResult.count;

      // 最終更新日時
      const lastUpdatedStmt = this.db.prepare(`
        SELECT MAX(updated_at) as last_updated 
        FROM symbols 
        WHERE workspace_id = ?
      `);
      const lastUpdatedResult = lastUpdatedStmt.get(this.workspaceId) as any;
      const lastUpdated = lastUpdatedResult.last_updated || '';

      return {
        totalSymbols,
        symbolsByKind,
        fileCount,
        lastUpdated
      };
    } catch (error) {
      this.logger.error('Failed to get index stats', error as Error);
      throw error;
    }
  }

  /**
   * インデックスを最適化
   */
  async optimize(): Promise<void> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    try {
      this.db.exec('VACUUM');
      this.db.exec('ANALYZE');
      this.logger.info('Index optimized');
    } catch (error) {
      this.logger.error('Failed to optimize index', error as Error);
      throw error;
    }
  }

  /**
   * インデックスをクリア
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Index not initialized');
    }

    try {
      const stmt = this.db.prepare('DELETE FROM symbols WHERE workspace_id = ?');
      const result = stmt.run(this.workspaceId);
      this.logger.info(`Cleared ${result.changes} symbols from index`);
    } catch (error) {
      this.logger.error('Failed to clear index', error as Error);
      throw error;
    }
  }

  /**
   * データベーステーブルを作成
   */
  private createTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER NOT NULL,
        parent_id INTEGER,
        signature TEXT,
        documentation TEXT,
        workspace_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES symbols(id)
      )
    `);

    // インデックスを作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_name 
      ON symbols(name)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_file 
      ON symbols(file_path)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_name_kind 
      ON symbols(name, kind)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_workspace 
      ON symbols(workspace_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_symbols_file_line 
      ON symbols(file_path, line)
    `);

    this.logger.info('Symbol database tables and indexes created');
  }
}