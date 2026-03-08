import webpush from 'web-push';

// Set VAPID details from environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BDs1KywHa6iBwuTPOP6KzmvV4sUE_r1de83V9nf23eK0XgmJsVHvSkeoBmUZ-Jefa5M9lso7Mi-7TKBpnUAPYjc',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'HBgZ7eZOxok46xn-pQKMXtozJHIz2RTj6VXhVSf5HyM',
  subject: process.env.VAPID_SUBJECT || 'mailto:admin@roomieapp.com'
};

webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

/**
 * 🔔 Enhanced Push Notification Service for Roomie
 * Database-backed with targeted notification methods
 */
export class PushNotificationService {
  private flatId: string;

  constructor(flatId: string) {
    this.flatId = flatId;
  }

  // Helper to get storage instance dynamically
  private async getStorage() {
    const { storage } = await import('./storage');
    return storage;
  }

  // =============================================
  // 🎯 CORE TARGETING METHODS
  // =============================================

  /**
   * 📢 Notify ALL users in the flat
   * @param extraData - optional data to include in notification payload (e.g. url, billId for click handling)
   */
  async pushToAllUsers(title: string, body: string, extraData?: Record<string, unknown>) {
    console.log(`📢 [ALL USERS - Flat ${this.flatId}] ${title}: ${body}`);
    
    try {
      const storage = await this.getStorage();
      const subscriptions = await storage.getPushSubscriptionsByFlatId(this.flatId);
      
      if (subscriptions.length === 0) {
        console.log(`❌ No subscriptions found for flat ${this.flatId}`);
        return { success: false, message: 'No subscriptions found for this flat' };
      }

      return await this.sendNotificationToSubscriptions(subscriptions, title, body, extraData);
    } catch (error: any) {
      console.error(`Error in pushToAllUsers for flat ${this.flatId}:`, error);
      return {
        success: false,
        message: 'Failed to send notifications to flat',
        error: error.message
      };
    }
  }

  /**
   * 📬 Notify a specific user
   */
  async pushToUser(title: string, body: string, userId: string) {
    console.log(`📬 [USER ${userId} - Flat ${this.flatId}] ${title}: ${body}`);
    
    try {
      const storage = await this.getStorage();
      const subscriptions = await storage.getPushSubscriptionsByUserId(userId);
      
      if (subscriptions.length === 0) {
        console.log(`❌ No subscriptions found for user ${userId}`);
        return { success: false, message: 'No subscriptions found for user' };
      }

      const result = await this.sendNotificationToSubscriptions(subscriptions, title, body);
      return {
        ...result,
        userId,
        flatId: this.flatId
      };
    } catch (error: any) {
      console.error(`Error in pushToUser for user ${userId}:`, error);
      return {
        success: false,
        message: 'Failed to send notification to user',
        error: error.message
      };
    }
  }

  /**
   * 🚫 Notify all users except one
   */
  async pushToAllUsersExcept(title: string, body: string, excludedUserId: string) {
    console.log(`📢 [ALL EXCEPT USER ${excludedUserId} - Flat ${this.flatId}] ${title}: ${body}`);
    
    try {
      const storage = await this.getStorage();
      const subscriptions = await storage.getPushSubscriptionsExceptUser(this.flatId, excludedUserId);
      
      if (subscriptions.length === 0) {
        console.log(`❌ No subscriptions found for flat ${this.flatId} (excluding user ${excludedUserId})`);
        return { success: false, message: 'No subscriptions found for other users' };
      }

      const result = await this.sendNotificationToSubscriptions(subscriptions, title, body);
      return {
        ...result,
        excludedUserId,
        flatId: this.flatId
      };
    } catch (error: any) {
      console.error(`Error in pushToAllUsersExcept for flat ${this.flatId}:`, error);
      return {
        success: false,
        message: 'Failed to send notifications to other users',
        error: error.message
      };
    }
  }

