import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../server.js';
import { EmailService } from '../services/emailService.js';

describe('Recording Email Forwarding Service & Endpoints', () => {
  const app = createServer();

  beforeEach(() => {
    EmailService.updateSettings({
      enabled: true,
      toEmail: 'testuser@example.com',
      smtpHost: '',
      smtpUser: '',
      smtpPass: '',
      forwardSpamOnly: false,
      autoForwardOnDisconnect: true
    });
  });

  describe('EmailService unit tests', () => {
    it('generates rich HTML template containing caller details and transcript', () => {
      const html = EmailService.generateHtmlTemplate({
        phoneNumber: '+1-555-432-1099',
        callerName: 'Acme Logistics',
        timestamp: 1700000000000,
        verdict: 'ALLOW',
        riskScore: 12,
        category: 'Delivery',
        rationale: 'Driver confirming delivery gate code.',
        transcript: [
          { speaker: 'CALLER', text: 'Hi, I am outside your gate with the package.', time: '10:00 AM' },
          { speaker: 'AI', text: 'Please leave it with the front desk.', time: '10:00 AM' }
        ]
      });

      expect(html).toContain('Aegis');
      expect(html).toContain('+1-555-432-1099');
      expect(html).toContain('Acme Logistics');
      expect(html).toContain('12/100');
      expect(html).toContain('Hi, I am outside your gate');
      expect(html).toContain('Please leave it with the front desk.');
    });

    it('rejects sending when no recipient email is configured', async () => {
      EmailService.updateSettings({ toEmail: '' });
      const result = await EmailService.sendRecordingEmail({
        phoneNumber: '+1-555-000-1111',
        verdict: 'ALLOW',
        riskScore: 5
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No recipient email');
    });

    it('successfully sends email in mock mode with audio attachment', async () => {
      const sampleAudioBase64 = Buffer.from('RIFF....WAVEfmt ').toString('base64');
      const result = await EmailService.sendRecordingEmail({
        to: 'recipient@example.com',
        phoneNumber: '+1-555-987-6543',
        verdict: 'ALLOW',
        riskScore: 10,
        recordingBase64: sampleAudioBase64,
        recordingFileName: 'call_rec.wav'
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('mock');
      expect(result.to).toBe('recipient@example.com');
      expect(result.subject).toContain('+1-555-987-6543');
    });
  });

  describe('Recording and Email API Routes', () => {
    it('GET /api/recordings/email-settings returns current configuration', async () => {
      const res = await request(app).get('/api/recordings/email-settings');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.settings.toEmail).toBe('testuser@example.com');
    });

    it('PUT /api/recordings/email-settings updates configuration', async () => {
      const res = await request(app)
        .put('/api/recordings/email-settings')
        .send({
          toEmail: 'forwarded@enterprise.org',
          forwardSpamOnly: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.settings.toEmail).toBe('forwarded@enterprise.org');
      expect(res.body.settings.forwardSpamOnly).toBe(true);
    });

    it('POST /api/recordings/forward-email dispatches email forwarding', async () => {
      const res = await request(app)
        .post('/api/recordings/forward-email')
        .send({
          to: 'alert@mysecurity.com',
          phoneNumber: '+1-800-444-2222',
          callerName: 'Telemarketer',
          verdict: 'REJECT',
          riskScore: 92,
          category: 'Robocall',
          rationale: 'Recorded voice promoting fake vacation package.',
          transcript: 'Congratulations, you have won a free cruise!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.to).toBe('alert@mysecurity.com');
    });

    it('POST /api/recordings/forward-email validates required phoneNumber', async () => {
      const res = await request(app)
        .post('/api/recordings/forward-email')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('phoneNumber is required');
    });

    it('POST /api/recordings/test-email sends verification email', async () => {
      const res = await request(app)
        .post('/api/recordings/test-email')
        .send({ toEmail: 'diagnostic@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.to).toBe('diagnostic@test.com');
    });
  });
});
