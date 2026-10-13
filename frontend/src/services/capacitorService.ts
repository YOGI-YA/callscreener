import { Capacitor } from '@capacitor/core';
import { ScreeningResult } from '../types';

export interface NativeScreenerPlugin {
  checkScreeningRole(): Promise<{ isDefaultScreener: boolean; roleGranted: boolean }>;
  requestScreeningRole(): Promise<{ success: boolean; granted?: boolean }>;
  getScreenedCalls(): Promise<{ calls: ScreeningResult[] }>;
  clearScreenedCalls(): Promise<{ success: boolean }>;
  openDefaultAppsSettings(): Promise<{ success: boolean }>;
  getNativeScreenerConfig(): Promise<{ backendUrl: string; fastRulesActive: boolean }>;
  setNativeScreenerConfig(options: { backendUrl: string }): Promise<{ success: boolean }>;
}

export class CapacitorService {
  public static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public static getPlatform(): string {
    return Capacitor.getPlatform();
  }

  private static getPlugin(): NativeScreenerPlugin | null {
    return (window as any).Capacitor?.Plugins?.CallScreeningBridge || null;
  }

  public static async checkRoleStatus(): Promise<{ isDefaultScreener: boolean; roleGranted: boolean }> {
    if (!this.isNative()) {
      const mockGranted = localStorage.getItem('mock_role_granted') === 'true';
      return { isDefaultScreener: mockGranted, roleGranted: mockGranted };
    }

    try {
      const plugin = this.getPlugin();
      if (plugin && typeof plugin.checkScreeningRole === 'function') {
        return await plugin.checkScreeningRole();
      }
    } catch (e) {
      console.warn('Native CallScreeningBridge plugin not found, falling back to false', e);
    }

    return { isDefaultScreener: false, roleGranted: false };
  }

