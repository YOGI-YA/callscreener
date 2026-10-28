import fs from 'fs';
import path from 'path';

export interface RetentionPolicy {
  enabled: boolean;
  maxAgeDays: number;
  maxStorageSizeBytes: number; // e.g. 500MB
  autoPruneOnSchedule: boolean;
}

export interface CleanupResult {
  filesScanned: number;
  filesDeleted: number;
  bytesFreed: number;
  timestamp: string;
}

export class MediaRetentionManager {
  private static policyFile = path.resolve(process.cwd(), 'data', 'retention_policy.json');
  private static defaultPolicy: RetentionPolicy = {
    enabled: true,
    maxAgeDays: 30, // 30 days retention
    maxStorageSizeBytes: 500 * 1024 * 1024, // 500 MB
    autoPruneOnSchedule: true
  };

  private static currentPolicy: RetentionPolicy = { ...this.defaultPolicy };
  private static isLoaded = false;

  private static loadPolicy(): void {
    if (this.isLoaded) return;
    this.isLoaded = true;
    try {
      if (fs.existsSync(this.policyFile)) {
        const raw = fs.readFileSync(this.policyFile, 'utf-8');
        this.currentPolicy = { ...this.defaultPolicy, ...JSON.parse(raw) };
      }
    } catch (e: any) {
      console.warn('Could not load retention policy:', e.message);
    }
  }

  public static getPolicy(): RetentionPolicy {
    this.loadPolicy();
    return { ...this.currentPolicy };
  }

  public static setPolicy(policy: Partial<RetentionPolicy>): RetentionPolicy {
    this.loadPolicy();
    this.currentPolicy = { ...this.currentPolicy, ...policy };
    try {
      const dir = path.dirname(this.policyFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.policyFile, JSON.stringify(this.currentPolicy, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('Could not persist retention policy:', e.message);
    }
    return { ...this.currentPolicy };
  }

  /**
   * Scans the target recordings / audio directories and purges files older than maxAgeDays.
   */
  public static runCleanup(targetDirs?: string[]): CleanupResult {
    this.loadPolicy();
    const dirs = targetDirs || [
      path.resolve(process.cwd(), 'data', 'recordings'),
      path.resolve(process.cwd(), 'data', 'temp_audio')
    ];

    let filesScanned = 0;
    let filesDeleted = 0;
    let bytesFreed = 0;
    const now = Date.now();
    const maxAgeMs = this.currentPolicy.maxAgeDays * 24 * 60 * 60 * 1000;

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const entries = fs.readdirSync(dir);
        for (const file of entries) {
          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              filesScanned++;
              const fileAge = now - stat.mtimeMs;
              if (this.currentPolicy.enabled && fileAge > maxAgeMs) {
                bytesFreed += stat.size;
                fs.unlinkSync(filePath);
                filesDeleted++;
              }
            }
          } catch {
            // continue scanning
          }
        }
      } catch (e: any) {
        console.warn(`Failed reading dir ${dir} for retention:`, e.message);
      }
    }

    return {
      filesScanned,
      filesDeleted,
      bytesFreed,
      timestamp: new Date().toISOString()
    };
  }
}
