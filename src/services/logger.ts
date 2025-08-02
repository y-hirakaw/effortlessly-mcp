import { LogLevel, ILogEntry } from '../types/common.js';

/**
 * Simple console logger for the MCP server
 * Note: In Phase 2, this will be replaced with a more sophisticated file-based logger
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(entry: ILogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase();
    const message = entry.message;
    const context = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? ` | Error: ${entry.error.message}` : '';
    
    return `[${timestamp}] ${level}: ${message}${context}${error}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: ILogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    const formattedMessage = this.formatMessage(entry);

    // Use console.error for all logs since MCP uses stdio for communication
    // This ensures logs don't interfere with MCP protocol messages
    console.error(formattedMessage);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
}