import crypto from 'crypto';
import { WebhookAlertConfig, ScreeningResult } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class WebhookDispatcher {
  private static webhooks: WebhookAlertConfig[] = [];

  public static getWebhooks(): WebhookAlertConfig[] {
    return [...this.webhooks];
  }

  public static registerWebhook(config: Omit<WebhookAlertConfig, 'id'>): WebhookAlertConfig {
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
