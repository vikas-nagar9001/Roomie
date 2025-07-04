/**
 * 📅 Notification Scheduler Service
 * Handles scheduled execution of personalized notifications
 */

import { pushNotificationManager } from './push-notifications';

class NotificationScheduler {
  private intervals: NodeJS.Timeout[] = [];

  /**
   * 🚀 Start all notification schedulers
   */
  start(): void {
    console.log('📅 Starting notification schedulers...');
    
    // Process personalized notifications every 30 minutes
    this.startPersonalizedNotificationProcessor();
    
    // Process penalty reminders every 2 hours
    this.startPenaltyReminderProcessor();
    
    console.log('✅ Notification schedulers started');
  }

  /**
   * 🛑 Stop all schedulers
   */
  stop(): void {
    console.log('📅 Stopping notification schedulers...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('✅ Notification schedulers stopped');
  }

  /**
   * 🔄 Start personalized notification processor (every 30 minutes)
   */
  private startPersonalizedNotificationProcessor(): void {
    // Run immediately on startup
    this.processPersonalizedNotifications();
    
    // Then run every 30 minutes
    const interval = setInterval(() => {
      this.processPersonalizedNotifications();
    }, 30 * 60 * 1000); // 30 minutes
    
    this.intervals.push(interval);
    console.log('📋 Personalized notification processor started (every 30 minutes)');
  }

  /**
   * 📆 Start penalty reminder processor (every 2 hours)
   */
  private startPenaltyReminderProcessor(): void {
    // Run immediately on startup
    this.processPenaltyReminders();
    
    // Then run every 2 hours
    const interval = setInterval(() => {
      this.processPenaltyReminders();
    }, 2 * 60 * 60 * 1000); // 2 hours
    
    this.intervals.push(interval);
    console.log('⏰ Penalty reminder processor started (every 2 hours)');
  }

  /**
   * 🔄 Process all personalized notifications
   */
  private async processPersonalizedNotifications(): Promise<void> {
    try {
      console.log('🔄 Processing personalized notifications...');
      await pushNotificationManager.processPersonalizedNotifications();
    } catch (error) {
      console.error('❌ Failed to process personalized notifications:', error);
    }
  }

  /**
   * 📆 Process penalty reminders specifically
   */
  private async processPenaltyReminders(): Promise<void> {
    try {
      console.log('📆 Processing penalty reminders...');
      
      // This will handle penalty reminders (1 day before penalty application)
      await pushNotificationManager.processPersonalizedNotifications();
    } catch (error) {
      console.error('❌ Failed to process penalty reminders:', error);
    }
  }

  /**
   * 📊 Manual trigger for testing (run all notifications immediately)
   */
  async triggerManual(): Promise<void> {
    try {
      console.log('🔧 Manual notification trigger initiated...');
      
      await this.processPersonalizedNotifications();
      await this.processPenaltyReminders();
      
      console.log('✅ Manual notification trigger completed');
    } catch (error) {
      console.error('❌ Manual notification trigger failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationScheduler = new NotificationScheduler();
