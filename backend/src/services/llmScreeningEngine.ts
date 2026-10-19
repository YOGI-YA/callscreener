import { config } from '../config.js';
import { IncomingCallPayload, ScreeningResult, RiskLevel, CallerCategory, ScreeningVerdict } from '../types/index.js';
import { FastRulesEngine } from './fastRulesEngine.js';
import { inspectCallerUtterance } from './promptInjectionDefense.js';
import { evaluateStirShaken } from './stirShakenService.js';
import { v4 as uuidv4 } from 'uuid';

export class LLMScreeningEngine {
  /**
   * Main screening entry point: Security Checks -> Fast Rules First -> LLM -> Fallback
   */
  public static async screenCall(payload: IncomingCallPayload): Promise<ScreeningResult> {
    const startTime = Date.now();

    // 0. Stage 0: Security & Carrier Cryptographic Verification
    const rawTranscript = payload.simulatedAudioTranscript || payload.callerIntent || '';
    const injectionCheck = inspectCallerUtterance(rawTranscript);
    if (injectionCheck.isInjectionAttempt) {
      return {
        id: `scr-${uuidv4().slice(0, 8)}`,
        phoneNumber: payload.phoneNumber,
        callerName: payload.callerName || 'Adversarial Prompt Injection',
        verdict: 'REJECT',
        riskScore: 99,
        riskLevel: 'CRITICAL_SPAM',
        category: 'PHISHING_SCAM',
        confidence: 0.99,
        rationale: injectionCheck.rationale || 'Adversarial prompt injection attempt detected in caller audio.',
        engine: 'PROMPT_INJECTION_DEFENSE',
        latencyMs: Math.max(1, Date.now() - startTime),
        timestamp: new Date().toISOString(),
        suggestedActions: {
          disallowCall: true,
          silenceCall: false,
          rejectCall: true,
          skipCallLog: false,
          skipNotification: true,
        },
        metadata: {
          spoofProbability: 0.95,
          detectedKeywords: ['prompt_injection_blocked'],
        },
      };
    }

    const stirShaken = evaluateStirShaken(payload.phoneNumber, payload.callPresentationMode, payload.carrier);
    if (stirShaken.isConfirmedSpoof) {
      return {
        id: `scr-${uuidv4().slice(0, 8)}`,
        phoneNumber: payload.phoneNumber,
        callerName: payload.callerName || 'Spoofed Caller ID',
        verdict: 'REJECT',
        riskScore: 99,
        riskLevel: 'CRITICAL_SPAM',
        category: 'CARRIER_SPOOFED',
        confidence: 0.99,
        rationale: stirShaken.description,
        engine: 'STIR_SHAKEN_VERIFIER',
        latencyMs: Math.max(1, Date.now() - startTime),
        timestamp: new Date().toISOString(),
        suggestedActions: {
          disallowCall: true,
          silenceCall: false,
          rejectCall: true,
          skipCallLog: false,
          skipNotification: true,
        },
        metadata: {
          spoofProbability: 0.99,
          detectedKeywords: ['carrier_spoof_failed'],
        },
      };
    }

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
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) {
      return await this.simulateIntelligentAnalysis(payload, startTime);
    }

