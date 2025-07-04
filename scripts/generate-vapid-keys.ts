/**
 * 🔑 VAPID Key Generator
 * Generates VAPID keys for Web Push notifications
 */

import webpush from 'web-push';

console.log('🔑 Generating VAPID keys for Web Push notifications...');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n📋 Copy these VAPID keys to your .env file:');
console.log('\n# Web Push Notification VAPID Keys');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@roomieapp.com');

console.log('\n✅ VAPID keys generated successfully!');
console.log('\n📝 Note: Keep the private key secure and never expose it publicly.');
