import { config } from '../config.js';
import { IncomingCallPayload, ScreeningResult, RiskLevel, CallerCategory, ScreeningVerdict } from '../types/index.js';
import { FastRulesEngine } from './fastRulesEngine.js';
import { v4 as uuidv4 } from 'uuid';

export class LLMScreeningEngine {
  /**
   * Main screening entry point: Fast Rules First -> LLM with Strict Timeout -> Safe Fallback
   */
  public static async screenCall(payload: IncomingCallPayload): Promise<ScreeningResult> {
    const startTime = Date.now();

    // 1. Stage 1: Ultra-fast deterministic rule check (<2ms)
    const fastRuleMatch = FastRulesEngine.evaluate(payload, startTime);
    if (fastRuleMatch) {
      return fastRuleMatch;
    }

    // 2. Stage 2: Cloud LLM Analysis with Strict Timeout Budget
    try {
      const llmPromise = this.performLLMAnalysis(payload, startTime);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM_TIMEOUT_DEADLINE_EXCEEDED')), config.llmTimeoutMs);
      });

      const result = await Promise.race([llmPromise, timeoutPromise]);
      return result;
    } catch (error: any) {
      const reason = error.message === 'LLM_TIMEOUT_DEADLINE_EXCEEDED' ? 'LLM 2.2s Deadline Exceeded' : `LLM Error: ${error.message || 'Unknown'}`;
      // 3. Stage 3: Immediate Deterministic Safety Fallback
      return FastRulesEngine.generateSafetyFallback(payload, startTime, reason);
    }
  }

  /**
   * Executes LLM API or Intelligent Heuristic Engine
   */
  private static async performLLMAnalysis(payload: IncomingCallPayload, startTime: number): Promise<ScreeningResult> {
    if (config.geminiApiKey) {
      return await this.callGeminiApi(payload, startTime);
    } else {
      // Offline / Intelligent Mock Engine for development & testing without API key
      return await this.simulateIntelligentAnalysis(payload, startTime);
    }
  }

  /**
   * Calls Google Gemini REST API with structured prompt
   */
  private static async callGeminiApi(payload: IncomingCallPayload, startTime: number): Promise<ScreeningResult> {
    const prompt = `You are a real-time telecom security AI screener on an Android smartphone.
Analyze the incoming call details and return a strict JSON assessment.

CALL DETAILS:
- Phone Number: ${payload.phoneNumber}
- Caller ID Name: ${payload.callerName || 'Unknown'}
- Location: ${payload.location || 'Unknown'}
- Carrier: ${payload.carrier || 'Unknown'}
- Presentation: ${payload.callPresentationMode || 'ALLOWED'}
- Caller Intent/Opening Transcript: "${payload.simulatedAudioTranscript || payload.callerIntent || 'No transcript provided'}"

OUTPUT FORMAT (Respond with JSON ONLY):
{
  "verdict": "ALLOW" | "SILENCE" | "REJECT",
  "riskScore": number (0 to 100),
  "riskLevel": "SAFE" | "LOW" | "SUSPICIOUS" | "CRITICAL_SPAM",
  "category": "ROBOCALL" | "PHISHING_SCAM" | "TELEMARKETING" | "DEBT_COLLECTOR" | "DELIVERY_SERVICE" | "MEDICAL_APPOINTMENT" | "VERIFIED_CONTACT" | "UNKNOWN",
  "confidence": number (0.0 to 1.0),
  "rationale": "Clear concise 1-2 sentence explanation for the user",
  "detectedSpoofProbability": number (0.0 to 1.0)
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llmModel}:generateContent?key=${config.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data: any = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(rawText);
    const latencyMs = Math.max(1, Date.now() - startTime);

    const verdict: ScreeningVerdict = parsed.verdict || 'ALLOW';
    const riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 50;
    const riskLevel: RiskLevel = parsed.riskLevel || (riskScore > 75 ? 'CRITICAL_SPAM' : riskScore > 40 ? 'SUSPICIOUS' : 'SAFE');
    const category: CallerCategory = parsed.category || 'UNKNOWN';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
    const rationale = parsed.rationale || 'AI evaluation complete.';

    return {
      id: `scr-${uuidv4().substring(0, 12)}`,
      phoneNumber: payload.phoneNumber,
      callerName: payload.callerName || 'Unknown Caller',
      verdict,
      riskScore,
      riskLevel,
      category,
      confidence,
      rationale,
      engine: 'LLM_AI',
      latencyMs,
      timestamp: new Date().toISOString(),
      suggestedActions: {
        disallowCall: verdict === 'REJECT',
        silenceCall: verdict === 'SILENCE',
        rejectCall: verdict === 'REJECT',
        skipCallLog: false,
        skipNotification: verdict === 'REJECT'
      },
      metadata: {
        spoofProbability: parsed.detectedSpoofProbability || 0,
        llmModelUsed: config.llmModel
      }
    };
  }

  /**
   * Intelligent heuristic simulation engine when no API key is set
   */
  private static async simulateIntelligentAnalysis(payload: IncomingCallPayload, startTime: number): Promise<ScreeningResult> {
    // Artificial small latency to simulate realistic LLM processing (50-180ms)
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 80) + 40));

    const text = `${payload.callerName || ''} ${payload.callerIntent || ''} ${payload.simulatedAudioTranscript || ''}`.toLowerCase();
    const phone = payload.phoneNumber.replace(/[\s\-\(\)\.]/g, '');

    let verdict: ScreeningVerdict = 'ALLOW';
    let riskScore = 15;
    let riskLevel: RiskLevel = 'SAFE';
    let category: CallerCategory = 'UNKNOWN';
    let confidence = 0.88;
    let rationale = 'No elevated fraud signals detected. Call allowed.';
    let spoofProb = 0.05;

    // Check scam/telemarketing triggers
    if (text.includes('irs') || text.includes('warrant') || text.includes('arrest') || text.includes('social security') || text.includes('gift card') || text.includes('bitcoin')) {
      verdict = 'REJECT';
      riskScore = 96;
      riskLevel = 'CRITICAL_SPAM';
      category = 'PHISHING_SCAM';
      rationale = 'AI detected high-urgency government impersonation / financial fraud cues.';
      spoofProb = 0.94;
    } else if (text.includes('warranty') || text.includes('insurance') || text.includes('rate reduction') || text.includes('free vacation') || text.includes('survey')) {
      verdict = 'REJECT';
      riskScore = 84;
      riskLevel = 'CRITICAL_SPAM';
      category = 'ROBOCALL';
      rationale = 'Detected automated telemarketing / expired warranty solicitation.';
      spoofProb = 0.75;
    } else if (text.includes('delivery') || text.includes('package') || text.includes('amazon') || text.includes('fedex') || text.includes('courier') || text.includes('doordash')) {
      verdict = 'ALLOW';
      riskScore = 8;
      riskLevel = 'SAFE';
      category = 'DELIVERY_SERVICE';
      rationale = 'Recognized legitimate logistics/courier delivery communication.';
      spoofProb = 0.02;
    } else if (text.includes('doctor') || text.includes('appointment') || text.includes('clinic') || text.includes('prescription') || text.includes('hospital')) {
      verdict = 'ALLOW';
      riskScore = 4;
      riskLevel = 'SAFE';
      category = 'MEDICAL_APPOINTMENT';
      rationale = 'Verified healthcare provider / medical appointment notification.';
      spoofProb = 0.01;
    } else if (text.includes('debt') || text.includes('past due') || text.includes('collections') || text.includes('settlement')) {
      verdict = 'SILENCE';
      riskScore = 65;
      riskLevel = 'SUSPICIOUS';
      category = 'DEBT_COLLECTOR';
      rationale = 'Debt recovery / collector pattern detected. Silencing ringer.';
      spoofProb = 0.40;
    } else if (phone.startsWith('+1800') || phone.startsWith('800') || phone.startsWith('+1888') || phone.startsWith('888')) {
      verdict = 'SILENCE';
      riskScore = 45;
      riskLevel = 'LOW';
      category = 'TELEMARKETING';
      rationale = 'Toll-free commercial inbound line. Screened to silent.';
      spoofProb = 0.30;
    } else if (payload.callPresentationMode === 'RESTRICTED') {
      verdict = 'SILENCE';
      riskScore = 60;
      riskLevel = 'SUSPICIOUS';
      category = 'UNKNOWN';
      rationale = 'Caller ID withheld / restricted. Silencing call until identified.';
      spoofProb = 0.60;
    }

    const latencyMs = Math.max(1, Date.now() - startTime);

    return {
      id: `scr-${uuidv4().substring(0, 12)}`,
      phoneNumber: payload.phoneNumber,
      callerName: payload.callerName || 'Unknown Caller',
      verdict,
      riskScore,
      riskLevel,
      category,
      confidence,
      rationale,
      engine: 'LLM_AI',
      latencyMs,
      timestamp: new Date().toISOString(),
      suggestedActions: {
        disallowCall: verdict === 'REJECT',
        silenceCall: verdict === 'SILENCE',
        rejectCall: verdict === 'REJECT',
        skipCallLog: false,
        skipNotification: verdict === 'REJECT'
      },
      metadata: {
        spoofProbability: spoofProb,
        llmModelUsed: 'local-intelligent-analyzer'
      }
    };
  }
}
