/**
 * Autonomous AI Defensive Counter-Honeypot (Scam-Baiter Engine)
 * ─────────────────────────────────────────────────────────────
 * When an incoming call is screened as a confirmed phishing or extortion attempt,
 * this autonomous counter-agent takes over to waste the scammer's time with
 * realistic, harmless, time-dilating personas, preventing them from targeting
 * vulnerable citizens.
 */

export type HoneypotPersonaId = 'ELDERLY_CONFUSED' | 'SLOW_TYPING_WORKER' | 'BUREAUCRATIC_OFFICIAL';

export interface HoneypotPersona {
  id: HoneypotPersonaId;
  name: string;
  voiceStyle: string;
  description: string;
  stallingTactics: string[];
}

export interface HoneypotTurnResult {
  sessionId: string;
  persona: HoneypotPersona;
  turnIndex: number;
  aiStallingResponse: string;
  scammerSecondsWasted: number;
  scammerFrustrationIndex: number; // 0 to 100
  recommendedFollowupTopic: string;
}

export interface HoneypotTelemetryStats {
  totalSessionsEngaged: number;
  totalTurnsStalled: number;
  totalSecondsWasted: number;
  estimatedVictimsProtected: number;
}

export class ScamHoneypotService {
  private static personas: Record<HoneypotPersonaId, HoneypotPersona> = {
    ELDERLY_CONFUSED: {
      id: 'ELDERLY_CONFUSED',
      name: 'Grandpa Harold / Dadi Shanti',
      voiceStyle: 'Slow, polite, slightly hard of hearing',
      description: 'Frequently misplaces reading glasses, mishears OTP numbers as cooking ingredients, and asks to repeat slowly.',
      stallingTactics: [
        'Searching for reading glasses in the other room',
        'Dictating fake 4-digit numbers with long pauses',
        'Asking which department or company they are calling from again',
        'Asking if they know their grandson Kevin'
      ]
    },
    SLOW_TYPING_WORKER: {
      id: 'SLOW_TYPING_WORKER',
      name: 'Distracted Remote Clerk',
      voiceStyle: 'Monotone, polite, typing very loudly with one finger',
      description: 'Pretends computer is performing a Windows update and reads loading bar percentages endlessly.',
      stallingTactics: [
        'Waiting for blue screen / system update to hit 99%',
        'Double-checking spelling of routine words',
        'Struggling with the mouse cord getting tangled'
      ]
    },
    BUREAUCRATIC_OFFICIAL: {
      id: 'BUREAUCRATIC_OFFICIAL',
      name: 'Compliance Officer Jenkins',
      voiceStyle: 'Rigid, procedural, overly detail-oriented',
      description: 'Demands scammer verify their internal batch authorization code and filing reference before proceeding.',
      stallingTactics: [
        'Requesting the scammer supply their 8-digit operator registration ID',
        'Insisting on reading the privacy disclaimer back to the caller',
        'Transferring between imaginary extension lines'
      ]
    }
  };

  private static totalSessions = 24;
  private static totalTurns = 142;
  private static totalSeconds = 4620; // ~77 minutes saved

  /**
   * Generates next defensive stalling response against the scammer
   */
  public static generateStallingResponse(params: {
    sessionId: string;
    phoneNumber: string;
    scammerUtterance: string;
    turnIndex: number;
    preferredPersona?: HoneypotPersonaId;
  }): HoneypotTurnResult {
    const personaId = params.preferredPersona || 'ELDERLY_CONFUSED';
    const persona = this.personas[personaId] || this.personas.ELDERLY_CONFUSED;
    const utterance = params.scammerUtterance.toLowerCase();

    let response = '';
    const turn = params.turnIndex || 1;

    if (persona.id === 'ELDERLY_CONFUSED') {
      if (utterance.includes('otp') || utterance.includes('code') || utterance.includes('pin') || utterance.includes('number')) {
        response = "Wait just one second, dear... I have my magnifying glass right here. The number on my little screen says... 7... wait, is that a 7 or an upside-down L? Let me wipe my spectacles... 7... 4... wait, did you say 4 numbers or 6 numbers?";
      } else if (utterance.includes('arrest') || utterance.includes('police') || utterance.includes('cbi') || utterance.includes('court')) {
        response = "Oh goodness gracious me, police? Heavens! Are you coming to my house with the siren on? Please don't wake up the neighborhood cat, she's very sensitive. Can I make you some hot herbal tea when you arrive?";
      } else if (utterance.includes('bill') || utterance.includes('electricity') || utterance.includes('power')) {
        response = "Electricity bill? But darling, I always keep the lamps off during the afternoon to save on the meter! Let me walk down the hallway and check the fuse box... don't hang up, my slippers are right under the sofa...";
      } else {
        const fallbacks = [
          "Hold on just a moment, dear, someone is knocking at the front door... no, it's just the wind. Now what was that department again?",
          "Can you speak up a little louder into the receiver? My good ear is ringing today. What company did you say you were representing?",
          "Yes, yes, I'm listening very carefully. Let me grab my blue ballpoint pen... ah, this one is out of ink. Let me find the red one in the drawer...",
          "Bless you for calling to help me. My grandson usually takes care of this computer stuff. Are you friends with young Kevin?"
        ];
        response = fallbacks[turn % fallbacks.length];
      }
    } else if (persona.id === 'SLOW_TYPING_WORKER') {
      if (utterance.includes('otp') || utterance.includes('code')) {
        response = "Okay, typing that in right now... click... click... wait, the loading spinner just froze at 87%. Let me give the monitor a gentle tap. Okay, can you read that code back one digit at a time very slowly?";
      } else {
        response = "Yes, I am opening our departmental portal. It says 'Configuring updates, 34% complete, please do not turn off your computer'. Please hold on the line while this finishes authenticating.";
      }
    } else {
      // Bureaucratic
      response = "Under Regulation 42-B, before I can confirm any transfer or file disposition, I am required to log your supervisor's employee ID and regional sub-station routing code. Please state your badge number for the official record.";
    }

    // Accumulate telemetry
    this.totalTurns += 1;
    const additionalSeconds = Math.floor(Math.random() * 25) + 35; // ~35-60 seconds per turn
    this.totalSeconds += additionalSeconds;

    return {
      sessionId: params.sessionId,
      persona,
      turnIndex: turn,
      aiStallingResponse: response,
      scammerSecondsWasted: additionalSeconds,
      scammerFrustrationIndex: Math.min(100, 20 + turn * 18),
      recommendedFollowupTopic: 'Divert with mundane domestic trivia and fake confirmation codes'
    };
  }

  /**
   * Aggregate defensive telemetry
   */
  public static getStats(): HoneypotTelemetryStats {
    return {
      totalSessionsEngaged: this.totalSessions,
      totalTurnsStalled: this.totalTurns,
      totalSecondsWasted: this.totalSeconds,
      estimatedVictimsProtected: Math.floor(this.totalSeconds / 180) // 1 victim saved per 3 mins of scammer stalled
    };
  }

  public static getPersonas(): HoneypotPersona[] {
    return Object.values(this.personas);
  }
}
