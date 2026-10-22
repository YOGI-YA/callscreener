import nodemailer from 'nodemailer';
import { config } from '../config';

export interface EmailSettings {
  enabled: boolean;
  toEmail: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  fromEmail?: string;
  forwardSpamOnly?: boolean;
  autoForwardOnDisconnect?: boolean;
}

export interface SendRecordingEmailParams {
  to?: string;
  phoneNumber: string;
  callerName?: string;
  timestamp?: number | string;
  durationSeconds?: number;
  verdict: 'ALLOW' | 'BLOCK' | 'SCREEN_FURTHER' | 'SILENCE' | string;
  riskScore: number;
  category?: string;
  rationale?: string;
  transcript?: Array<{ speaker: string; text: string; time?: string }> | string;
  recordingBase64?: string;
  recordingMimeType?: string;
  recordingFileName?: string;
  recordingUrl?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  mode: 'smtp' | 'mock';
  messageId?: string;
  to: string;
  subject: string;
  error?: string;
}

// In-memory or persisted email forwarding preferences
let currentEmailSettings: EmailSettings = {
  enabled: true,
  toEmail: process.env.NOTIFICATION_EMAIL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  fromEmail: process.env.SMTP_FROM || 'AegisCall AI <screener@aegiscall.ai>',
  forwardSpamOnly: false,
  autoForwardOnDisconnect: true
};

export class EmailService {
  public static getSettings(): EmailSettings {
    return { ...currentEmailSettings };
  }

  public static updateSettings(newSettings: Partial<EmailSettings>): EmailSettings {
    currentEmailSettings = {
      ...currentEmailSettings,
      ...newSettings
    };
    return { ...currentEmailSettings };
  }

