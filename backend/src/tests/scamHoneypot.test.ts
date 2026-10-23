import { describe, it, expect } from 'vitest';
import { ScamHoneypotService } from '../services/scamHoneypotService.js';
import request from 'supertest';
import { createServer } from '../server.js';

describe('Autonomous AI Defensive Counter-Honeypot (Scam-Baiter Mode)', () => {
  it('generates believable stalling response using the ELDERLY_CONFUSED persona', () => {
    const result = ScamHoneypotService.generateStallingResponse({
      sessionId: 'test-sess-1',
      phoneNumber: '+1-800-555-SCAM',
      scammerUtterance: 'Please read the 6-digit verification OTP you received right now or your account will be frozen.',
      turnIndex: 1,
      preferredPersona: 'ELDERLY_CONFUSED'
    });

    expect(result.persona.id).toBe('ELDERLY_CONFUSED');
    expect(result.turnIndex).toBe(1);
    expect(result.scammerSecondsWasted).toBeGreaterThan(0);
    expect(result.aiStallingResponse).toMatch(/magnifying glass|spectacles|numbers/i);
    expect(result.scammerFrustrationIndex).toBeGreaterThan(0);
  });

  it('generates digital arrest diversion response pretending to invite scammer for herbal tea', () => {
    const result = ScamHoneypotService.generateStallingResponse({
      sessionId: 'test-sess-2',
      phoneNumber: '+91-98765-43210',
      scammerUtterance: 'You are under digital arrest by the police department for money laundering.',
      turnIndex: 2,
      preferredPersona: 'ELDERLY_CONFUSED'
    });

    expect(result.aiStallingResponse).toMatch(/police|herbal tea|cat/i);
    expect(result.scammerSecondsWasted).toBeGreaterThanOrEqual(30);
  });

  it('supports the SLOW_TYPING_WORKER persona with simulated Windows updates', () => {
    const result = ScamHoneypotService.generateStallingResponse({
      sessionId: 'test-sess-3',
      phoneNumber: '+1-888-555-0100',
      scammerUtterance: 'Click the link and submit your login ID',
      turnIndex: 3,
      preferredPersona: 'SLOW_TYPING_WORKER'
    });

    expect(result.persona.id).toBe('SLOW_TYPING_WORKER');
    expect(result.aiStallingResponse).toMatch(/updates|computer|portal/i);
  });

  it('aggregates total scammer time wasted and estimated victims protected', () => {
    const stats = ScamHoneypotService.getStats();
    expect(stats.totalSessionsEngaged).toBeGreaterThan(0);
    expect(stats.totalTurnsStalled).toBeGreaterThan(0);
    expect(stats.totalSecondsWasted).toBeGreaterThan(0);
    expect(stats.estimatedVictimsProtected).toBeGreaterThan(0);
  });

  it('serves honeypot API endpoints via HTTP', async () => {
    const app = createServer();

    // GET /api/honeypot/personas
    const personasRes = await request(app).get('/api/honeypot/personas');
    expect(personasRes.status).toBe(200);
    expect(personasRes.body.success).toBe(true);
    expect(personasRes.body.data.length).toBeGreaterThanOrEqual(3);

    // GET /api/honeypot/stats
    const statsRes = await request(app).get('/api/honeypot/stats');
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.data.totalSecondsWasted).toBeDefined();

    // POST /api/honeypot/turn
    const turnRes = await request(app)
      .post('/api/honeypot/turn')
      .send({
        phoneNumber: '+1-800-555-0199',
        scammerUtterance: 'Give me your credit card security CVV number',
        turnIndex: 1,
        preferredPersona: 'ELDERLY_CONFUSED'
      });

    expect(turnRes.status).toBe(200);
    expect(turnRes.body.success).toBe(true);
    expect(turnRes.body.data.aiStallingResponse).toBeDefined();
    expect(turnRes.body.data.scammerSecondsWasted).toBeGreaterThan(0);
  });
});
