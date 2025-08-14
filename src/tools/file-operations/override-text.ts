/**
 * ファイル完全上書きツール
 * 既存ファイルの内容を完全に置き換える、または新規ファイル作成を行う
 * セキュリティ重視設計: プレビュー必須、バックアップ自動、明示的意図確認
 */

import { z } from 'zod';
import { BaseTool } from '../base.js';
import { IToolMetadata, IToolResult } from '../../types/common.js';
import { Logger } from '../../services/logger.js';
import { promises as fs } from 'fs';
import * as path from 'path';

const OverrideTextSchema = z.object({
  file_path: z.string().describe('対象ファイルパス'),
  text: z.string().describe('新しいファイル内容（完全置換）'),
  preview_mode: z.boolean().optional().default(false).describe('プレビューモード（実際の変更は行わない）'),
  create_backup: z.boolean().optional().default(true).describe('バックアップファイルを作成'),
  max_file_size: z.number().optional().default(10 * 1024 * 1024).describe('最大ファイルサイズ（バイト、デフォルト: 10MB）'),
  confirm_override: z.boolean().optional().default(false).describe('上書き意図の明示的確認'),
  allow_new_file: z.boolean().optional().default(true).describe('新規ファイル作成を許可')
});

type OverrideTextParams = z.infer<typeof OverrideTextSchema>;

interface OverrideResult {
  success: boolean;
  file_path: string;
  preview_mode: boolean;
  operation: 'override' | 'create';
  backup_path?: string;
  original_size: number;
  new_size: number;
  preview_content?: string;
  security_warning?: string;
}

/**
 * ファイル完全上書きツール
 * セキュリティ設計: 意図の明確化、自動バックアップ、プレビュー機能
 */
export class OverrideTextTool extends BaseTool {
  readonly metadata: IToolMetadata = {
    name: 'override_text',
    description: '既存ファイルの完全上書きまたは新規ファイル作成（高リスク操作・要注意）',
    parameters: {
      file_path: {
        type: 'string',
        description: '対象ファイルパス',
        required: true
      },
      text: {
        type: 'string',
        description: '新しいファイル内容（完全置換）',
        required: true
      },
      preview_mode: {
        type: 'boolean',
        description: 'プレビューモード（実際の変更は行わない）',
        required: false
      },
      create_backup: {
        type: 'boolean',
        description: 'バックアップファイルを作成（デフォルト: true）',
        required: false
      },
      max_file_size: {
        type: 'number',
        description: '最大ファイルサイズ（バイト、デフォルト: 10MB）',
        required: false
      },
      confirm_override: {
        type: 'boolean',
        description: '上書き意図の明示的確認（重要ファイル用）',
        required: false
      },
      allow_new_file: {
        type: 'boolean',
        description: '新規ファイル作成を許可（デフォルト: true）',
        required: false
      }
    }
  };

  protected readonly schema = OverrideTextSchema;

  protected async executeInternal(validatedParameters: unknown): Promise<IToolResult> {
    const params = validatedParameters as OverrideTextParams;

    try {
      // 1. ファイル存在確認と状態分析
      let originalContent = '';
      let originalSize = 0;
      let operation: 'override' | 'create' = 'create';

      try {
        const fileStats = await fs.stat(params.file_path);
        
        // ディレクトリチェック
        if (fileStats.isDirectory()) {
          return this.createErrorResult(`指定されたパスはディレクトリです: ${params.file_path}`);
        }

        // ファイルサイズチェック
        if (fileStats.size > params.max_file_size) {
          return this.createErrorResult(
            `ファイルサイズが制限を超えています: ${fileStats.size} > ${params.max_file_size} bytes`
          );
        }

        originalSize = fileStats.size;
        originalContent = await fs.readFile(params.file_path, 'utf-8');
        operation = 'override';
      } catch (error) {
        // ファイルが存在しない場合
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          if (!params.allow_new_file) {
            return this.createErrorResult(
              `ファイルが見つかりません: ${params.file_path}. 新規作成を行う場合は allow_new_file=true を指定してください。`
            );
          }
          operation = 'create';
        } else {
          return this.createErrorResult(`ファイルアクセスエラー: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 2. セキュリティ警告生成
      let securityWarning: string | undefined;
      if (operation === 'override' && originalSize > 0) {
        securityWarning = `⚠️ 高リスク操作: 既存ファイル（${originalSize}バイト）を完全上書きします。必要に応じてpreview_mode=trueで内容確認を推奨。`;
      }

      // 3. 新しいファイルサイズチェック
      const newSize = Buffer.byteLength(params.text, 'utf-8');
      if (newSize > params.max_file_size) {
        return this.createErrorResult(
          `新しい内容のサイズが制限を超えています: ${newSize} > ${params.max_file_size} bytes`
        );
      }

      // 4. プレビューモード
      if (params.preview_mode) {
        const result: OverrideResult = {
          success: true,
          file_path: params.file_path,
          preview_mode: true,
          operation,
          original_size: originalSize,
          new_size: newSize,
          preview_content: params.text,
          security_warning: securityWarning
        };

        return this.createTextResult(JSON.stringify(result, null, 2));
      }

      // 5. 明示的確認チェック（重要ファイル）
      if (!params.confirm_override && operation === 'override' && !params.preview_mode) {
        const sensitivePatterns = ['.env', 'config', 'package.json', 'tsconfig', '.gitignore'];
        const isSensitiveFile = sensitivePatterns.some(pattern => params.file_path.toLowerCase().includes(pattern));
        
        if (isSensitiveFile) {
          return this.createErrorResult(
            `機密ファイル上書き保護: ${params.file_path} は重要ファイルです。preview_mode=true で内容を確認後、confirm_override=true で実行してください。`
          );
        }
      }

      // 6. ディレクトリ作成（新規ファイルの場合）
      if (operation === 'create') {
        const dir = path.dirname(params.file_path);
        await fs.mkdir(dir, { recursive: true });
      }

      // 7. バックアップ作成（既存ファイルのみ）
      let backupPath: string | undefined;
      if (params.create_backup && operation === 'override') {
        backupPath = await this.createBackup(params.file_path, originalContent);
      }

      // 8. ファイル完全上書き/作成
      await fs.writeFile(params.file_path, params.text, 'utf-8');

      // 9. 結果をまとめる
      const result: OverrideResult = {
        success: true,
        file_path: params.file_path,
        preview_mode: false,
        operation,
        backup_path: backupPath,
        original_size: originalSize,
        new_size: newSize,
        security_warning: securityWarning
      };

      Logger.getInstance().info('File override completed', {
        file_path: params.file_path,
        operation,
        original_size: originalSize,
        new_size: newSize,
        backup_created: !!backupPath
      });

      return this.createTextResult(JSON.stringify(result, null, 2));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.getInstance().error('Failed to override file', error instanceof Error ? error : new Error(errorMessage));
      return this.createErrorResult(`ファイル上書きエラー: ${errorMessage}`);
    }
  }

  private async createBackup(filePath: string, content: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = '.claude/workspace/effortlessly/backups';
    const fileName = path.basename(filePath);
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
    
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return backupPath;
  }
}
