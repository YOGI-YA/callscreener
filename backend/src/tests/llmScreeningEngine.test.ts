import { describe, it, expect } from 'vitest';
import { LLMScreeningEngine } from '../services/llmScreeningEngine.js';

describe('LLMScreeningEngine', () => {
  it('screens IRS scam and produces REJECT verdict with high risk score', async () => {
    const result = await LLMScreeningEngine.screenCall({
      phoneNumber: '+1-202-555-0144',
      callerName: 'Internal Revenue Service Agent',
      simulatedAudioTranscript: 'You owe back taxes. Pay immediately using gift cards or police will be dispatched.',
      callerIntent: 'Collect fraudulent debt'
    });

    expect(result.verdict).toBe('REJECT');
    expect(result.riskScore).toBeGreaterThanOrEqual(80);
    expect(result.category).toBe('PHISHING_SCAM');
    expect(result.suggestedActions.disallowCall).toBe(true);
    expect(result.suggestedActions.rejectCall).toBe(true);
  });

  it('screens legitimate delivery courier and allows call with low risk score', async () => {
    const result = await LLMScreeningEngine.screenCall({
      phoneNumber: '+1-415-555-8812',
      callerName: 'Amazon Logistics Driver',
      simulatedAudioTranscript: 'Hi, this is your Amazon courier. I am at the gate with your delivery package.',
      callerIntent: 'Delivery gate access'
    });

    expect(result.verdict).toBe('ALLOW');
    expect(result.riskScore).toBeLessThanOrEqual(25);
    expect(result.category).toBe('DELIVERY_SERVICE');
    expect(result.suggestedActions.disallowCall).toBe(false);
  });

  it('screens medical clinic appointment and allows call with SAFE score', async () => {
    const result = await LLMScreeningEngine.screenCall({
      phoneNumber: '+1-650-555-3000',
      callerName: 'Stanford Health Care Clinic',
      simulatedAudioTranscript: 'Calling to confirm your doctor appointment tomorrow morning at 10 AM.',
      callerIntent: 'Appointment confirmation'
    });

    expect(result.verdict).toBe('ALLOW');
    expect(result.riskScore).toBeLessThanOrEqual(20);
    expect(result.category).toBe('MEDICAL_APPOINTMENT');
  });

  it('silences suspicious debt collection calls', async () => {
    const result = await LLMScreeningEngine.screenCall({
      phoneNumber: '+1-800-555-9988',
      callerName: 'National Recovery Bureau',
      simulatedAudioTranscript: 'This is a message concerning a past due collections matter for immediate settlement.',
      callerIntent: 'Debt collection'
    });

    expect(result.verdict).toBe('SILENCE');
    expect(result.suggestedActions.silenceCall).toBe(true);
  });

  it('screens Hinglish Zomato food delivery call as SAFE ALLOW', async () => {
    const result = await LLMScreeningEngine.screenCall({
      phoneNumber: '+91-98111-22233',
      callerName: 'Zomato Delivery Partner',
      simulatedAudioTranscript: 'Bhaiya main Zomato se food parcel leke aapke building gate ke paas khada hoon. Guard entry permit kar dijiye.',
      callerIntent: 'Food delivery'
    });

    expect(result.verdict).toBe('ALLOW');
    expect(result.category).toBe('DELIVERY_SERVICE');
    expect(result.riskScore).toBeLessThanOrEqual(20);
  });

  it('screens Devanagari Hindi Apollo hospital appointment as SAFE ALLOW', async () => {
    const result = await LLMScreeningEngine.screenCall({
      phoneNumber: '+91-11-2659-8700',
      callerName: 'Apollo Hospitals Reception',
      simulatedAudioTranscript: 'नमस्ते, अपोलो अस्पताल से कॉल है। कल सुबह डॉक्टर वर्मा के साथ आपका अपॉइंटमेंट है।',
      callerIntent: 'Medical appointment'
    });

    expect(result.verdict).toBe('ALLOW');
    expect(result.category).toBe('MEDICAL_APPOINTMENT');
    expect(result.riskScore).toBeLessThanOrEqual(20);
  });
});
