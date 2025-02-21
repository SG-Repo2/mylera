import { Platform } from 'react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export enum LogCategory {
  Network = 'network',
  Retry = 'retry',
  Health = 'health',
  Auth = 'auth',
  Metrics = 'metrics',
  Performance = 'performance',
  Timeout = 'timeout',
  Error = 'error'
}

interface LogMetadata {
  category: LogCategory;
  operationId?: string;
  userId?: string;
  timestamp: string;
  platform: string;
}

const isDevMode = __DEV__;

const logLevels: { [key in LogLevel]: number } = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = isDevMode ? 'debug' : 'warn';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private createLogMetadata(category: LogCategory, operationId?: string, userId?: string): LogMetadata {
    return {
      category,
      operationId,
      userId,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    };
  }

  private formatMessage(level: LogLevel, metadata: LogMetadata, message: string, ...args: any[]): string[] {
    const prefix = `[${metadata.timestamp}] [${level.toUpperCase()}] [${metadata.category}]`;
    const metadataStr = [
      metadata.operationId && `[op:${metadata.operationId}]`,
      metadata.userId && `[user:${metadata.userId}]`,
    ].filter(Boolean).join(' ');

    return [
      `${prefix}${metadataStr ? ' ' + metadataStr : ''} ${message}`,
      ...args
    ];
  }

  private shouldLog(level: LogLevel): boolean {
    return logLevels[level] >= logLevels[this.logLevel];
  }

  debug(category: LogCategory, message: string, operationId?: string, userId?: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      const metadata = this.createLogMetadata(category, operationId, userId);
      console.debug(...this.formatMessage('debug', metadata, message, ...args));
    }
  }

  info(category: LogCategory, message: string, operationId?: string, userId?: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      const metadata = this.createLogMetadata(category, operationId, userId);
      console.info(...this.formatMessage('info', metadata, message, ...args));
    }
  }

  warn(category: LogCategory, message: string, operationId?: string, userId?: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      const metadata = this.createLogMetadata(category, operationId, userId);
      console.warn(...this.formatMessage('warn', metadata, message, ...args));
    }
  }

  error(category: LogCategory, message: string, operationId?: string, userId?: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      const metadata = this.createLogMetadata(category, operationId, userId);
      console.error(...this.formatMessage('error', metadata, message, ...args));
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = Logger.getInstance(); 