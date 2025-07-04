/**
 * 🔔 Push Notification Server Module
 * Handles sending push notifications to users
 */

import webpush from 'web-push';
import { storage } from './storage';

// VAPID keys for push notifications
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDs1KywHa6iBwuTPOP6KzmvV4sUE_r1de83V9nf23eK0XgmJsVHvSkeoBmUZ-Jefa5M9lso7Mi-7TKBpnUAPYjc';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'HBgZ7eZOxok46xn-pQKMXtozJHIz2RTj6VXhVSf5HyM';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@roomieapp.com';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

class PushNotificationManager {
  
  /**
   * 🔑 Get VAPID public key
   */
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * 📤 Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      console.log(`📤 Sending push notification to user ${userId}`);
      
      // Get user's push subscription from database
      const user = await storage.getUser(userId);
      if (!user || !user.pushSubscription) {
        console.log(`⚠️ User ${userId} has no push subscription`);
        return;
      }

      // Send notification
      await this.sendNotification(user.pushSubscription, payload);
      console.log(`✅ Push notification sent to user ${userId}`);
      
    } catch (error: any) {
      console.error(`❌ Failed to send push notification to user ${userId}:`, error);
      
      // If subscription is invalid, remove it from database
      if (error?.statusCode === 410 || error?.statusCode === 404) {
        console.log(`🗑️ Removing invalid subscription for user ${userId}`);
        await storage.updateUser(userId, { pushSubscription: null });
      }
    }
  }

  /**
   * 📤 Send push notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    console.log(`📤 Sending push notifications to ${userIds.length} users`);
    
    const promises = userIds.map(userId => this.sendToUser(userId, payload));
    await Promise.allSettled(promises);
    
    console.log(`✅ Push notifications sent to ${userIds.length} users`);
  }

  /**
   * 📤 Send push notification to all users in a flat except specific user
   */
  async sendToFlatExceptUser(flatId: string, excludeUserId: string, payload: NotificationPayload): Promise<void> {
    try {
      console.log(`📤 Sending push notifications to flat ${flatId} except user ${excludeUserId}`);
      
      // Get all active users in the flat
      const users = await storage.getUsersByFlatId(flatId);
      const targetUsers = users.filter(user => 
        user._id.toString() !== excludeUserId && 
        user.status === 'ACTIVE' &&
        user.pushSubscription
      );

      if (targetUsers.length === 0) {
        console.log(`⚠️ No users with push subscriptions found in flat ${flatId}`);
        return;
      }

      console.log(`📱 Found ${targetUsers.length} users with push subscriptions`);
      
      // Send notifications to all target users
      const promises = targetUsers.map(user => 
        this.sendNotification(user.pushSubscription!, payload)
          .catch((error: any) => {
            console.error(`❌ Failed to send notification to user ${user._id}:`, error);
            
            // Remove invalid subscriptions
            if (error?.statusCode === 410 || error?.statusCode === 404) {
              storage.updateUser(user._id, { pushSubscription: null });
            }
          })
      );

      await Promise.allSettled(promises);
      console.log(`✅ Push notifications sent to flat ${flatId}`);
      
    } catch (error) {
      console.error(`❌ Failed to send push notifications to flat ${flatId}:`, error);
    }
  }

  /**
   * 📱 Send individual push notification
   */
  private async sendNotification(subscription: any, payload: NotificationPayload): Promise<void> {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      // Re-throw with additional context
      throw error;
    }
  }

  /**
   * 🧪 Send test notification to user
   */
  async sendTestNotification(userId: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '🧪 Roomie - Test Notification',
      body: 'This is a test push notification. Your notifications are working!',
      icon: '/pwa-icons/icon-512.png',
      badge: '/pwa-icons/icon-512.png',
      data: {
        url: '/entries',
        test: true
      },
      tag: 'test-notification',
      requireInteraction: false
    };

    await this.sendToUser(userId, payload);
  }

  /**
   * 💰 Send entry added notification
   */
  async sendEntryAddedNotification(entry: any, excludeUserId: string): Promise<void> {
    // Get user who created the entry
    const creator = await storage.getUser(entry.userId);
    const creatorName = creator?.name || 'Someone';

    const payload: NotificationPayload = {
      title: `💰 New Entry: ${entry.name}`,
      body: `${creatorName} added ₹${entry.amount.toFixed(2)} for ${entry.name}`,
      icon: '/pwa-icons/icon-512.png',
      badge: '/pwa-icons/icon-512.png',
      data: {
        url: '/entries',
        entryId: entry._id,
        type: 'entry_added'
      },
      actions: [
        {
          action: 'view',
          title: 'View Entries',
          icon: '/pwa-icons/icon-512.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      tag: 'entry-notification',
      requireInteraction: true
    };

    await this.sendToFlatExceptUser(entry.flatId, excludeUserId, payload);
  }

  /**
   * ✅ Send entry approved notification
   */
  async sendEntryApprovedNotification(entry: any, approvedBy: string): Promise<void> {
    const approver = await storage.getUser(approvedBy);
    const approverName = approver?.name || 'Admin';

    const payload: NotificationPayload = {
      title: `✅ Entry Approved: ${entry.name}`,
      body: `${approverName} approved your ₹${entry.amount.toFixed(2)} entry for ${entry.name}`,
      icon: '/pwa-icons/icon-512.png',
      badge: '/pwa-icons/icon-512.png',
      data: {
        url: '/entries',
        entryId: entry._id,
        type: 'entry_approved'
      },
      tag: 'entry-approved',
      requireInteraction: true
    };

    await this.sendToUser(entry.userId, payload);
  }

  /**
   * ❌ Send entry rejected notification
   */
  async sendEntryRejectedNotification(entry: any, rejectedBy: string): Promise<void> {
    const rejector = await storage.getUser(rejectedBy);
    const rejectorName = rejector?.name || 'Admin';

    const payload: NotificationPayload = {
      title: `❌ Entry Rejected: ${entry.name}`,
      body: `${rejectorName} rejected your ₹${entry.amount.toFixed(2)} entry for ${entry.name}`,
      icon: '/pwa-icons/icon-512.png',
      badge: '/pwa-icons/icon-512.png',
      data: {
        url: '/entries',
        entryId: entry._id,
        type: 'entry_rejected'
      },
      tag: 'entry-rejected',
      requireInteraction: true
    };

    await this.sendToUser(entry.userId, payload);
  }
}

// Export singleton instance
export const pushNotificationManager = new PushNotificationManager();
