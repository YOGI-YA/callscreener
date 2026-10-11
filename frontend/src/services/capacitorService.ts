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
