/**
 * ファイルシステム操作の種類
 */
export type FileOperationType = 
  | 'read' 
  | 'write' 
  | 'append' 
  | 'delete' 
  | 'list' 
  | 'stat' 
  | 'mkdir' 
  | 'access' 
  | 'copy' 
  | 'move';

/**
 * ファイルシステム操作オプション（Phase1: 基本実装）
 */
export interface FileSystemOptions {
  encoding?: BufferEncoding;
  flag?: string;
  recursive?: boolean;
  withFileTypes?: boolean;
  mode?: string | number;
}