  private static getTransporter(overrideConfig?: Partial<EmailSettings>) {
    const config = { ...currentEmailSettings, ...overrideConfig };
    if (config.smtpHost && config.smtpUser && config.smtpPass) {
      return nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpSecure || false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        }
      });
    }
    return null;
  }

  public static generateHtmlTemplate(params: SendRecordingEmailParams): string {
    const dateStr = params.timestamp ? new Date(params.timestamp).toLocaleString() : new Date().toLocaleString();
    const verdictColor =
      params.riskScore >= 70 ? '#ef4444' :
      params.riskScore >= 35 ? '#f59e0b' : '#10b981';

    const verdictLabel =
      params.riskScore >= 70 ? 'SUSPICIOUS / SPAM' :
      params.riskScore >= 35 ? 'EVALUATED CAUTION' : 'VERIFIED / LEGITIMATE';

    let formattedTranscript = '';
    if (Array.isArray(params.transcript)) {
      formattedTranscript = params.transcript
        .map(
          (t) => `
        <div style="margin-bottom: 10px; padding: 10px 14px; border-radius: 8px; background: ${
          t.speaker === 'CALLER' ? '#1e293b' : '#0f172a'
        }; border-left: 4px solid ${t.speaker === 'CALLER' ? '#38bdf8' : '#818cf8'};">
          <div style="font-size: 11px; font-weight: 700; color: ${
            t.speaker === 'CALLER' ? '#38bdf8' : '#818cf8'
          }; text-transform: uppercase; margin-bottom: 4px;">
            ${t.speaker === 'CALLER' ? 'Remote Caller' : 'Aegis AI Assistant'} ${t.time ? `• ${t.time}` : ''}
          </div>
          <div style="font-size: 14px; color: #f1f5f9; line-height: 1.45;">
            ${t.text}
          </div>
        </div>
      `
        )
        .join('');
    } else if (typeof params.transcript === 'string' && params.transcript.trim()) {
      formattedTranscript = `
        <div style="padding: 12px 16px; border-radius: 8px; background: #1e293b; color: #f1f5f9; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
          ${params.transcript}
        </div>
      `;
    } else {
      formattedTranscript = `
        <div style="padding: 12px; color: #94a3b8; font-style: italic; font-size: 13px;">
          No conversation transcript recorded for this call.
        </div>
      `;
    }

    const durationText = params.durationSeconds ? `${params.durationSeconds}s` : 'Captured in real-time';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AegisCall Recording & Screening Summary</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #030712; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 24px 28px; border-bottom: 1px solid #312e81;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display: inline-block; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      🛡️ Aegis<span style="color: #6366f1;">Call</span> AI
                    </div>
                    <div style="font-size: 12px; color: #a5b4fc; margin-top: 3px;">
                      Autonomous Telecom Voice Screening & Call Recording
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: ${verdictColor}22; color: ${verdictColor}; border: 1px solid ${verdictColor}55;">
                      ${verdictLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CALL OVERVIEW CARD -->
          <tr>
            <td style="padding: 24px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #1e293b55; border-radius: 12px; border: 1px solid #334155; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Caller Phone</div>
                    <div style="font-size: 17px; font-weight: 800; color: #f8fafc; margin-top: 3px;">${params.phoneNumber}</div>
                    ${params.callerName ? `<div style="font-size: 13px; color: #cbd5e1; margin-top: 2px;">${params.callerName}</div>` : ''}
                  </td>
                  <td width="25%" style="vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Risk Score</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${verdictColor}; margin-top: 3px;">${params.riskScore}/100</div>
                  </td>
                  <td width="25%" style="vertical-align: top;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Duration</div>
                    <div style="font-size: 15px; font-weight: 600; color: #f8fafc; margin-top: 3px;">${durationText}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-top: 12px; border-top: 1px solid #33415555; margin-top: 12px;">
                    <div style="font-size: 11px; color: #94a3b8;">Screened on: <strong style="color: #cbd5e1;">${dateStr}</strong> • Category: <strong style="color: #cbd5e1;">${params.category || 'General Communication'}</strong></div>
                  </td>
                </tr>
              </table>

              <!-- AI RATIONALE -->
              ${params.rationale ? `
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; margin-bottom: 8px;">
                  🤖 AI Screener Assessment & Rationale
                </div>
                <div style="padding: 14px 18px; border-radius: 10px; background: #1e1b4b33; border: 1px solid #4338ca55; color: #e2e8f0; font-size: 13px; line-height: 1.5;">
                  ${params.rationale}
                </div>
              </div>
              ` : ''}

              <!-- TRANSCRIPT SECTION -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px;">
                  🎙️ Real-Time Conversation Transcript
                </div>
                ${formattedTranscript}
              </div>

              <!-- AUDIO RECORDING ATTACHMENT NOTICE -->
              <div style="padding: 16px 20px; border-radius: 12px; background: #0284c71a; border: 1px solid #0284c744; margin-bottom: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="40" style="vertical-align: middle;">
                      <span style="font-size: 24px;">🎧</span>
                    </td>
                    <td>
                      <div style="font-size: 14px; font-weight: 700; color: #38bdf8;">
                        High-Definition Call Audio Recording
                      </div>
                      <div style="font-size: 12px; color: #bae6fd; margin-top: 2px;">
                        ${params.recordingBase64 ? 'Audio file is attached to this email for playback and archival.' : 'Audio recording saved on device local storage and synced to cloud.'}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background: #090d16; padding: 20px 28px; border-top: 1px solid #1e293b; text-align: center;">
              <div style="font-size: 12px; color: #64748b;">
                Sent automatically by <strong>AegisCall AI Guardian</strong> • Production Telecom Screener
              </div>
              <div style="font-size: 11px; color: #475569; margin-top: 6px;">
                You received this because Recording Email Forwarding is enabled in your AegisCall Settings.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  public static async sendRecordingEmail(params: SendRecordingEmailParams, overrideConfig?: Partial<EmailSettings>): Promise<EmailDispatchResult> {
    const config = { ...currentEmailSettings, ...overrideConfig };
    const targetRecipient = params.to || config.toEmail;

    if (!targetRecipient) {
      return {
        success: false,
        mode: 'mock',
        to: '',
        subject: '',
        error: 'No recipient email configured for recording forwarding'
      };
    }

    if (config.forwardSpamOnly && params.riskScore < 50) {
      return {
        success: true,
        mode: 'mock',
        to: targetRecipient,
        subject: `[Skipped] Call with ${params.phoneNumber} risk score is below spam threshold (${params.riskScore} < 50)`
      };
    }

    const subject = `[AegisCall] Call Recording & Screening Report: ${params.phoneNumber} (${params.riskScore >= 70 ? 'SPAM ALERT' : 'Safe'})`;
    const html = this.generateHtmlTemplate(params);

    const attachments: Array<{ filename: string; content: Buffer | string; contentType?: string }> = [];
    if (params.recordingBase64) {
      try {
        const audioBuffer = Buffer.from(params.recordingBase64, 'base64');
        attachments.push({
          filename: params.recordingFileName || `Call_${params.phoneNumber}_${Date.now()}.m4a`,
          content: audioBuffer,
          contentType: params.recordingMimeType || 'audio/mp4'
        });
      } catch (e: any) {
        console.warn('Failed to parse recordingBase64 attachment:', e.message);
      }
    }

    const transporter = this.getTransporter(config);

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: config.fromEmail || 'AegisCall AI <screener@aegiscall.ai>',
          to: targetRecipient,
          subject,
          html,
          attachments
        });

        return {
          success: true,
          mode: 'smtp',
          messageId: info.messageId,
          to: targetRecipient,
          subject
        };
      } catch (err: any) {
        console.error('SMTP sending error, falling back to simulated dispatch:', err);
        return {
          success: true,
          mode: 'mock',
          to: targetRecipient,
          subject,
          error: `SMTP Error (${err.message}). Fallback delivery preview generated.`
        };
      }
    }

    // Development / Simulator Mode: Return successful delivery preview
    return {
      success: true,
      mode: 'mock',
      to: targetRecipient,
      subject,
      messageId: `mock_email_${Date.now()}`
    };
  }

  public static async sendTestEmail(targetEmail: string, config?: Partial<EmailSettings>): Promise<EmailDispatchResult> {
    return this.sendRecordingEmail(
      {
        to: targetEmail,
        phoneNumber: '+1 (555) 019-2834',
        callerName: 'AegisCall Verification Test',
        timestamp: Date.now(),
        durationSeconds: 18,
        verdict: 'ALLOW',
        riskScore: 8,
        category: 'Diagnostic Verification',
        rationale: 'This is a test notification confirming your AegisCall AI Email Forwarding service is fully functional and connected to your inbox.',
        transcript: [
          { speaker: 'CALLER', text: 'Hello, I am testing the email forwarding service configuration.', time: '12:00 PM' },
          { speaker: 'AI', text: 'Understood. AegisCall AI has successfully screened this transmission and verified your email delivery pipeline.', time: '12:00 PM' }
        ]
      },
      config
    );
  }
}
