import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemService } from './FileSystemService.js';
import fs from 'fs/promises';
import { Dirent } from 'fs';
import path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';

describe('FileSystemService', () => {
  let tempDir: string;
  let fileSystemService: FileSystemService;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'filesystem-service-test-'));
    fileSystemService = FileSystemService.getInstance();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = FileSystemService.getInstance();
      const instance2 = FileSystemService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('readFile', () => {
    it('should read file with UTF-8 encoding', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, FileSystemService!';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileSystemService.readFile(filePath, { encoding: 'utf-8' });
      expect(result).toBe(content);
    });

    it('should read file as buffer when no encoding specified', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, Buffer!';
      await fs.writeFile(filePath, content, 'utf-8');

      const result = await fileSystemService.readFile(filePath);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString('utf-8')).toBe(content);
    });
  });

  describe('writeFile', () => {
    it('should write file with UTF-8 encoding', async () => {
      const filePath = path.join(tempDir, 'write-test.txt');
      const content = 'Written by FileSystemService!';

      await fileSystemService.writeFile(filePath, content, { encoding: 'utf-8' });
      
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should write buffer content', async () => {
      const filePath = path.join(tempDir, 'buffer-test.txt');
      const content = Buffer.from('Buffer content', 'utf-8');

      await fileSystemService.writeFile(filePath, content);
      
      const result = await fs.readFile(filePath);
      expect(Buffer.compare(result, content)).toBe(0);
    });
  });

  describe('appendFile', () => {
    it('should append content to existing file', async () => {
      const filePath = path.join(tempDir, 'append-test.txt');
      const initialContent = 'Initial content';
      const appendedContent = ' - Appended content';

      await fs.writeFile(filePath, initialContent, 'utf-8');
      await fileSystemService.appendFile(filePath, appendedContent, { encoding: 'utf-8' });
      
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(initialContent + appendedContent);
    });
  });

  describe('readdir', () => {
    it('should list directory contents as strings', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const result = await fileSystemService.readdir(tempDir);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.txt');
    });

    it('should list directory contents with file types', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const subdir = path.join(tempDir, 'subdir');
      
      await fs.writeFile(file1, 'content1');
      await fs.mkdir(subdir);

      const result = await fileSystemService.readdir(tempDir, { withFileTypes: true });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      
      // Check that result contains Dirent objects
      const entries = result as Dirent[];
      const fileEntry = entries.find(entry => entry.name === 'file1.txt');
      const dirEntry = entries.find(entry => entry.name === 'subdir');
      
      expect(fileEntry?.isFile()).toBe(true);
      expect(dirEntry?.isDirectory()).toBe(true);
    });
  });

  describe('stat', () => {
    it('should return file stats', async () => {
      const filePath = path.join(tempDir, 'stat-test.txt');
      const content = 'File for stat test';
      
      await fs.writeFile(filePath, content, 'utf-8');
      
      const stats = await fileSystemService.stat(filePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBe(Buffer.byteLength(content, 'utf-8'));
    });

    it('should return directory stats', async () => {
      const stats = await fileSystemService.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('mkdir', () => {
    it('should create directory', async () => {
      const newDir = path.join(tempDir, 'new-directory');
      
      await fileSystemService.mkdir(newDir);
      
      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories with recursive option', async () => {
      const nestedDir = path.join(tempDir, 'level1', 'level2', 'level3');
      
      await fileSystemService.mkdir(nestedDir, { recursive: true });
      
      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('access', () => {
    it('should not throw for accessible file', async () => {
      const filePath = path.join(tempDir, 'access-test.txt');
      await fs.writeFile(filePath, 'test content');

      await expect(fileSystemService.access(filePath)).resolves.toBeUndefined();
    });

    it('should throw for non-existent file', async () => {
      const filePath = path.join(tempDir, 'non-existent.txt');

      await expect(fileSystemService.access(filePath)).rejects.toThrow();
    });
  });

  describe('copyFile', () => {
    it('should copy file successfully', async () => {
      const srcPath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'destination.txt');
      const content = 'Content to be copied';
      
      await fs.writeFile(srcPath, content, 'utf-8');
      await fileSystemService.copyFile(srcPath, destPath);
      
      const result = await fs.readFile(destPath, 'utf-8');
      expect(result).toBe(content);
    });
  });

  describe('unlink', () => {
    it('should delete file successfully', async () => {
      const filePath = path.join(tempDir, 'delete-test.txt');
      await fs.writeFile(filePath, 'content to delete');

      await fileSystemService.unlink(filePath);

      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('rename', () => {
    it('should rename file successfully', async () => {
      const oldPath = path.join(tempDir, 'old-name.txt');
      const newPath = path.join(tempDir, 'new-name.txt');
      const content = 'content to rename';
      
      await fs.writeFile(oldPath, content, 'utf-8');
      await fileSystemService.rename(oldPath, newPath);
      
      await expect(fs.access(oldPath)).rejects.toThrow();
      const result = await fs.readFile(newPath, 'utf-8');
      expect(result).toBe(content);
    });
  });
});