import { IncomingCallPayload, ScreeningResult, CallScreeningStats, ScreeningRule } from '../types';

const STORAGE_KEY_API_URL = 'aegis_screener_api_url';
const DEFAULT_API_URL = window.location.hostname === 'localhost' ? '' : 'http://localhost:4000';

export class ApiService {
  public static getBaseUrl(): string {
    return localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_API_URL;
  }

  public static setBaseUrl(url: string): void {
    localStorage.setItem(STORAGE_KEY_API_URL, url.trim().replace(/\/+$/, ''));
  }

  private static formatUrl(path: string): string {
    const base = this.getBaseUrl();
    if (!base) return path;
    return `${base}${path}`;
  }

  public static async checkHealth(): Promise<{ status: string; latencyMs: number; raw?: any }> {
    const start = Date.now();
    try {
      const response = await fetch(this.formatUrl('/api/health'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const latency = Date.now() - start;
      if (!response.ok) {
        return { status: 'offline', latencyMs: latency };
      }
      const data = await response.json();
      return { status: data.status || 'online', latencyMs: latency, raw: data };
    } catch {
      return { status: 'offline', latencyMs: Date.now() - start };
    }
  }

  public static async screenCall(payload: IncomingCallPayload): Promise<ScreeningResult> {
    const response = await fetch(this.formatUrl('/api/screen-call'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Screening request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  public static async getLogs(params?: { search?: string; verdict?: string; category?: string }): Promise<ScreeningResult[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.verdict && params.verdict !== 'ALL') query.append('verdict', params.verdict);
    if (params?.category && params.category !== 'ALL') query.append('category', params.category);

    const url = this.formatUrl(`/api/logs?${query.toString()}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch call logs');
    const data = await response.json();
    return data.data;
  }

  public static async getStats(): Promise<CallScreeningStats> {
    const response = await fetch(this.formatUrl('/api/logs/stats'));
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    return data.data;
  }

  public static async deleteLog(id: string): Promise<boolean> {
    const response = await fetch(this.formatUrl(`/api/logs/${id}`), { method: 'DELETE' });
    return response.ok;
  }

  public static async getRules(): Promise<ScreeningRule[]> {
    const response = await fetch(this.formatUrl('/api/rules'));
    if (!response.ok) throw new Error('Failed to fetch rules');
    const data = await response.json();
    return data.data;
  }

  public static async addRule(rule: Omit<ScreeningRule, 'id' | 'createdAt'>): Promise<ScreeningRule> {
    const response = await fetch(this.formatUrl('/api/rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    if (!response.ok) throw new Error('Failed to create screening rule');
    const data = await response.json();
    return data.data;
  }

  public static async deleteRule(id: string): Promise<boolean> {
    const response = await fetch(this.formatUrl(`/api/rules/${id}`), { method: 'DELETE' });
    return response.ok;
  }
}
