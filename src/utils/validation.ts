import { z } from 'zod';

/**
 * Validates if a path is safe (no path traversal attempts)
 */
export function isPathSafe(path: string): boolean {
  // Check for path traversal attempts
  if (path.includes('..') || path.includes('~')) {
    return false;
  }
  
  // Check for absolute paths (we'll handle this later in security implementation)
  if (path.startsWith('/') || path.match(/^[a-zA-Z]:\\/)) {
    return true; // For now, allow absolute paths
  }
  
  return true;
}

/**
 * Validates if a file size is within limits
 */
export function isFileSizeValid(size: number, maxSize: number = 1048576): boolean {
  return size >= 0 && size <= maxSize;
}

/**
 * Basic email validation
 */
export const emailSchema = z.string().email();

/**
 * Path validation schema
 */
export const pathSchema = z.string().refine((path) => isPathSafe(path), {
  message: 'Invalid path: contains unsafe characters or patterns',
});