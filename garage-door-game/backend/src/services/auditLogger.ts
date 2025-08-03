import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import { AuthenticatedRequest } from '../utils/auth';

export interface AuditLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  event: string;
  userId?: number;
  username?: string;
  ip: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details?: any;
  success: boolean;
  errorMessage?: string;
}

class AuditLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'audit.log');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Write log entry to file
   */
  private writeLog(entry: any): void {
    const logLine = JSON.stringify(entry) + '\n';

    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Create base log entry from request
   */
  private createBaseEntry(req: Request | AuthenticatedRequest): any {
    const authReq = req as AuthenticatedRequest;

    return {
      timestamp: new Date().toISOString(),
      userId: authReq.user?.userId,
      username: authReq.user?.username,
      ip: req.ip || (req as any).connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent')
    };
  }

  /**
   * Log authentication events
   */
  public logAuth(req: Request | AuthenticatedRequest, event: string, success: boolean, details?: any, errorMessage?: string): void {
    const baseEntry = this.createBaseEntry(req);
    const entry = {
      timestamp: baseEntry.timestamp,
      userId: baseEntry.userId,
      username: baseEntry.username,
      ip: baseEntry.ip,
      userAgent: baseEntry.userAgent,
      level: success ? 'INFO' as const : 'SECURITY' as const,
      event: `AUTH_${event.toUpperCase()}`,
      resource: 'authentication',
      action: event,
      success,
      details,
      errorMessage
    };

    this.writeLog(entry);

    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${entry.level}: ${entry.event} - ${success ? 'SUCCESS' : 'FAILED'}`, details);
    }
  }

  /**
   * Log API access events
   */
  public logApiAccess(req: Request | AuthenticatedRequest, resource: string, action: string, success: boolean, details?: any, errorMessage?: string): void {
    const baseEntry = this.createBaseEntry(req);
    const entry = {
      timestamp: baseEntry.timestamp,
      userId: baseEntry.userId,
      username: baseEntry.username,
      ip: baseEntry.ip,
      userAgent: baseEntry.userAgent,
      level: success ? 'INFO' as const : 'WARN' as const,
      event: 'API_ACCESS',
      resource,
      action,
      success,
      details,
      errorMessage
    };

    this.writeLog(entry);
  }

  /**
   * Log Google API usage
   */
  public logGoogleApiUsage(req: Request | AuthenticatedRequest, apiType: string, success: boolean, details?: any, errorMessage?: string): void {
    const baseEntry = this.createBaseEntry(req);
    const entry = {
      timestamp: baseEntry.timestamp,
      userId: baseEntry.userId,
      username: baseEntry.username,
      ip: baseEntry.ip,
      userAgent: baseEntry.userAgent,
      level: success ? 'INFO' as const : 'ERROR' as const,
      event: 'GOOGLE_API_USAGE',
      resource: 'google_api',
      action: apiType,
      success,
      details,
      errorMessage
    };

    this.writeLog(entry);
  }

  /**
   * Log security events
   */
  public logSecurity(req: Request | AuthenticatedRequest, event: string, details?: any, errorMessage?: string): void {
    const entry: AuditLogEntry = {
      ...this.createBaseEntry(req),
      level: 'SECURITY',
      event: `SECURITY_${event.toUpperCase()}`,
      resource: 'security',
      action: event,
      success: false,
      details,
      errorMessage
    } as AuditLogEntry;

    this.writeLog(entry);
    
    // Always log security events to console
    console.warn(`[SECURITY ALERT] ${entry.event} from IP ${entry.ip}:`, details);
  }

  /**
   * Log data access events
   */
  public logDataAccess(req: Request | AuthenticatedRequest, resource: string, action: string, recordId?: string | number, success: boolean = true, details?: any): void {
    const entry: AuditLogEntry = {
      ...this.createBaseEntry(req),
      level: 'INFO',
      event: 'DATA_ACCESS',
      resource,
      action,
      success,
      details: {
        ...details,
        recordId
      }
    } as AuditLogEntry;

    this.writeLog(entry);
  }

  /**
   * Log system events
   */
  public logSystem(event: string, success: boolean, details?: any, errorMessage?: string): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? 'INFO' : 'ERROR',
      event: `SYSTEM_${event.toUpperCase()}`,
      ip: 'system',
      resource: 'system',
      action: event,
      success,
      details,
      errorMessage
    } as AuditLogEntry;

    this.writeLog(entry);
  }

  /**
   * Get recent audit logs (for admin dashboard)
   */
  public getRecentLogs(limit: number = 100): AuditLogEntry[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const logContent = fs.readFileSync(this.logFile, 'utf-8');
      const lines = logContent.trim().split('\n').filter(line => line.length > 0);
      
      const logs = lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line) as AuditLogEntry;
          } catch {
            return null;
          }
        })
        .filter(log => log !== null) as AuditLogEntry[];

      return logs.reverse(); // Most recent first
    } catch (error) {
      console.error('Failed to read audit logs:', error);
      return [];
    }
  }

  /**
   * Rotate log files (call this daily via cron job)
   */
  public rotateLogs(): void {
    try {
      if (!fs.existsSync(this.logFile)) {
        return;
      }

      const date = new Date().toISOString().split('T')[0];
      const rotatedFile = path.join(this.logDir, `audit-${date}.log`);
      
      fs.renameSync(this.logFile, rotatedFile);
      
      this.logSystem('log_rotation', true, { rotatedFile });
    } catch (error) {
      console.error('Failed to rotate audit logs:', error);
      this.logSystem('log_rotation', false, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

// Export the class for testing
export { AuditLogger };
