/**
 * Simple Push Notification Manager for Roomie PWA
 */

let isSubscribed = false;
let swRegistration: ServiceWorkerRegistration | null = null;

// Convert VAPID key to Uint8Array
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

// Initialize push notifications
export async function initializePushNotifications(userId?: string): Promise<boolean> {
  console.log('🔔 Initializing push notifications...');

  // Check if service worker is supported
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return false;
  }

  // Check if push messaging is supported
  if (!('PushManager' in window)) {
    console.warn('Push messaging not supported');
    return false;
  }

  // User ID is required for database storage
  if (!userId) {
    console.warn('User ID is required for push notifications');
    return false;
  }

  try {
    // Register service worker
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service Worker registered');

    // Get VAPID public key from server
    const response = await fetch('/api/push/vapid-key');
    const { publicKey } = await response.json();

    // Check if already subscribed
    const existingSubscription = await swRegistration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('✅ Already subscribed to push notifications');
      // Re-send the subscription with userId to ensure it's in the database
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          subscription: existingSubscription,
          userId 
        })
      });
      isSubscribed = true;
      return true;
    }

    // Subscribe to push notifications
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to server with userId
    const subscribeResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        subscription,
        userId 
      })
    });

    if (!subscribeResponse.ok) {
      throw new Error(`Failed to subscribe: ${subscribeResponse.statusText}`);
    }

    console.log('✅ Push notification subscription successful');
    isSubscribed = true;
    return true;

  } catch (error) {
    console.error('❌ Push notification setup failed:', error);
    return false;
  }
}

// Get subscription status
export function getSubscriptionStatus(): boolean {
  return isSubscribed;
}

// Test function to check if everything works
export async function testPushNotification(): Promise<void> {
  try {
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Notification',
        body: 'This is a test push notification from Roomie!'
      })
    });

    const result = await response.json();
    console.log('Test notification result:', result);
  } catch (error) {
    console.error('Test notification failed:', error);
  }
}
