import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../server.js';
import { CallLogStorage } from '../services/callLogStorage.js';

describe('Backend REST API Routes', () => {
  const app = createServer();

  beforeEach(() => {
    CallLogStorage.initializeSeedData();
  });

  it('GET /api/health returns status online', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.service).toContain('Call Screener');
  });

  it('POST /api/screen-call screens an incoming call and logs it', async () => {
    const res = await request(app)
      .post('/api/screen-call')
      .send({
        phoneNumber: '+1-202-555-0199',
        callerName: 'IRS Legal Unit',
        simulatedAudioTranscript: 'Arrest warrant active. Call back immediately.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verdict).toBe('REJECT');
    expect(res.body.data.suggestedActions.disallowCall).toBe(true);
  });

  it('POST /api/screen-call rejects invalid payload missing phoneNumber', async () => {
    const res = await request(app).post('/api/screen-call').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/rules returns system rules list', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/rules adds a new custom rule', async () => {
    const res = await request(app)
      .post('/api/rules')
      .send({
        type: 'BLACKLIST',
        pattern: '^\\+1-999-999-9999$',
        description: 'Persistent Spam Caller',
        action: 'REJECT',
        enabled: true
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('GET /api/logs retrieves call history and stats', async () => {
    const resLogs = await request(app).get('/api/logs');
    expect(resLogs.status).toBe(200);
    expect(resLogs.body.success).toBe(true);
    expect(resLogs.body.count).toBeGreaterThan(0);

    const resStats = await request(app).get('/api/logs/stats');
    expect(resStats.status).toBe(200);
    expect(resStats.body.data.totalCallsScreened).toBeGreaterThan(0);
  });

  it('GET /api/threat-matrix returns telecom threat telemetry and attestation breakdown', async () => {
    const res = await request(app).get('/api/threat-matrix');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attestationBreakdown).toBeDefined();
    expect(res.body.data.threatVectorDistribution).toBeDefined();
    expect(Array.isArray(res.body.data.hourlyAttackDistribution)).toBe(true);
    expect(res.body.data.hourlyAttackDistribution.length).toBe(24);
  });

  it('POST /api/simulate-scenario evaluates adversarial caller prompts with risk analysis', async () => {
    const res = await request(app)
      .post('/api/simulate-scenario')
      .send({
        scenarioId: 'test-scenario',
        phoneNumber: '+1-800-829-1040',
        callerName: 'IRS Officer',
        callerUtterance: 'Urgent notice regarding your federal taxes. An arrest warrant has been filed.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scenarioId).toBe('test-scenario');
    expect(res.body.data.result.verdict).toBe('REJECT');
    expect(res.body.data.isAdversarialAttackDetected).toBe(true);
  });
});