  public static async requestScreeningRole(): Promise<{ success: boolean; message: string }> {
    if (!this.isNative()) {
      localStorage.setItem('mock_role_granted', 'true');
      return {
        success: true,
        message: 'Mock Android Role Granted (Browser Testing Mode)'
      };
    }

    try {
      const plugin = this.getPlugin();
      if (plugin && typeof plugin.requestScreeningRole === 'function') {
        const res = await plugin.requestScreeningRole();
        return { success: res.success, message: 'RoleManager intent launched' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to trigger RoleManager' };
    }

    return {
      success: false,
      message: 'Native CallScreeningBridge plugin not initialized.'
    };
  }

  public static async openDefaultAppsSettings(): Promise<{ success: boolean; message: string }> {
    if (!this.isNative()) {
      return { success: true, message: 'Simulated settings opened' };
    }

    try {
      const plugin = this.getPlugin();
      if (plugin && typeof plugin.openDefaultAppsSettings === 'function') {
        const res = await plugin.openDefaultAppsSettings();
        return { success: res.success, message: 'Opened Android Default Apps Settings' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to open settings' };
    }

    return { success: false, message: 'Not available' };
  }

  public static async getScreenedCalls(): Promise<ScreeningResult[]> {
    if (!this.isNative()) {
      return [];
    }

    try {
      const plugin = this.getPlugin();
      if (plugin && typeof plugin.getScreenedCalls === 'function') {
        const res = await plugin.getScreenedCalls();
        return res?.calls || [];
      }
    } catch (e) {
      console.warn('Failed to fetch native screened calls:', e);
    }

    return [];
  }

  public static async clearScreenedCalls(): Promise<boolean> {
    if (!this.isNative()) {
      return true;
    }

    try {
      const plugin = this.getPlugin();
      if (plugin && typeof plugin.clearScreenedCalls === 'function') {
        const res = await plugin.clearScreenedCalls();
        return res?.success || false;
      }
    } catch (e) {
      console.warn('Failed to clear native screened calls:', e);
    }

    return false;
  }

  // --- DEFAULT PHONE APP (DIALER) ROLE ---

  public static async checkDialerRole(): Promise<{ isDefaultDialer: boolean }> {
    if (!this.isNative()) {
      const mockDialer = localStorage.getItem('mock_dialer_granted') === 'true';
      return { isDefaultDialer: mockDialer };
    }

    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin && typeof plugin.checkDialerRole === 'function') {
        return await plugin.checkDialerRole();
      }
    } catch (e) {
      console.warn('checkDialerRole failed:', e);
    }
    return { isDefaultDialer: false };
  }

  public static async requestDialerRole(): Promise<{ success: boolean; message?: string }> {
    if (!this.isNative()) {
      localStorage.setItem('mock_dialer_granted', 'true');
      return { success: true, message: 'Browser simulation: Dialer role granted' };
    }

    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin && typeof plugin.requestDialerRole === 'function') {
        return await plugin.requestDialerRole();
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to request dialer role' };
    }
    return { success: false, message: 'CallScreeningBridge plugin not available' };
  }

  // --- LIVE TELEPHONY & AI CALL CONTROLS ---

  public static async answerCall(): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.answerCall) return await plugin.answerCall();
    } catch (e) {
      console.error('answerCall failed:', e);
    }
    return { success: false };
  }

  public static async rejectCall(): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.rejectCall) return await plugin.rejectCall();
    } catch (e) {
      console.error('rejectCall failed:', e);
    }
    return { success: false };
  }

  public static async screenCallWithAi(language: string = 'auto', enableBotVoice: boolean = true): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.screenCallWithAi) return await plugin.screenCallWithAi({ language, enableBotVoice });
    } catch (e) {
      console.error('screenCallWithAi failed:', e);
    }
    return { success: false };
  }

  public static async setAiVoicePersona(persona: string): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.setAiVoicePersona) return await plugin.setAiVoicePersona({ persona });
    } catch (e) {
      console.error('setAiVoicePersona failed:', e);
    }
    return { success: false };
  }

  public static async startSilentWordListening(language: string = 'auto'): Promise<{ success: boolean }> {
    return this.screenCallWithAi(language, false);
  }

  public static async sendAiReply(replyText: string): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.sendAiReply) return await plugin.sendAiReply({ replyText });
    } catch (e) {
      console.error('sendAiReply failed:', e);
    }
    return { success: false };
  }

  public static async pickupCall(): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.pickupCall) return await plugin.pickupCall();
    } catch (e) {
      console.error('pickupCall failed:', e);
    }
    return { success: false };
  }

  public static async setMuted(muted: boolean): Promise<{ success: boolean; muted?: boolean }> {
    if (!this.isNative()) return { success: true, muted };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.setMuted) return await plugin.setMuted({ muted });
    } catch (e) {
      console.error('setMuted failed:', e);
    }
    return { success: false };
  }

  public static async setSpeakerphone(speakerOn: boolean): Promise<{ success: boolean; speakerOn?: boolean }> {
    if (!this.isNative()) return { success: true, speakerOn };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.setSpeakerphone) return await plugin.setSpeakerphone({ speakerOn });
    } catch (e) {
      console.error('setSpeakerphone failed:', e);
    }
    return { success: false };
  }

  public static async playDtmfTone(digit: string): Promise<{ success: boolean }> {
    this.playWebDtmfTone(digit);
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.playDtmfTone) return await plugin.playDtmfTone({ digit });
    } catch (e) {
      console.error('playDtmfTone failed:', e);
    }
    return { success: false };
  }

  public static async stopDtmfTone(): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.stopDtmfTone) return await plugin.stopDtmfTone();
    } catch (e) {
      console.error('stopDtmfTone failed:', e);
    }
    return { success: false };
  }

  public static async holdCall(hold: boolean): Promise<{ success: boolean; hold?: boolean }> {
    if (!this.isNative()) return { success: true, hold };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.holdCall) return await plugin.holdCall({ hold });
    } catch (e) {
      console.error('holdCall failed:', e);
    }
    return { success: false };
  }

  // --- CALL AUDIO RECORDING (Saves to Recordings / Music) ---

  public static async startCallRecording(phoneNumber?: string): Promise<{ success: boolean; isRecording: boolean }> {
    if (!this.isNative()) {
      localStorage.setItem('mock_is_recording', 'true');
      return { success: true, isRecording: true };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.startCallRecording) {
        return await plugin.startCallRecording({ phoneNumber });
      }
    } catch (e) {
      console.error('startCallRecording failed:', e);
    }
    return { success: false, isRecording: false };
  }

  public static async stopCallRecording(): Promise<{ success: boolean; isRecording: boolean; filePath?: string; savedTo?: string }> {
    if (!this.isNative()) {
      localStorage.setItem('mock_is_recording', 'false');
      return { success: true, isRecording: false, savedTo: 'Recordings/Music' };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.stopCallRecording) {
        return await plugin.stopCallRecording();
      }
    } catch (e) {
      console.error('stopCallRecording failed:', e);
    }
    return { success: false, isRecording: false };
  }

  public static async isCallRecording(): Promise<{ isRecording: boolean; durationSeconds?: number; amplitude?: number }> {
    if (!this.isNative()) {
      return { isRecording: localStorage.getItem('mock_is_recording') === 'true' };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.isCallRecording) {
        return await plugin.isCallRecording();
      }
    } catch (e) {
      console.error('isCallRecording failed:', e);
    }
    return { isRecording: false };
  }

  public static async getRecordedCalls(): Promise<{ success: boolean; recordings: any[] }> {
    if (!this.isNative()) {
      const stored = localStorage.getItem('mock_recordings_list');
      if (stored) {
        try {
          return { success: true, recordings: JSON.parse(stored) };
        } catch {}
      }
      return {
        success: true,
        recordings: [
          {
            id: 'demo_1',
            fileName: 'Call_+18004321000_20261013_142210.m4a',
            phoneNumber: '+18004321000',
            filePath: '/storage/emulated/0/Recordings/AegisCall/Call_+18004321000_20261013_142210.m4a',
            timestamp: Date.now() - 3600000,
            durationSeconds: 48,
            fileSizeBytes: 768400
          },
          {
            id: 'demo_2',
            fileName: 'Call_+919820144321_20261013_110540.m4a',
            phoneNumber: '+919820144321',
            filePath: '/storage/emulated/0/Recordings/AegisCall/Call_+919820144321_20261013_110540.m4a',
            timestamp: Date.now() - 14400000,
            durationSeconds: 32,
            fileSizeBytes: 512200
          }
        ]
      };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.getRecordedCalls) {
        return await plugin.getRecordedCalls();
      }
    } catch (e) {
      console.error('getRecordedCalls failed:', e);
    }
    return { success: false, recordings: [] };
  }

  public static async deleteRecordedCall(filePath: string): Promise<{ success: boolean }> {
    if (!this.isNative()) {
      const stored = localStorage.getItem('mock_recordings_list');
      if (stored) {
        try {
          const list = JSON.parse(stored).filter((r: any) => r.filePath !== filePath);
          localStorage.setItem('mock_recordings_list', JSON.stringify(list));
        } catch {}
      }
      return { success: true };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.deleteRecordedCall) {
        return await plugin.deleteRecordedCall({ filePath });
      }
    } catch (e) {
      console.error('deleteRecordedCall failed:', e);
    }
    return { success: false };
  }

  public static addRecordingSavedListener(callback: (data: { saved: boolean; filePath: string; location: string }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('callRecordingSaved', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching callRecordingSaved listener:', e);
    }
    return null;
  }

  // Web Audio DTMF synthesizer for authentic keypad dial sounds
  private static audioCtx: AudioContext | null = null;
  public static playWebDtmfTone(digit: string): void {
    try {
      const DTMF_FREQS: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
      };
      const freqs = DTMF_FREQS[digit];
      if (!freqs) return;

      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freqs[0], now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freqs[1], now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } catch {
      // AudioContext could be blocked by autoplay policies
    }
  }

  // TTS speech helper: only used in browser preview mode (never on native phone where native telephony routes audio)
  public static speakOutLoud(text: string, lang = 'en-US', force = false): void {
    if (this.isNative() && !force) {
      // On real Android phone, the native telephony service speaks to the caller on the phone line
      return;
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = lang;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Ignore TTS errors
    }
  }

  public static addAudioLevelListener(callback: (data: { rmsDb: number }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('audioLevelChanged', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching audioLevelChanged listener:', e);
    }
    return null;
  }

  public static addCallAudioStateListener(callback: (data: { muted: boolean; speakerOn: boolean }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('callAudioStateChanged', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching callAudioStateChanged listener:', e);
    }
    return null;
  }

  // --- TELEPHONY EVENT LISTENERS ---

  public static addCallScreenedListener(callback: (call: ScreeningResult) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge && typeof bridge.addListener === 'function') {
        const handle = bridge.addListener('callScreened', (call: any) => {
          callback(call);
        });
        return () => {
          if (handle && typeof handle.remove === 'function') handle.remove();
        };
      }
    } catch (e) {
      console.warn('Error attaching callScreened listener:', e);
    }
    return null;
  }

  public static addIncomingCallListener(callback: (call: { phoneNumber: string; callerName: string; timestamp: number }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('incomingPhoneCall', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching incomingPhoneCall listener:', e);
    }
    return null;
  }

  public static addLiveTranscriptListener(callback: (data: { speaker: string; text: string; isFinal: boolean; timestamp: number }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('liveCallTranscript', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching liveCallTranscript listener:', e);
    }
    return null;
  }

  public static addAiSpeechListener(callback: (data: { speaker: string; text: string; timestamp: number }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('aiSpeechUtterance', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching aiSpeechUtterance listener:', e);
    }
    return null;
  }

  public static addCallEndedListener(callback: () => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('phoneCallEnded', () => callback());
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching phoneCallEnded listener:', e);
    }
    return null;
  }

  public static addCallPickedUpListener(callback: () => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('callPickedUp', () => callback());
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching callPickedUp listener:', e);
    }
    return null;
  }

  public static addCallRestoredListener(callback: (data: { phoneNumber: string; callerName: string; isScreeningActive: boolean; callState: string }) => void): (() => void) | null {
    if (!this.isNative()) return null;
    try {
      const bridge = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (bridge?.addListener) {
        const handle = bridge.addListener('callRestored', (data: any) => callback(data));
        return () => { if (handle?.remove) handle.remove(); };
      }
    } catch (e) {
      console.warn('Error attaching callRestored listener:', e);
    }
    return null;
  }

  public static async getCurrentCall(): Promise<{
    hasActiveCall: boolean;
    phoneNumber?: string;
    callerName?: string;
    callState?: string;
    isScreeningActive?: boolean;
  }> {
    if (!this.isNative()) {
      return { hasActiveCall: false, isScreeningActive: false };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.getCurrentCall) {
        return await plugin.getCurrentCall();
      }
    } catch (e) {
      console.warn('getCurrentCall failed:', e);
    }
    return { hasActiveCall: false, isScreeningActive: false };
  }

  // --- CONTACTS ---

  public static async getContacts(): Promise<{ id: string; name: string; number: string }[]> {
    if (!this.isNative()) {
      // Mock contacts for browser testing
      return [
        { id: '1', name: 'Mum', number: '+919876543210' },
        { id: '2', name: 'Dad', number: '+919812345678' },
        { id: '3', name: 'Rahul Kumar', number: '+919988776655' },
        { id: '4', name: 'Priya Sharma', number: '+918877665544' },
        { id: '5', name: 'Delivery Guy', number: '+917766554433' },
      ];
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.getContacts) {
        const res = await plugin.getContacts();
        return res?.contacts || [];
      }
    } catch (e) {
      console.warn('getContacts failed:', e);
    }
    return [];
  }

  // --- DEVICE CALL LOG ---

  public static async getDeviceCallLog(limit = 100): Promise<{ number: string; name: string; type: string; date: number; duration: number }[]> {
    if (!this.isNative()) {
      const now = Date.now();
      return [
        { number: '+919876543210', name: 'Mum', type: 'INCOMING', date: now - 60000, duration: 320 },
        { number: '+917766554433', name: 'Unknown Caller', type: 'MISSED', date: now - 3600000, duration: 0 },
        { number: '+911234567890', name: '', type: 'MISSED', date: now - 7200000, duration: 0 },
        { number: '+919988776655', name: 'Rahul Kumar', type: 'OUTGOING', date: now - 86400000, duration: 120 },
        { number: '+916655443322', name: 'HDFC Bank', type: 'INCOMING', date: now - 172800000, duration: 45 },
      ];
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.getDeviceCallLog) {
        const res = await plugin.getDeviceCallLog({ limit });
        return res?.calls || [];
      }
    } catch (e) {
      console.warn('getDeviceCallLog failed:', e);
    }
    return [];
  }

  // --- MAKE OUTGOING CALL ---

  public static async makeCall(number: string): Promise<{ success: boolean }> {
    if (!this.isNative()) {
      window.open(`tel:${number}`, '_blank');
      return { success: true };
    }
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.makeCall) {
        return await plugin.makeCall({ number });
      }
    } catch (e) {
      console.error('makeCall failed:', e);
    }
    return { success: false };
  }

  public static triggerHapticFeedback(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // Ignore haptic errors on unsupported web views
      }
    }
  }
}
