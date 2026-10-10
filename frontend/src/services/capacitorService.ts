import { Capacitor } from '@capacitor/core';

export interface NativeScreenerPlugin {
  checkScreeningRole(): Promise<{ isDefaultScreener: boolean; roleGranted: boolean }>;
  requestScreeningRole(): Promise<{ success: boolean }>;
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

  public static async checkRoleStatus(): Promise<{ isDefaultScreener: boolean; roleGranted: boolean }> {
    if (!this.isNative()) {
      // Browser simulation mode: read from localStorage mock
      const mockGranted = localStorage.getItem('mock_role_granted') === 'true';
      return { isDefaultScreener: mockGranted, roleGranted: mockGranted };
    }

    try {
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
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
      const plugin = (window as any).Capacitor?.Plugins?.CallScreeningBridge;
      if (plugin && typeof plugin.requestScreeningRole === 'function') {
        const res = await plugin.requestScreeningRole();
        return { success: res.success, message: 'RoleManager intent launched' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to trigger RoleManager' };
    }

    return {
      success: false,
      message: 'Native CallScreeningBridge plugin not initialized. Build with Android APK to test on physical device.'
    };
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