    if (config.llmProvider === 'ollama' || process.env.OLLAMA_BASE_URL) {
      return await this.callOllamaApi(payload, startTime);
    } else if (config.geminiApiKey && config.geminiApiKey.length > 10) {
      return await this.callGeminiApi(payload, startTime);
    } else {
      // Offline / Intelligent Mock Engine for development & testing without API key
      return await this.simulateIntelligentAnalysis(payload, startTime);
    }
  }

  /**
   * Calls Local Physical LLM via Ollama API (e.g. Llama 3.2 1B, Qwen 2.5)
   */
  private static async callOllamaApi(payload: IncomingCallPayload, startTime: number): Promise<ScreeningResult> {
    const prompt = `You are a real-time telecom security AI screener on an Android smartphone.
Analyze the incoming call details and return a strict JSON assessment.
Supports English, Hindi (हिंदी), and Hinglish transcripts. Detect phishing scams (e.g. Bijli bill cut, Bank KYC/OTP theft, KBC lottery, IRS/police impersonation) vs legitimate delivery/medical/work calls.

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

    const url = `${config.ollamaBaseUrl.replace(/\/+$/, '')}/api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: prompt,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama local API returned status ${response.status}`);
    }

    const data: any = await response.json();
    const rawText = data?.response;
    if (!rawText) {
      throw new Error('Empty response from local Ollama model');
    }

    const parsed = JSON.parse(rawText);
    const latencyMs = Math.max(1, Date.now() - startTime);

    const verdict: ScreeningVerdict = parsed.verdict || 'ALLOW';
    const riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 50;
    const riskLevel: RiskLevel = parsed.riskLevel || (riskScore > 75 ? 'CRITICAL_SPAM' : riskScore > 40 ? 'SUSPICIOUS' : 'SAFE');
    const category: CallerCategory = parsed.category || 'UNKNOWN';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9;
    const rationale = parsed.rationale || 'Physical local LLM evaluation complete.';

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
        llmModelUsed: `ollama/${config.ollamaModel}`
      }
    };
  }

  /**
   * Calls Google Gemini REST API with structured prompt
   */
  private static async callGeminiApi(payload: IncomingCallPayload, startTime: number): Promise<ScreeningResult> {
    const prompt = `You are a real-time telecom security AI screener on an Android smartphone.
Analyze the incoming call details and return a strict JSON assessment.
Supports English, Hindi (हिंदी), and Hinglish transcripts. Detect phishing scams (e.g. Bijli bill cut, Bank KYC/OTP theft, KBC lottery, IRS/police impersonation) vs legitimate delivery/medical/work calls.

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
    // Artificial small latency to simulate realistic LLM processing in dev
    if (process.env.NODE_ENV !== 'test') {
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 80) + 40));
    }

    const text = `${payload.callerName || ''} ${payload.callerIntent || ''} ${payload.simulatedAudioTranscript || ''}`.toLowerCase();
    const phone = payload.phoneNumber.replace(/[\s\-\(\)\.]/g, '');

    let verdict: ScreeningVerdict = 'ALLOW';
    let riskScore = 15;
    let riskLevel: RiskLevel = 'SAFE';
    let category: CallerCategory = 'UNKNOWN';
    let confidence = 0.88;
    let rationale = 'No elevated fraud signals detected. Call allowed.';
    let spoofProb = 0.05;

    // Check scam/telemarketing triggers (English, Hindi, Hinglish)
    if (
      text.includes('irs') ||
      text.includes('warrant') ||
      text.includes('arrest') ||
      text.includes('social security') ||
      text.includes('gift card') ||
      text.includes('bitcoin') ||
      text.includes('bijli') ||
      text.includes('power cut') ||
      text.includes('otp') ||
      text.includes('kyc') ||
      text.includes('block ho jayega') ||
      text.includes('lottery') ||
      text.includes('kbc') ||
      text.includes('बिजली') ||
      text.includes('ओटीपी')
    ) {
      verdict = 'REJECT';
      riskScore = 96;
      riskLevel = 'CRITICAL_SPAM';
      category = 'PHISHING_SCAM';
      rationale = 'AI detected high-urgency fraud / phishing cues (Electricity disconnection / OTP / Government impersonation).';
      spoofProb = 0.94;
    } else if (text.includes('warranty') || text.includes('insurance') || text.includes('rate reduction') || text.includes('free vacation') || text.includes('survey')) {
      verdict = 'REJECT';
      riskScore = 84;
      riskLevel = 'CRITICAL_SPAM';
      category = 'ROBOCALL';
      rationale = 'Detected automated telemarketing / expired warranty solicitation.';
      spoofProb = 0.75;
    } else if (
      text.includes('delivery') ||
      text.includes('package') ||
      text.includes('amazon') ||
      text.includes('fedex') ||
      text.includes('courier') ||
      text.includes('doordash') ||
      text.includes('zomato') ||
      text.includes('swiggy') ||
      text.includes('zepto') ||
      text.includes('blinkit') ||
      text.includes('parcel') ||
      text.includes('gate') ||
      text.includes('bhaiya')
    ) {
      verdict = 'ALLOW';
      riskScore = 8;
      riskLevel = 'SAFE';
      category = 'DELIVERY_SERVICE';
      rationale = 'Recognized legitimate logistics / food courier delivery communication.';
      spoofProb = 0.02;
    } else if (
      text.includes('doctor') ||
      text.includes('appointment') ||
      text.includes('clinic') ||
      text.includes('prescription') ||
      text.includes('hospital') ||
      text.includes('डॉक्टर') ||
      text.includes('अस्पताल') ||
      text.includes('अपॉइंटमेंट') ||
      text.includes('apollo')
    ) {
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

  /**
   * Generates a real-time ChatGPT-style conversational turn response
   * using the Free Gemini 2.0 / 1.5 Flash tier or local offline engine.
   */
  public static async generateConversationalTurn(params: {
    phoneNumber: string;
    callerName?: string;
    callerUtterance: string;
    dialogueHistory: { sender: 'AI_ASSISTANT' | 'CALLER'; text: string }[];
    language?: 'AUTO' | 'EN' | 'HI' | 'HINGLISH';
  }): Promise<{
    aiSpeech: string;
    intentCategory: string;
    riskScore: number;
    recommendedVerdict: 'ALLOW' | 'REJECT' | 'SILENCE';
    suggestedSmartReplies: string[];
  }> {
    const historyText = params.dialogueHistory
      .map((t) => `${t.sender === 'AI_ASSISTANT' ? 'AI Screener' : 'Caller'}: "${t.text}"`)
      .join('\n');

    const prompt = `You are "Aegis", an ultra-intelligent, polite, concise AI executive personal assistant screening a real phone call for Yogi.
You are speaking directly to the CALLER on the telephone line right now.

CALLER INFO:
- Name: ${params.callerName || 'Unknown'}
- Number: ${params.phoneNumber}
- Conversation so far:
${historyText || 'No prior turns.'}
- Latest utterance from Caller: "${params.callerUtterance}"

YOUR OBJECTIVE:
Respond to the caller naturally, politely, and casually like a real human assistant.
CRITICAL RULES:
1. Speak concisely in 1 single sentence (under 18 words).
2. If it is a delivery/courier (Swiggy, Zomato, Amazon, courier): acknowledge and ask them to leave it at the door or with the guard.
3. If it is a friend, colleague, or family: say Yogi is momentarily busy and you will notify him to pick up right now.
4. If it is a spammer, loan/credit card marketer, or scam (electricity bill, OTP, lottery): firmly and politely decline and end the call.
5. If they just said hello or asked for Yogi: ask who is calling and what it is regarding.
6. Language: Match caller language naturally. If Hindi (हिंदी), reply in Hindi. If Hinglish, reply in Hinglish. If English, reply in natural English.

OUTPUT JSON ONLY:
{
  "aiSpeech": "The exact natural human-like sentence to speak out loud to the caller",
  "intentCategory": "DELIVERY_SERVICE" | "PHISHING_SCAM" | "TELEMARKETING" | "VERIFIED_CONTACT" | "UNKNOWN",
  "riskScore": number (0 to 100),
  "recommendedVerdict": "ALLOW" | "REJECT",
  "suggestedSmartReplies": ["3 quick one-tap actions for user"]
}`;

    if (config.geminiApiKey && config.geminiApiKey.length > 10) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llmModel}:generateContent?key=${config.geminiApiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data: any = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            return {
              aiSpeech: parsed.aiSpeech || 'Understood, thank you.',
              intentCategory: parsed.intentCategory || 'UNKNOWN',
              riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : 20,
              recommendedVerdict: parsed.recommendedVerdict || 'ALLOW',
              suggestedSmartReplies: Array.isArray(parsed.suggestedSmartReplies)
                ? parsed.suggestedSmartReplies
                : ['Ask for details', 'Leave at door', 'Hang up']
            };
          }
        }
      } catch (e) {
        // Fall back to high-speed deterministic heuristic
      }
    }

    // High-speed conversational heuristic fallback (<1ms)
    return this.generateHeuristicConversationalTurn(params.callerUtterance, params.language);
  }

  private static generateHeuristicConversationalTurn(
    utterance: string,
    langPref?: string
  ): {
    aiSpeech: string;
    intentCategory: string;
    riskScore: number;
    recommendedVerdict: 'ALLOW' | 'REJECT' | 'SILENCE';
    suggestedSmartReplies: string[];
  } {
    const text = utterance.toLowerCase();
    const isHindi = /[\u0900-\u097F]/.test(utterance) || langPref === 'HI';
    const isHinglish = /aapka|bhaiya|karein|karna|bijli|swiggy|zomato|karo|nahi|turant/.test(text) || langPref === 'HINGLISH';

    // 1. Phishing / Scam detection
    if (text.includes('electricity') || text.includes('bijli') || text.includes('warrant') || text.includes('irs') || text.includes('otp') || text.includes('kyc') || text.includes('lottery') || text.includes('block your')) {
      return {
        aiSpeech: isHindi
          ? 'यह कॉल संदिग्ध फ्रॉड पाई गई है। हम यह कॉल डिस्कनेक्ट कर रहे हैं।'
          : isHinglish
          ? 'Ye call scam suspicious mark hui hai. Disconnecting now.'
          : 'This call has been identified as a suspected scam. Disconnecting now.',
        intentCategory: 'PHISHING_SCAM',
        riskScore: 95,
        recommendedVerdict: 'REJECT',
        suggestedSmartReplies: ['Report scam', 'Ask for ID', 'Hang up']
      };
    }

    // 2. Delivery detection
    if (text.includes('delivery') || text.includes('package') || text.includes('amazon') || text.includes('swiggy') || text.includes('zomato') || text.includes('fedex') || text.includes('gate') || text.includes('parcel')) {
      return {
        aiSpeech: isHindi
          ? 'नमस्ते, कृपया पार्सल मेन दरवाजे के पास छोड़ दीजिए। धन्यवाद!'
          : isHinglish
          ? 'Bhaiya parcel flat ke main door ke paas chhod dijiye, thank you!'
          : 'Hi! Please leave the package safely by the front door. Thank you!',
        intentCategory: 'DELIVERY_SERVICE',
        riskScore: 5,
        recommendedVerdict: 'ALLOW',
        suggestedSmartReplies: ['Leave at door', 'Give to guard', 'Take over']
      };
    }

    // 3. Telemarketing / Loans / Insurance
    if (text.includes('loan') || text.includes('credit card') || text.includes('offer') || text.includes('investment') || text.includes('insurance')) {
      return {
        aiSpeech: isHindi
          ? 'हम किसी भी मार्केटिंग सेवा में रुचि नहीं रखते हैं। कृपया लिस्ट से नाम हटा दें।'
          : isHinglish
          ? 'Hum kisi marketing offer me interested nahi hain, thank you.'
          : 'We are not interested in promotional offers at this time. Thank you, have a good day.',
        intentCategory: 'TELEMARKETING',
        riskScore: 80,
        recommendedVerdict: 'REJECT',
        suggestedSmartReplies: ['Not interested', 'Put on DND', 'Hang up']
      };
    }

    // 4. General query / Unknown
    return {
      aiSpeech: isHindi
        ? 'प्राप्तकर्ता अभी व्यस्त हैं। क्या आप अपना नाम और कॉल करने का कारण बता सकते हैं?'
        : isHinglish
        ? 'Yogi abhi busy hain. Please apna naam aur call ka reason bataiye?'
        : 'The recipient is currently unavailable. Could you please state your name and what this is regarding?',
      intentCategory: 'UNKNOWN',
      riskScore: 25,
      recommendedVerdict: 'ALLOW',
      suggestedSmartReplies: ['Who is calling?', 'Call back later', 'Take over']
    };
  }
}
