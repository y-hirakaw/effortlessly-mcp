
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;

  public debug(message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      logger.debug(`[DEBUG] ${message}`);
    }
  }

  public info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      logger.info(`[INFO] ${message}`);
    }
  }

  public warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      logger.warn(`[WARN] ${message}`);
    }
  }

  public error(message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR) {
      logger.error(`[ERROR] ${message}`, error);
    }
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }
}
