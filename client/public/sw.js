/**
 * 🏠 Service Worker for Roomie PWA
 * Basic service worker for PWA functionality
 */

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Install event');
  self.skipWaiting(); // Activate new service worker immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activate event');
  event.waitUntil(clients.claim()); // Take control of all clients immediately
});

// � Background sync for offline functionality (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Background sync triggered');
    // Handle background sync if needed in the future
  }
});

// 💬 Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('💬 Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 🔔 Push notification handling
self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received:', event);
  
  let notificationData = {
    title: 'Roomie Notification',
    body: 'You have a new notification',
    icon: '/pwa-icons/icon-512.png', // Updated to use custom icon
    badge: '/favicon-32x32.png',
    tag: 'roomie-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/pwa-icons/icon-512.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon-32x32.png'
      }
    ],
    data: {}
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  const notificationPromise = self.registration.showNotification(notificationData.title, {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    vibrate: notificationData.vibrate,
    actions: notificationData.actions,
    data: notificationData.data || {},
    timestamp: notificationData.timestamp || Date.now(),
    silent: notificationData.silent || false
  });

  event.waitUntil(notificationPromise);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  console.log('🔔 Action:', event.action);
  console.log('🔔 Notification data:', event.notification.data);
  
  event.notification.close();

  // Handle different actions
  if (event.action === 'dismiss') {
    console.log('✖️ Notification dismissed by user');
    // Just close the notification
    return;
  }

  // For 'view' action or clicking the notification body
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then((clientList) => {
      console.log('👀 Found', clientList.length, 'open windows');
      
      // If the app is already open, focus it and navigate to target URL
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('🎯 Focusing existing window and navigating to:', targetUrl);
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            notificationData: event.notification.data
          });
          return client.focus();
        }
      }
      
      // If app is not open, open it with the target URL
      if (clients.openWindow) {
        console.log('🚀 Opening new window to:', targetUrl);
        return clients.openWindow(targetUrl);
      }
    }).catch((error) => {
      console.error('❌ Error handling notification click:', error);
    })
  );
});

// Handle notification close (when user swipes away or it auto-closes)
self.addEventListener('notificationclose', (event) => {
  console.log('🔔 Notification closed:', event);
  console.log('🔔 Notification data:', event.notification.data);
  
  // Optional: Track notification dismissal analytics
  // You could send this data to your analytics service
});
