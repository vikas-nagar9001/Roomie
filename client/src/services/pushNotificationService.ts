/**
 * 🔔 Push Notification Service
 * Handles push notification subscription and management
 */

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  
  // VAPID public key - will be set from server
  private vapidPublicKey: string = '';

  /**
   * 🔧 Initialize the push notification service
   */
  async init(): Promise<void> {
    try {
      console.log('🔔 Initializing Push Notification Service...');
      
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported');
      }

      // Check if push messaging is supported
      if (!('PushManager' in window)) {
        throw new Error('Push messaging not supported');
      }

      // Register service worker
      await this.registerServiceWorker();
      
      // Get VAPID public key from server
      await this.getVapidPublicKey();
      
      console.log('✅ Push Notification Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Push Notification Service:', error);
      throw error;
    }
  }

  /**
   * 📝 Register the service worker
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('🔧 Service Worker registered:', this.registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready');

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NAVIGATE_TO') {
          // Handle navigation requests from service worker
          window.location.href = event.data.url;
        }
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * 🔑 Get VAPID public key from server
   */
  private async getVapidPublicKey(): Promise<void> {
    try {
      const response = await fetch('/api/vapid-public-key');
      if (!response.ok) {
        throw new Error('Failed to get VAPID public key');
      }
      
      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
      console.log('🔑 VAPID public key received');
    } catch (error) {
      console.error('❌ Failed to get VAPID public key:', error);
      throw error;
    }
  }

  /**
   * 🔔 Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    try {
      console.log('🔔 Requesting notification permission...');
      
      // Check current permission status
      let permission = Notification.permission;
      
      if (permission === 'default') {
        // Request permission
        permission = await Notification.requestPermission();
      }
      
      console.log('🔔 Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      throw error;
    }
  }

  /**
   * 📝 Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    try {
      console.log('📝 Subscribing to push notifications...');
      
      if (!this.registration) {
        throw new Error('Service Worker not registered');
      }

      if (!this.vapidPublicKey) {
        throw new Error('VAPID public key not available');
      }

      // Check if already subscribed
      let subscription = await this.registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(this.vapidPublicKey),
        });
      }

      this.subscription = subscription;
      console.log('✅ Push subscription created:', subscription);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * 📤 Send subscription details to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      console.log('📤 Sending subscription to server...');
      
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('✅ Subscription sent to server');
    } catch (error) {
      console.error('❌ Failed to send subscription to server:', error);
      throw error;
    }
  }

  /**
   * 🚫 Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    try {
      console.log('🚫 Unsubscribing from push notifications...');
      
      if (this.subscription) {
        await this.subscription.unsubscribe();
        
        // Remove subscription from server
        await fetch('/api/push-subscription', {
          method: 'DELETE',
        });
        
        this.subscription = null;
        console.log('✅ Unsubscribed from push notifications');
      }
    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  /**
   * ✅ Check if user is subscribed to push notifications
   */
  async isSubscribed(): Promise<boolean> {
    try {
      if (!this.registration) {
        return false;
      }

      const subscription = await this.registration.pushManager.getSubscription();
      this.subscription = subscription;
      return !!subscription;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * 🔔 Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * 🧪 Send a test notification
   */
  async sendTestNotification(): Promise<void> {
    try {
      if (this.getPermissionStatus() !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      // Send test notification via server
      const response = await fetch('/api/test-push-notification', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      console.log('✅ Test notification sent');
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
