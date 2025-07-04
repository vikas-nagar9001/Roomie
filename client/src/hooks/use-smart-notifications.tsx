/**
 * 🔔 React Hook for Smart Notification Management
 * Provides easy access to notification functionality in React components
 */

import { useEffect, useState } from 'react';
import { smartNotificationService } from '@/services/smartNotificationService';

export interface UseSmartNotificationsResult {
  permission: NotificationPermission;
  isSupported: boolean;
  canAsk: boolean;
  isFirstPWAOpen: boolean;
  promptCount: number;
  lastPromptDate: string | null;
  requestPermission: () => Promise<NotificationPermission>;
  clearData: () => void;
  getStats: () => any;
}

export function useSmartNotifications(): UseSmartNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [canAsk, setCanAsk] = useState(false);

  // Check initial state
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // Check if we can ask for permission
  useEffect(() => {
    const checkCanAsk = async () => {
      if (isSupported) {
        const shouldAsk = await smartNotificationService.shouldAskForPermission();
        setCanAsk(shouldAsk);
      }
    };

    checkCanAsk();
  }, [isSupported, permission]);

  // Request permission function
  const requestPermission = async (): Promise<NotificationPermission> => {
    try {
      const result = await smartNotificationService.requestPermissionSmart();
      setPermission(result);
      setCanAsk(false); // Reset after asking
      return result;
    } catch (error) {
      console.error('❌ Failed to request permission:', error);
      throw error;
    }
  };

  // Clear tracking data
  const clearData = () => {
    smartNotificationService.clearPermissionData();
  };

  // Get current stats
  const getStats = () => {
    return smartNotificationService.getPermissionStats();
  };

  const stats = getStats();

  return {
    permission,
    isSupported,
    canAsk,
    isFirstPWAOpen: smartNotificationService.isFirstPWAOpen(),
    promptCount: stats.notificationPromptCount,
    lastPromptDate: stats.lastPromptDate,
    requestPermission,
    clearData,
    getStats,
  };
}