  /**
   * 🎯 Notify multiple selected users
   */
  async pushToMultipleUsers(title: string, body: string, userIds: string[] = []) {
    if (!userIds.length) {
      console.warn("⚠️ No users provided to send notifications.");
      return { success: false, message: 'No users provided' };
    }
    
    console.log(`📬 [MULTI USERS - Flat ${this.flatId}] ${title}: ${body}`);
    userIds.forEach(uid => {
      console.log(`➡️ Sending to User ${uid}`);
    });

    try {
      const storage = await this.getStorage();
      const subscriptions = await storage.getPushSubscriptionsByUserIds(userIds);
      
      if (subscriptions.length === 0) {
        console.log(`❌ No subscriptions found for users: ${userIds.join(', ')}`);
        return { success: false, message: 'No subscriptions found for specified users' };
      }

      const result = await this.sendNotificationToSubscriptions(subscriptions, title, body);
      return {
        ...result,
        userIds,
        flatId: this.flatId
      };
    } catch (error: any) {
      console.error(`Error in pushToMultipleUsers for users ${userIds.join(', ')}:`, error);
      return {
        success: false,
        message: 'Failed to send notifications to multiple users',
        error: error.message
      };
    }
  }

  // =============================================
  // 🏠 BUSINESS LOGIC METHODS (Roomie-specific)
  // =============================================

  /**
   * 🎉 Welcome a new user
   */
  async sendWelcomeNotification(user: { id: string, name: string, flatName: string }) {
    const title = "🎉 Welcome to Roomie!";
    const body = `Hi ${user.name}, welcome to ${user.flatName}. Start collaborating with your roommates today.`;
    return await this.pushToUser(title, body, user.id);
  }

  /**
   * 📝 Notify entry added
   */
  async notifyEntryAdded(currentUser: { id: string, name: string }, entry: { name: string, amount: number }) {
    const title = "📝 New Entry Added";
    const body = `${currentUser.name} added a new entry: "${entry.name}" for ₹${entry.amount}.`;
    return await this.pushToAllUsersExcept(title, body, currentUser.id);
  }

  /**
   * 📝 Notify entry updated (to entry owner only)
   */
  async notifyEntryUpdated(entryOwner: { id: string, name: string }, entry: { name: string, amount: number }, updatedBy: { name: string }) {
    const title = "📝 Your Entry Updated";
    const body = `${updatedBy.name} updated your entry: "${entry.name}" to ₹${entry.amount}.`;
    return await this.pushToUser(title, body, entryOwner.id);
  }

  /**
   * ❌ Notify entry deleted (to entry owner only)
   */
  async notifyEntryDeleted(entryOwner: { id: string, name: string }, entry: { name: string, amount: number }, deletedBy: { name: string }) {
    const title = "❌ Your Entry Deleted";
    const body = `${deletedBy.name} deleted your entry: "${entry.name}" of ₹${entry.amount}.`;
    return await this.pushToUser(title, body, entryOwner.id);
  }

  /**
   * ⚖️ Notify penalty applied
   */
  async notifyPenaltyApplied(penalizedUser: { id: string }, penalty: { desc: string, amount: number }) {
    const title = "⚖️ Penalty Applied";
    const body = `A penalty was applied: "${penalty.desc}" of ₹${penalty.amount}.`;
    return await this.pushToUser(title, body, penalizedUser.id);
  }

  /**
   * ✏️ Notify penalty edited
   */
  async notifyPenaltyEdited(penalizedUser: { id: string }, penalty: { desc: string, amount: number, oldAmount?: number }) {
    const title = "✏️ Penalty Updated";
    const body = penalty.oldAmount 
      ? `Your penalty "${penalty.desc}" was updated from ₹${penalty.oldAmount} to ₹${penalty.amount}.`
      : `Your penalty "${penalty.desc}" was updated to ₹${penalty.amount}.`;
    return await this.pushToUser(title, body, penalizedUser.id);
  }

  /**
   * 🗑️ Notify penalty deleted
   */
  async notifyPenaltyDeleted(penalizedUser: { id: string }, penalty: { desc: string, amount: number }) {
    const title = "🗑️ Penalty Removed";
    const body = `Good news! Your penalty "${penalty.desc}" of ₹${penalty.amount} has been removed.`;
    return await this.pushToUser(title, body, penalizedUser.id);
  }

