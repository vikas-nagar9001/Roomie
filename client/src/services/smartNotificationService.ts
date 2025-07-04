/**
 * 🧠 Smart Notification Permission Service
 * Handles notification permission requests intelligently based on UX best practices
 */

import { pushNotificationService } from './pushNotificationService';

interface NotificationPermissionData {
  notificationPromptCount: number;
  lastPromptDate: string;
  lastDenialDate?: string;
  isFirstPWAOpen?: boolean;
}

const STORAGE_KEY = 'roomie_notification_permission';
const MIN_DAYS_BETWEEN_PROMPTS = 2;
const MAX_PROMPT_COUNT_BEFORE_WAIT = 3;

class SmartNotificationService {
  
  /**
   * 🎯 Check if we should ask for notification permission on dashboard
   */
  async shouldAskForPermission(): Promise<boolean> {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('⚠️ Push notifications not supported in this browser');
        return false;
      }

      const currentPermission = Notification.permission;
      
      // If already granted, no need to ask
      if (currentPermission === 'granted') {
        console.log('✅ Notification permission already granted');
        return false;
      }

      // If permission is default (never asked), we can ask
      if (currentPermission === 'default') {
        console.log('🔔 Notification permission is default - can ask');
        return true;
      }

      // If permission is denied, check if we should ask again
      if (currentPermission === 'denied') {
        return this.shouldAskAfterDenial();
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * 🚫 Check if we should ask again after previous denial
   */
  private shouldAskAfterDenial(): boolean {
    const data = this.getPermissionData();
    
    // If this is the first denial, don't ask immediately
    if (data.notificationPromptCount === 0) {
      console.log('ℹ️ First time denial - will ask later');
      return false;
    }

    // Check if enough time has passed since last prompt
    const daysSinceLastPrompt = this.getDaysSince(data.lastPromptDate);
    const hasEnoughTimePassed = daysSinceLastPrompt >= MIN_DAYS_BETWEEN_PROMPTS;

    // Check if user has opened app enough times
    const hasOpenedEnoughTimes = data.notificationPromptCount >= MAX_PROMPT_COUNT_BEFORE_WAIT;

    if (hasEnoughTimePassed || hasOpenedEnoughTimes) {
      console.log(`🔔 Can ask for permission again - Days passed: ${daysSinceLastPrompt}, Prompt count: ${data.notificationPromptCount}`);
      return true;
    }

    console.log(`ℹ️ Not asking yet - Days passed: ${daysSinceLastPrompt}, Prompt count: ${data.notificationPromptCount}`);
    return false;
  }

  /**
   * 🎯 Smart permission request with tracking
   */
  async requestPermissionSmart(): Promise<NotificationPermission> {
    try {
      console.log('🔔 Requesting notification permission smartly...');
      
      // Update prompt tracking before asking
      this.updatePromptTracking();
      
      // Request permission using the existing service
      const permission = await pushNotificationService.requestPermission();
      
      // If granted, automatically subscribe
      if (permission === 'granted') {
        console.log('✅ Permission granted - auto-subscribing...');
        await this.initializeNotifications();
      } else if (permission === 'denied') {
        console.log('❌ Permission denied - tracking for future attempts');
        this.trackDenial();
      }
      
      return permission;
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      throw error;
    }
  }

  /**
   * 🔧 Initialize notifications after permission granted
   */
  async initializeNotifications(): Promise<void> {
    try {
      // Initialize the push service if not already done
      await pushNotificationService.init();
      
      // Subscribe to notifications
      await pushNotificationService.subscribe();
      
      console.log('✅ Smart notification initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
      throw error;
    }
  }

  /**
   * 🚀 Handle PWA first open
   */
  markFirstPWAOpen(): void {
    const data = this.getPermissionData();
    data.isFirstPWAOpen = true;
    this.savePermissionData(data);
    console.log('🚀 Marked as first PWA open');
  }

  /**
   * 🔍 Check if this is first PWA open
   */
  isFirstPWAOpen(): boolean {
    const data = this.getPermissionData();
    return data.isFirstPWAOpen === true;
  }

  /**
   * 📊 Update prompt tracking
   */
  private updatePromptTracking(): void {
    const data = this.getPermissionData();
    data.notificationPromptCount += 1;
    data.lastPromptDate = new Date().toISOString();
    this.savePermissionData(data);
  }

  /**
   * 🚫 Track when permission was denied
   */
  private trackDenial(): void {
    const data = this.getPermissionData();
    data.lastDenialDate = new Date().toISOString();
    this.savePermissionData(data);
  }

  /**
   * 💾 Get permission data from localStorage
   */
  private getPermissionData(): NotificationPermissionData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('❌ Error reading permission data:', error);
    }

    // Return default data
    return {
      notificationPromptCount: 0,
      lastPromptDate: new Date().toISOString(),
    };
  }

  /**
   * 💾 Save permission data to localStorage
   */
  private savePermissionData(data: NotificationPermissionData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('❌ Error saving permission data:', error);
    }
  }

  /**
   * 📅 Calculate days since a given date
   */
  private getDaysSince(dateString: string): number {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error('❌ Error calculating days:', error);
      return 0;
    }
  }

  /**
   * 🧹 Clear permission tracking (for testing)
   */
  clearPermissionData(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🧹 Permission tracking data cleared');
  }

  /**
   * 📊 Get current permission stats (for debugging)
   */
  getPermissionStats(): NotificationPermissionData & { currentPermission: NotificationPermission } {
    return {
      ...this.getPermissionData(),
      currentPermission: Notification.permission
    };
  }
}

// Export singleton instance
export const smartNotificationService = new SmartNotificationService();
