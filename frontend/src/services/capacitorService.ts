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

  public static async screenCallWithAi(language: string = 'auto'): Promise<{ success: boolean }> {
    if (!this.isNative()) return { success: true };
    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin?.screenCallWithAi) return await plugin.screenCallWithAi({ language });
    } catch (e) {
      console.error('screenCallWithAi failed:', e);
    }
    return { success: false };
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
