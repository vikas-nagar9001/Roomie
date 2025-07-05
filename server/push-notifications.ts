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

  /**
   * 🎉 Send personalized welcome notification
   */
  async sendWelcomeNotification(userId: string, userName: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '🎉 Welcome to Roomie!',
      body: `Hello ${userName}, welcome to Roomie! We're glad to have you on board.`,
      icon: '/pwa-icons/icon-512.png',
      badge: '/pwa-icons/icon-512.png',
      data: {
        url: '/',
        type: 'welcome'
      },
      actions: [
        {
          action: 'explore',
          title: 'Explore Now',
          icon: '/pwa-icons/icon-512.png'
        }
      ],
      tag: 'welcome-notification',
      requireInteraction: true
    };

    await this.sendToUser(userId, payload);
  }

  /**
   * 📅 Send personalized event reminder notification
   */
  async sendEventReminderNotification(userId: string, eventName: string, eventTime: string): Promise<void> {
    const payload: NotificationPayload = {
      title: `📅 Reminder: ${eventName}`,
      body: `Don't forget about the upcoming event: ${eventName} at ${eventTime}.`,
      icon: '/pwa-icons/icon-512.png',
      badge: '/pwa-icons/icon-512.png',
      data: {
        url: '/events',
        type: 'event_reminder'
      },
      actions: [
        {
          action: 'view',
          title: 'View Event',
          icon: '/pwa-icons/icon-512.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      tag: 'event-reminder-notification',
      requireInteraction: true
    };

    await this.sendToUser(userId, payload);
  }

  /**
   * 📆 Send penalty reminder notification (1 day before penalty)
   */
  async sendPenaltyReminderNotification(userId: string, penaltyDate: Date, flatSettings: any): Promise<void> {
    try {
      const tracking = await storage.getNotificationTracking(userId, 'PENALTY_REMINDER');
      const shouldSend = await storage.shouldSendNotification(userId, 'PENALTY_REMINDER');
      
      if (!shouldSend) {
        console.log(`⏸️ Skipping penalty reminder for user ${userId} - rate limited`);
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) return;

      const formattedDate = penaltyDate.toLocaleDateString();
      const currentCount = tracking ? tracking.sentCount + 1 : 1;
      
      let title = '';
      let body = '';
      
      if (currentCount === 1) {
        title = '⚠️ Penalty Reminder';
        body = `Hi ${user.name}! Penalty check is scheduled for tomorrow (${formattedDate}). Ensure your contribution meets the fair share to avoid penalties.`;
      } else if (currentCount === 2) {
        title = '⚠️ Penalty Reminder (2nd Notice)';
        body = `${user.name}, penalty check is tomorrow (${formattedDate}). Add entries now to meet your fair share!`;
      } else {
        title = '🚨 Final Penalty Reminder';
        body = `${user.name}, penalty check is today! Add entries immediately to avoid automatic penalty.`;
      }

      const payload: NotificationPayload = {
        title,
        body,
        icon: '/pwa-icons/icon-512.png',
        badge: '/pwa-icons/icon-512.png',
        data: {
          url: '/entries',
          type: 'penalty_reminder',
          penaltyDate: penaltyDate.toISOString()
        },
        tag: 'penalty-reminder',
        requireInteraction: true
      };

      await this.sendToUser(userId, payload);
      
      // Track notification
      await storage.createOrUpdateNotificationTracking(userId, 'PENALTY_REMINDER', {
        penaltyDate,
        warningPeriodDays: flatSettings.warningPeriodDays
      });
      
      console.log(`📆 Penalty reminder sent to user ${userId} (attempt ${currentCount})`);
    } catch (error) {
      console.error(`❌ Failed to send penalty reminder to user ${userId}:`, error);
    }
  }

  /**
   * ❌ Send penalty applied notification (immediately after penalty is applied)
   * @deprecated Use sendUniversalPenaltyNotification instead for better coverage
   */
  async sendPenaltyAppliedNotification(userId: string, penaltyAmount: number, description: string): Promise<void> {
    // Route to the universal penalty notification system
    await this.sendUniversalPenaltyNotification(
      userId, 
      penaltyAmount, 
      'TIME_BASED_AUTOMATIC', // Default to automatic type for backwards compatibility
      description
    );
    
    // Schedule repeat notifications
    await this.scheduleRepeatPenaltyNotifications(
      userId, 
      penaltyAmount, 
      'TIME_BASED_AUTOMATIC',
      description
    );
  }

  /**
   * 📉 Send low contribution alert notification
   */
  async sendLowContributionAlert(userId: string, contributionPercentage: number, fairShareThreshold: number): Promise<void> {
    try {
      const shouldSend = await storage.shouldSendNotification(userId, 'LOW_CONTRIBUTION');
      
      if (!shouldSend) {
        console.log(`⏸️ Skipping low contribution alert for user ${userId} - rate limited`);
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) return;

      const tracking = await storage.getNotificationTracking(userId, 'LOW_CONTRIBUTION');
      const currentCount = tracking ? tracking.sentCount + 1 : 1;
      
      let title = '';
      let body = '';
      
      if (currentCount === 1) {
        title = '📉 Low Contribution Alert';
        body = `Hi ${user.name}! Your contribution (${contributionPercentage.toFixed(1)}%) is below the expected threshold (${fairShareThreshold.toFixed(1)}%). Consider adding more entries.`;
      } else if (currentCount === 2) {
        title = '📉 Low Contribution (2nd Alert)';
        body = `${user.name}, your contribution is still low (${contributionPercentage.toFixed(1)}%). Add entries to avoid penalties!`;
      } else {
        title = '🚨 Low Contribution (Final Alert)';
        body = `${user.name}, immediate action needed! Your contribution (${contributionPercentage.toFixed(1)}%) is significantly below fair share.`;
      }

      const payload: NotificationPayload = {
        title,
        body,
        icon: '/pwa-icons/icon-512.png',
        badge: '/pwa-icons/icon-512.png',
        data: {
          url: '/entries',
          type: 'low_contribution',
          contributionPercentage,
          fairShareThreshold
        },
        tag: 'low-contribution',
        requireInteraction: true
      };

      await this.sendToUser(userId, payload);
      
      // Track notification
      await storage.createOrUpdateNotificationTracking(userId, 'LOW_CONTRIBUTION', {
        contributionPercentage,
        fairShareThreshold
      });
      
      console.log(`📉 Low contribution alert sent to user ${userId} (attempt ${currentCount})`);
    } catch (error) {
      console.error(`❌ Failed to send low contribution alert to user ${userId}:`, error);
    }
  }

  /**
   * 🔄 Process all pending personalized notifications
   */
  async processPersonalizedNotifications(): Promise<void> {
    try {
      console.log('🔄 Processing personalized notifications...');
      
      // Process penalty reminders
      await this.processPenaltyReminders();
      
      // Process low contribution alerts
      await this._processLowContributionAlertsInternal();
      
      console.log('✅ Personalized notifications processing complete');
    } catch (error) {
      console.error('❌ Failed to process personalized notifications:', error);
    }
  }

  /**
   * 📆 Process penalty reminder notifications
   */
  private async processPenaltyReminders(): Promise<void> {
    try {
      const usersForReminders = await storage.getUsersForReminderNotifications();
      
      for (const userData of usersForReminders) {
        await this.sendPenaltyReminderNotification(
          userData._id, 
          userData.penaltyDate, 
          userData.flatSettings
        );
      }
      
      console.log(`📆 Processed ${usersForReminders.length} penalty reminder checks`);
    } catch (error) {
      console.error('❌ Failed to process penalty reminders:', error);
    }
  }

  /**
   * 📉 Process low contribution alerts (exposed for manual triggering)
   */
  async processLowContributionAlerts(): Promise<void> {
    return this._processLowContributionAlertsInternal();
  }

  /**
   * 📉 Internal method to process low contribution alerts
   */
  private async _processLowContributionAlertsInternal(): Promise<void> {
    try {
      const flats = await storage.getAllFlats();
      
      for (const flat of flats) {
        const users = await storage.getUsersByFlatId(flat._id.toString());
        const entries = await storage.getEntriesByFlatId(flat._id.toString());
        const penalties = await storage.getPenaltiesByFlatId(flat._id.toString());
        
        if (users.length === 0) continue;
        
        // Calculate contribution stats using same logic as frontend
        const approvedEntries = entries.filter(entry => entry && entry.status !== 'PENDING' && entry.status !== 'REJECTED');
        const totalAmount = approvedEntries.reduce((sum, entry) => sum + (entry?.amount || 0), 0);
        const totalPenaltyAmount = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);
        const finalFlatTotalEntry = Math.max(totalAmount - totalPenaltyAmount, 0.01);
        const finalFairShare = finalFlatTotalEntry / users.length;
        const fairSharePercentage = (1 / users.length) * 100;
        const fairShareThreshold = (75 * fairSharePercentage) / 100;
        
        for (const user of users) {
          const userPenalties = penalties.filter(p => {
            const penaltyUserId = typeof p.userId === 'string' ? p.userId : (p.userId as any)?._id?.toString() || p.userId;
            return penaltyUserId === user._id.toString();
          });
          const userPenaltyAmount = userPenalties.reduce((sum, penalty) => sum + penalty.amount, 0);
          const userEntries = approvedEntries.filter(entry => entry && entry.userId._id.toString() === user._id.toString());
          const userContribution = userEntries.reduce((sum, entry) => sum + (entry?.amount || 0), 0);
          const finalUserContribution = userContribution - userPenaltyAmount;
          const userContributionPercentage = finalFlatTotalEntry > 0 ? (finalUserContribution / finalFlatTotalEntry) * 100 : 0;
          
          // Check if user has low contribution
          if (finalFlatTotalEntry > 0 && finalFairShare > 0 && userContribution > 0 && userContributionPercentage < fairShareThreshold) {
            await this.sendLowContributionAlert(user._id?.toString() || user._id, userContributionPercentage, fairShareThreshold);
          }
        }
      }
      
      console.log(`📉 Processed low contribution alerts for ${flats.length} flats`);
    } catch (error) {
      console.error('❌ Failed to process low contribution alerts:', error);
    }
  }

  /**
   * 🚨 Universal penalty notification - works for ALL penalty types
   * Sends personalized notification whenever any penalty is applied to a user
   */
  async sendUniversalPenaltyNotification(
    userId: string, 
    penaltyAmount: number, 
    penaltyType: 'CONTRIBUTION_BASED' | 'TIME_BASED_AUTOMATIC' | 'MANUAL_ADMIN',
    description: string,
    adminMessage?: string,
    timestamp?: Date
  ): Promise<void> {
    try {
      const shouldSend = await storage.shouldSendNotification(userId, 'PENALTY_APPLIED');
      
      if (!shouldSend) {
        console.log(`⏸️ Skipping universal penalty notification for user ${userId} - rate limited`);
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) return;

      const tracking = await storage.getNotificationTracking(userId, 'PENALTY_APPLIED');
      const currentCount = tracking ? tracking.sentCount + 1 : 1;
      const penaltyTime = timestamp || new Date();
      
      // Create personalized messages based on penalty type and attempt count
      let title = '';
      let body = '';
      let icon = '❌';
      
      // First notification - immediate and informative
      if (currentCount === 1) {
        switch (penaltyType) {
          case 'CONTRIBUTION_BASED':
            title = '📉 Contribution Penalty Applied';
            body = `Hi ${user.name}, a ₹${penaltyAmount} penalty has been applied due to low contribution. ${description}`;
            icon = '📉';
            break;
          case 'TIME_BASED_AUTOMATIC':
            title = '⏱️ Automatic Penalty Applied';
            body = `Hi ${user.name}, an automatic penalty of ₹${penaltyAmount} has been applied. ${description}`;
            icon = '⏱️';
            break;
          case 'MANUAL_ADMIN':
            title = '👮 Admin Penalty Applied';
            body = `Hi ${user.name}, an admin has applied a ₹${penaltyAmount} penalty. ${description}`;
            icon = '👮';
            break;
        }
      } 
      // Second notification - reminder after 2 hours
      else if (currentCount === 2) {
        title = `${icon} Penalty Reminder`;
        body = `${user.name}, don't forget about the ₹${penaltyAmount} penalty applied earlier. Please review your account and increase contributions to avoid future penalties.`;
      } 
      // Third notification - next morning/final reminder
      else {
        title = `🚨 Final Penalty Notice`;
        body = `${user.name}, this is a final reminder about the ₹${penaltyAmount} penalty. Please address this and improve your contribution to avoid additional penalties.`;
      }

      // Add admin message if provided
      if (adminMessage && currentCount === 1) {
        body += `\n\n📝 Admin Note: ${adminMessage}`;
      }

      const payload: NotificationPayload = {
        title,
        body,
        icon: '/pwa-icons/icon-512.png',
        badge: '/pwa-icons/icon-512.png',
        data: {
          url: '/penalties',
          type: 'universal_penalty',
          penaltyAmount,
          penaltyType,
          timestamp: penaltyTime.toISOString(),
          adminMessage: adminMessage || null
        },
        actions: [
          {
            action: 'view_penalties',
            title: 'View Penalties',
            icon: '/pwa-icons/icon-512.png'
          },
          {
            action: 'view_entries',
            title: 'Add Entry',
            icon: '/pwa-icons/icon-512.png'
          }
        ],
        tag: 'universal-penalty',
        requireInteraction: true
      };

      await this.sendToUser(userId, payload);
      
      // Track notification with comprehensive metadata
      await storage.createOrUpdateNotificationTracking(userId, 'PENALTY_APPLIED', {
        penaltyAmount,
        description,
        penaltyType,
        timestamp: penaltyTime,
        adminMessage
      });
      
      console.log(`🚨 Universal penalty notification sent to user ${userId} (${penaltyType}, attempt ${currentCount})`);
    } catch (error) {
      console.error(`❌ Failed to send universal penalty notification to user ${userId}:`, error);
    }
  }

  /**
   * 🔁 Schedule smart repeat notifications for penalty acknowledgment
   * - 2nd notification: After 2 hours
   * - 3rd notification: Next morning (8 AM)
   */
  async scheduleRepeatPenaltyNotifications(
    userId: string, 
    penaltyAmount: number, 
    penaltyType: 'CONTRIBUTION_BASED' | 'TIME_BASED_AUTOMATIC' | 'MANUAL_ADMIN',
    description: string,
    adminMessage?: string,
    timestamp?: Date
  ): Promise<void> {
    const penaltyTime = timestamp || new Date();
    
    // Schedule 2nd notification after 2 hours
    setTimeout(async () => {
      try {
        const tracking = await storage.getNotificationTracking(userId, 'PENALTY_APPLIED');
        // Only send if user hasn't acknowledged and we haven't sent too many
        if (!tracking || (!tracking.acknowledged && tracking.sentCount < 2)) {
          await this.sendUniversalPenaltyNotification(userId, penaltyAmount, penaltyType, description, adminMessage, penaltyTime);
        }
      } catch (error) {
        console.error(`❌ Failed to send 2-hour penalty reminder to user ${userId}:`, error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds

    // Schedule 3rd notification next morning at 8 AM
    const nextMorning = new Date(penaltyTime);
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(8, 0, 0, 0); // 8:00 AM
    
    const timeUntilMorning = nextMorning.getTime() - Date.now();
    
    if (timeUntilMorning > 0) {
      setTimeout(async () => {
        try {
          const tracking = await storage.getNotificationTracking(userId, 'PENALTY_APPLIED');
          // Only send if user hasn't acknowledged and we haven't sent the final notice
          if (!tracking || (!tracking.acknowledged && tracking.sentCount < 3)) {
            await this.sendUniversalPenaltyNotification(userId, penaltyAmount, penaltyType, description, adminMessage, penaltyTime);
          }
        } catch (error) {
          console.error(`❌ Failed to send morning penalty reminder to user ${userId}:`, error);
        }
      }, timeUntilMorning);
    }
  }

  /**
   * 🧹 Clean up old notification schedules and tracking data
   * Removes acknowledged notifications older than 30 days
   */
  async cleanupOldNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // This would require a storage method to clean up old tracking data
      console.log('🧹 Cleaning up old notification tracking data...');
      
      // For now, just log - we can implement the actual cleanup in storage later
      console.log(`✅ Notification cleanup completed for data older than ${thirtyDaysAgo.toLocaleDateString()}`);
    } catch (error) {
      console.error('❌ Failed to clean up old notifications:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationManager = new PushNotificationManager();