  /**
   * 📢 Flat-wide admin announcement
   */
  async sendFlatAnnouncement(message: string) {
    const title = "📢 Flat Announcement";
    return await this.pushToAllUsers(title, message);
  }

  /**
   * ⏰ Reminder notification
   */
  async sendReminder(user: { id: string, name: string }, pendingAmount: number) {
    const title = "⏰ Friendly Reminder";
    const body = `Hey ${user.name}, your pending contribution is ₹${pendingAmount}. Please update it before Friday to avoid penalty.`;
    return await this.pushToUser(title, body, user.id);
  }

  /**
   * 💰 Payment reminder notification — includes total due and pending amount
   */
  async sendPaymentReminder(user: { id: string, name: string }, totalDue: number, remainingAmount: number) {
    const title = "💰 Payment Reminder";
    const body = `Hi ${user.name}, your total due is ₹${totalDue.toFixed(2)}. Pending amount: ₹${remainingAmount.toFixed(2)}. Please clear your dues in the Roomie app.`;
    return await this.pushToUser(title, body, user.id);
  }

  /**
   * 📋 Notify all flat members when a new monthly bill is created.
   * Title includes month so users see "this month's bill"; click opens Payments page (and optionally selects the bill).
   */
  async notifyNewBillCreated(month: string, year: number, totalAmount: number, dueDateStr?: string, billId?: string) {
    const title = `📋 New bill for ${month} ${year}`;
    const dueText = dueDateStr ? ` Due ${dueDateStr}.` : "";
    const body = `This month's bill is here. Total: ₹${totalAmount.toLocaleString()}.${dueText} Tap to open and check your share.`;
    const url = billId ? `/payments?billId=${encodeURIComponent(billId)}` : "/payments";
    return await this.pushToAllUsers(title, body, { url, billId: billId || undefined });
  }

  /**
   * ✅ Payment fully paid — notify user (no reminders after this)
   */
  async sendPaymentFullyPaidNotification(user: { id: string, name: string }) {
    const title = "✅ Payment Complete";
    const body = `Hi ${user.name}, your payment for this month's bill has been recorded. You're all set!`;
    return await this.pushToUser(title, body, user.id);
  }

  /**
   * 🚀 Notify all users about app updates
   */
  async notifyAppUpdate(updateDetails: string) {
    const title = "🚀 New Updates in Roomie";
    const body = `We've added exciting new features and improvements: ${updateDetails}. Check them out now!`;
    return await this.pushToAllUsers(title, body);
  }

  /**
   * ⚠️ Notify multiple users about manual contribution penalty
   */
  async notifyManualContributionPenalty(
    users: Array<{ id: string, name: string, contribution: number }>, 
    flat: { fairShare: number }, 
    penaltyAmount: number
  ) {
    const title = "⚠️ Manual Penalty Applied";
    const results = [];

    for (const user of users) {
      const body = `Your contribution is below the required amount ₹${user.contribution} < ₹${flat.fairShare}. ₹${penaltyAmount} penalty applied.`;
      const result = await this.pushToUser(title, body, user.id);
      results.push({ userId: user.id, ...result });
    }

    return {
      success: true,
      message: `Sent penalty notifications to ${users.length} users`,
      results
    };
  }

