import crypto from 'crypto';
import { WebhookAlertConfig, ScreeningResult } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class WebhookDispatcher {
  private static webhooks: WebhookAlertConfig[] = [];

  /**
   * Validates target URL against SSRF attacks (private networks, cloud metadata, loopback)
   */
  public static validateSafeWebhookUrl(urlStr: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { valid: false, reason: 'Invalid protocol: Only HTTP/HTTPS webhooks permitted' };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Loopback & local targets
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.local')
      ) {
        return { valid: false, reason: 'SSRF blocked: Loopback addresses prohibited' };
      }

      // Cloud metadata targets
      if (
        hostname === '169.254.169.254' ||
        hostname.includes('metadata.google') ||
        hostname.includes('instance-data')
      ) {
        return { valid: false, reason: 'SSRF blocked: Cloud metadata service target prohibited' };
      }

      // Private RFC 1918 IPv4
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { valid: false, reason: 'SSRF blocked: RFC 1918 10.0.0.0/8 private network prohibited' };
      }
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return { valid: false, reason: 'SSRF blocked: RFC 1918 192.168.0.0/16 private network prohibited' };
      }
      const match172 = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
      if (match172) {
        const octet2 = parseInt(match172[1], 10);
        if (octet2 >= 16 && octet2 <= 31) {
          return { valid: false, reason: 'SSRF blocked: RFC 1918 172.16.0.0/12 private network prohibited' };
        }
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Malformed webhook URL format' };
    }
  }

  public static getWebhooks(): WebhookAlertConfig[] {
    return [...this.webhooks];
  }

  public static registerWebhook(config: Omit<WebhookAlertConfig, 'id'>): WebhookAlertConfig {
    const check = this.validateSafeWebhookUrl(config.url);
    if (!check.valid) {
      throw new Error(`SSRF_PROTECTION_ERROR: ${check.reason}`);
    }

    const item: WebhookAlertConfig = {
      ...config,
      id: `wh-${uuidv4().slice(0, 8)}`,
      secretKey: config.secretKey || crypto.randomBytes(16).toString('hex')
    };
    this.webhooks.push(item);
    return item;
  }

  public static deleteWebhook(id: string): boolean {
    const init = this.webhooks.length;
    this.webhooks = this.webhooks.filter((w) => w.id !== id);
    return this.webhooks.length < init;
  }

  /**
   * Computes HMAC SHA256 signature for webhook payload
   */
  public static computeSignature(payload: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
  }

  /**
   * Dispatches security alert to configured webhooks asynchronously
   */
  public static async dispatchSecurityAlert(log: ScreeningResult): Promise<{ dispatched: number; failed: number }> {
    const isCritical = log.riskLevel === 'CRITICAL_SPAM';
    const isEmergency = log.category === 'EMERGENCY_OVERRIDE' || Boolean(log.metadata?.emergencyOverrideTriggered);

    const activeHooks = this.webhooks.filter(
      (h) => h.enabled && ((isCritical && h.triggerOnCritical) || (isEmergency && h.triggerOnEmergency))
    );

    if (activeHooks.length === 0) {
      return { dispatched: 0, failed: 0 };
    }

    let dispatched = 0;
    let failed = 0;

    const payloadString = JSON.stringify({
      event: isEmergency ? 'CALL_EMERGENCY_OVERRIDE' : 'CALL_CRITICAL_THREAT_BLOCKED',
      timestamp: new Date().toISOString(),
      callData: {
        id: log.id,
        phoneNumber: log.phoneNumber,
        callerName: log.callerName,
        verdict: log.verdict,
        riskScore: log.riskScore,
        riskLevel: log.riskLevel,
        category: log.category,
        rationale: log.rationale,
        stirShakenAttestation: log.metadata?.stirShakenAttestation,
        acousticBotDetected: log.metadata?.acousticBotTelemetry?.isRobocallBot ?? false
      }
    });

    await Promise.allSettled(
      activeHooks.map(async (hook) => {
        try {
          const signature = hook.secretKey ? this.computeSignature(payloadString, hook.secretKey) : '';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AegisCall-Security-Alert-Dispatcher/2.2',
              'X-AegisCall-Signature': signature,
              'X-AegisCall-Event': isEmergency ? 'emergency_override' : 'critical_threat'
            },
            body: payloadString,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            dispatched++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );

    return { dispatched, failed };
  }
}
