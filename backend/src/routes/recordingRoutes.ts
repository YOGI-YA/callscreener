import { Router, Request, Response } from 'express';
import { EmailService } from '../services/emailService.js';

export const recordingRouter = Router();

// POST /api/recordings/forward-email - Manual or automatic forward of call recording
recordingRouter.post('/forward-email', async (req: Request, res: Response) => {
  try {
    const {
      to,
      phoneNumber,
      callerName,
      timestamp,
      durationSeconds,
      verdict = 'ALLOW',
      riskScore = 0,
      category,
      rationale,
      transcript,
      recordingBase64,
      recordingMimeType,
      recordingFileName
    } = req.body;

    if (!phoneNumber) {
      res.status(400).json({
        success: false,
        error: 'phoneNumber is required'
      });
      return;
    }

    const result = await EmailService.sendRecordingEmail({
      to,
      phoneNumber,
      callerName,
      timestamp: timestamp || Date.now(),
      durationSeconds,
      verdict,
      riskScore,
      category,
      rationale,
      transcript,
      recordingBase64,
      recordingMimeType,
      recordingFileName
    });

    res.json({
      success: result.success,
      mode: result.mode,
      to: result.to,
      subject: result.subject,
      messageId: result.messageId,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch recording email'
    });
  }
});

// GET /api/recordings/email-settings - Get email forwarding preferences
recordingRouter.get('/email-settings', (_req: Request, res: Response) => {
  const settings = EmailService.getSettings();
  // Mask sensitive password
  const maskedSettings = {
    ...settings,
    smtpPass: settings.smtpPass ? '••••••••' : ''
  };
  res.json({
    success: true,
    settings: maskedSettings
  });
});

// PUT /api/recordings/email-settings - Update email forwarding preferences
recordingRouter.put('/email-settings', (req: Request, res: Response) => {
  try {
    const {
      enabled,
      toEmail,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpSecure,
      fromEmail,
      forwardSpamOnly,
      autoForwardOnDisconnect
    } = req.body;

    const updates: any = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof toEmail === 'string') updates.toEmail = toEmail.trim();
    if (typeof smtpHost === 'string') updates.smtpHost = smtpHost.trim();
    if (typeof smtpPort === 'number') updates.smtpPort = smtpPort;
    if (typeof smtpUser === 'string') updates.smtpUser = smtpUser.trim();
    if (typeof smtpPass === 'string' && smtpPass !== '••••••••') updates.smtpPass = smtpPass;
    if (typeof smtpSecure === 'boolean') updates.smtpSecure = smtpSecure;
    if (typeof fromEmail === 'string') updates.fromEmail = fromEmail.trim();
    if (typeof forwardSpamOnly === 'boolean') updates.forwardSpamOnly = forwardSpamOnly;
    if (typeof autoForwardOnDisconnect === 'boolean') updates.autoForwardOnDisconnect = autoForwardOnDisconnect;

    const saved = EmailService.updateSettings(updates);
    res.json({
      success: true,
      settings: {
        ...saved,
        smtpPass: saved.smtpPass ? '••••••••' : ''
      }
    });
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message || 'Failed to update email preferences'
    });
  }
});

// POST /api/recordings/test-email - Trigger diagnostic test email
recordingRouter.post('/test-email', async (req: Request, res: Response) => {
  try {
    const { toEmail } = req.body;
    const target = toEmail || EmailService.getSettings().toEmail;

    if (!target) {
      res.status(400).json({
        success: false,
        error: 'Target email is required. Please provide toEmail or save default recipient in settings.'
      });
      return;
    }

    const result = await EmailService.sendTestEmail(target);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test email'
    });
  }
});