  /**
   * ⚠️ Check and notify users with low contribution warnings
   */
  async checkAndNotifyLowContributionWarnings() {
    try {
      const storage = await this.getStorage();
      
      // Get flat data
      const flat = await storage.getFlatById(this.flatId);
      if (!flat) return { success: false, message: 'Flat not found' };

      // Get users and penalty settings
      const users = await storage.getUsersByFlatId(this.flatId);
      const settings = await storage.getPenaltySettings(this.flatId);
      if (!users.length || !settings) return { success: false, message: 'No users or settings found' };

      // Get entries and penalties data
      const entries = await storage.getEntriesByFlatId(this.flatId);
      const approvedEntries = entries.filter(entry => entry && entry.status !== 'PENDING' && entry.status !== 'REJECTED');
      const penaltyEntries = await storage.getPenaltiesByFlatId(this.flatId);
      
      // Calculate totals
      const totalAmount = approvedEntries.reduce((sum, entry) => sum + (entry?.amount || 0), 0);
      const totalPenaltyAmount = penaltyEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const finalFlatTotalEntry = totalAmount - totalPenaltyAmount;
      const finalFairShare = finalFlatTotalEntry / users.length;
      
      // Calculate warning threshold (75% of fair share)
      const totalUsers = users.length;
      const fairSharePercentage = (1 / totalUsers) * 100;
      const fairShareThreshold = (75 * fairSharePercentage) / 100;

      const warningNotifications = [];

      for (const user of users) {
        // Calculate user's contribution
        const userPenaltyEntries = penaltyEntries.filter(entry => {
          const entryUserId = typeof entry.userId === 'string' ? entry.userId : (entry.userId as any)?._id?.toString() || entry.userId;
          return entryUserId === user._id.toString();
        });
        const userPenaltyAmount = userPenaltyEntries.reduce((sum, entry) => sum + entry.amount, 0);

        const userEntries = approvedEntries.filter(entry => entry && entry.userId._id.toString() === user._id.toString());
        const userContribution = userEntries.reduce((sum, entry) => sum + (entry?.amount || 0), 0);
        const finalUserContribution = userContribution - userPenaltyAmount;
        const userContributionPercentage = (finalUserContribution / finalFlatTotalEntry) * 100;

        // Check if user has low contribution warning
        if (userContributionPercentage < fairShareThreshold && finalUserContribution < finalFairShare) {
          const deficit = finalFairShare - finalUserContribution;
          
          const title = "⚠️ Low Contribution Warning";
          const body = `Your contribution (₹${finalUserContribution.toFixed(2)}) is below the recommended amount (₹${finalFairShare.toFixed(2)}). Consider adding ₹${deficit.toFixed(2)} more to avoid penalties.`;
          
          try {
            const result = await this.pushToUser(title, body, user._id.toString());
            warningNotifications.push({
              userId: user._id.toString(),
              userName: user.name,
              deficit: deficit.toFixed(2),
              contribution: finalUserContribution.toFixed(2),
              required: finalFairShare.toFixed(2),
              ...result
            });
            console.log(`⚠️ Warning notification sent to ${user.name}: deficit ₹${deficit.toFixed(2)}`);
          } catch (notificationError: any) {
            console.error(`❌ Failed to send warning notification to user ${user._id}:`, notificationError);
            warningNotifications.push({
              userId: user._id.toString(),
              userName: user.name,
              success: false,
              error: notificationError?.message || 'Unknown error'
            });
          }
        }
      }

      return {
        success: true,
        message: `Checked ${users.length} users, sent ${warningNotifications.length} warning notifications`,
        warningCount: warningNotifications.length,
        totalUsers: users.length,
        notifications: warningNotifications
      };

    } catch (error: any) {
      console.error(`Error in checkAndNotifyLowContributionWarnings for flat ${this.flatId}:`, error);
      return {
        success: false,
        message: 'Failed to check low contribution warnings',
        error: error.message
      };
    }
  }

  // =============================================
  // 🛠️ HELPER METHODS
  // =============================================

