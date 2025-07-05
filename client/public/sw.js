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
