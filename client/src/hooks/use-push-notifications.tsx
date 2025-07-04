/**
 * 🔔 React Hook for Push Notifications
 * Provides an easy interface for managing push notifications in React components
 */

import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService } from '../services/pushNotificationService';
import { showSuccess, showError, showWarning } from '../services/toastService';

interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
  initializeNotifications: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * 🔧 Initialize push notifications
   */
  const initializeNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🔔 Initializing push notifications...');

      // Check if push notifications are supported
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);

      if (!supported) {
        console.log('⚠️ Push notifications not supported');
        setIsLoading(false);
        return;
      }

      // Initialize the push notification service
      await pushNotificationService.init();

      // Get current permission status
      const currentPermission = pushNotificationService.getPermissionStatus();
      setPermission(currentPermission);

      // Check if user is already subscribed
      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);

      console.log('✅ Push notifications initialized');
      console.log(`Permission: ${currentPermission}, Subscribed: ${subscribed}`);

    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      showError('Failed to initialize push notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 🔔 Request notification permission
   */
  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🔔 Requesting notification permission...');

      const newPermission = await pushNotificationService.requestPermission();
      setPermission(newPermission);

      if (newPermission === 'granted') {
        showSuccess('🔔 Notification permission granted!');
        
        // Auto-subscribe if permission is granted
        await subscribe();
      } else if (newPermission === 'denied') {
        showWarning('🚫 Notification permission denied. You can enable it later in your browser settings.');
      } else {
        showWarning('⏸️ Notification permission dismissed.');
      }

    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      showError('Failed to request notification permission');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 📝 Subscribe to push notifications
   */
  const subscribe = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('📝 Subscribing to push notifications...');

      if (permission !== 'granted') {
        showError('Notification permission not granted');
        return;
      }

      const subscription = await pushNotificationService.subscribe();
      if (subscription) {
        setIsSubscribed(true);
        showSuccess('✅ Successfully subscribed to notifications!');
        console.log('✅ Push notification subscription successful');
      }

    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      showError('Failed to subscribe to notifications');
    } finally {
      setIsLoading(false);
    }
  }, [permission]);

  /**
   * 🚫 Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🚫 Unsubscribing from push notifications...');

      await pushNotificationService.unsubscribe();
      setIsSubscribed(false);
      showSuccess('🚫 Successfully unsubscribed from notifications');
      console.log('✅ Push notification unsubscription successful');

    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
      showError('Failed to unsubscribe from notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 🧪 Send test notification
   */
  const sendTestNotification = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🧪 Sending test notification...');

      if (!isSubscribed) {
        showError('Not subscribed to notifications');
        return;
      }

      await pushNotificationService.sendTestNotification();
      showSuccess('🧪 Test notification sent!');
      console.log('✅ Test notification sent successfully');

    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      showError('Failed to send test notification');
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  // Initialize on mount
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
    initializeNotifications,
  };
}
