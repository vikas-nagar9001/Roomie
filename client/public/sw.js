/**
 * 🔔 Service Worker for Push Notifications
 * Handles incoming push notifications and displays them to the user
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

// 🔔 Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('📲 Push notification received:', event);
  
  let notificationData = {
    title: 'Roomie - New Entry',
    body: 'A new expense entry has been added',
    icon: '/pwa-icons/icon-512.png',
    badge: '/pwa-icons/icon-512.png',
    data: {
      url: '/entries',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Entry',
        icon: '/pwa-icons/icon-512.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/pwa-icons/icon-512.png'
      }
    ],
    requireInteraction: true, // Keep notification visible until user interacts
    tag: 'roomie-entry' // Replace previous notifications with same tag
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        ...notificationData,
        ...payload
      };
    } catch (error) {
      console.error('❌ Error parsing push notification data:', error);
    }
  }

  // Show the notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// 🖱️ Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event);
  
  const notification = event.notification;
  const action = event.action;
  
  // Close the notification
  notification.close();
  
  if (action === 'dismiss') {
    // User dismissed the notification
    return;
  }
  
  // Get the URL to navigate to (default to entries page)
  const urlToOpen = notification.data?.url || '/entries';
  
  // Open/focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            // Focus existing window and navigate to entries page
            client.focus();
            client.postMessage({ 
              type: 'NAVIGATE_TO', 
              url: urlToOpen 
            });
            return;
          }
        }
        
        // If no window is open, open a new one
        return clients.openWindow(urlToOpen);
      })
  );
});

// 📤 Background sync for offline functionality (future enhancement)
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