  /**
   * Helper method to send notifications to a list of subscriptions
   * @param extraData - optional data merged into payload.data (e.g. url for click-to-open)
   */
  private async sendNotificationToSubscriptions(subscriptions: any[], title: string, body: string, extraData?: Record<string, unknown>) {
    // Generate unique tag to prevent notifications from replacing each other
    const uniqueTag = `roomie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-icons/icon-512.png', // Custom Roomie icon
      badge: '/favicon-32x32.png',
      tag: uniqueTag, // Unique tag prevents notification replacement
      requireInteraction: true, // Keep notification visible until user interacts
      data: {
        url: '/',
        timestamp: Date.now(),
        notificationId: uniqueTag, // Include ID in data for tracking
        type: 'roomie-notification',
        ...extraData
      },
      timestamp: Date.now(),
      silent: false,
      vibrate: [200, 100, 200] // Vibration pattern for mobile devices
    });

    let successCount = 0;
    let failCount = 0;
    const invalidSubscriptions: string[] = [];

    const promises = subscriptions.map(async (subscription, index) => {
      try {
        await webpush.sendNotification(subscription, payload);
        successCount++;
        console.log(`✅ Notification sent to subscription ${index + 1}`);
      } catch (error: any) {
        failCount++;
        console.error(`❌ Failed to send to subscription ${index + 1}:`, error.message);
        
        // Clean up invalid subscriptions from database
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('🗑️ Invalid subscription detected - will clean up from database');
          invalidSubscriptions.push(subscription.endpoint);
        }
      }
    });

    await Promise.allSettled(promises);

    // Clean up invalid subscriptions from database
    if (invalidSubscriptions.length > 0) {
      console.log(`🧹 Cleaning up ${invalidSubscriptions.length} invalid subscriptions from database...`);
      for (const endpoint of invalidSubscriptions) {
        await PushNotificationService.cleanupInvalidSubscription(endpoint);
      }
    }

    return {
      success: true,
      message: `Sent to ${successCount} users, ${failCount} failed`,
      successCount,
      failCount,
      totalSubscriptions: subscriptions.length
    };
  }

  // =============================================
  // 🔧 STATIC METHODS (for backward compatibility and utilities)
  // =============================================

  /**
   * Add a push subscription to database (static method for backward compatibility)
   */
  static async addSubscription(subscription: any, userId?: string) {
    if (!userId) {
      console.log('❌ No userId provided for subscription');
      return false;
    }
    
    const { storage } = await import('./storage');
    return await storage.addPushSubscription(userId, subscription);
  }

  /**
   * Send notification to all subscribed users (static method for testing/admin use)
   */
  static async sendToAll(title: string, body: string) {
    try {
      const { storage } = await import('./storage');
      const subscriptions = await storage.getAllPushSubscriptions();
      
      if (subscriptions.length === 0) {
        console.log('❌ No subscriptions found in database');
        return { success: false, message: 'No subscriptions found' };
      }

      // Create a temporary instance to use the helper method
      const tempService = new PushNotificationService('global');
      return await tempService.sendNotificationToSubscriptions(subscriptions, title, body);
    } catch (error: any) {
      console.error('Error in sendToAll:', error);
      return {
        success: false,
        message: 'Failed to send notifications',
        error: error.message
      };
    }
  }

  /**
   * Send notification to users in a specific flat (static method for backward compatibility)
   */
  static async sendToFlat(flatId: string, title: string, body: string) {
    const service = new PushNotificationService(flatId);
    return await service.pushToAllUsers(title, body);
  }

  /**
   * Clean up invalid subscription from database by endpoint
   */
  static async cleanupInvalidSubscription(endpoint: string) {
    try {
      const { storage } = await import('./storage');
      const result = await storage.cleanupPushSubscriptionByEndpoint(endpoint);
      if (result) {
        console.log(`✅ Cleaned up invalid subscription from database: ${endpoint.substring(0, 50)}...`);
      } else {
        console.log(`⚠️ Subscription not found in database: ${endpoint.substring(0, 50)}...`);
      }
    } catch (error: any) {
      console.error('Error cleaning up invalid subscription:', error.message);
    }
  }

  /**
   * Get VAPID public key for client subscription
   */
  static getVapidPublicKey() {
    return vapidKeys.publicKey;
  }

  /**
   * Get subscription count from database
   */
  static async getSubscriptionCount() {
    try {
      const { storage } = await import('./storage');
      const subscriptions = await storage.getAllPushSubscriptions();
      return subscriptions.length;
    } catch (error) {
      console.error('Error getting subscription count:', error);
      return 0;
    }
  }
}
