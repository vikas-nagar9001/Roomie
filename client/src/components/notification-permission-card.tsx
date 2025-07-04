/**
 * 🔔 Push Notification Permission Component
 * Handles requesting and managing push notification permissions
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Bell, BellOff, TestTube, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface NotificationPermissionCardProps {
  className?: string;
  showTestButton?: boolean;
}

export function NotificationPermissionCard({ 
  className = '', 
  showTestButton = true 
}: NotificationPermissionCardProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className={`bg-gray-800 border-gray-700 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BellOff className="h-5 w-5 text-gray-400" />
            Push Notifications
          </CardTitle>
          <CardDescription className="text-gray-400">
            Push notifications are not supported on this device or browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Granted
          </Badge>
        );
      case 'denied':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Denied
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-600 hover:bg-yellow-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Set
          </Badge>
        );
    }
  };

  const getSubscriptionBadge = () => {
    if (isSubscribed) {
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Bell className="h-3 w-3 mr-1" />
          Subscribed
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-gray-600 text-gray-400">
          <BellOff className="h-3 w-3 mr-1" />
          Not Subscribed
        </Badge>
      );
    }
  };

  return (
    <Card className={`bg-gray-800 border-gray-700 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Bell className="h-5 w-5 text-blue-400" />
          Push Notifications
        </CardTitle>
        <CardDescription className="text-gray-400">
          Get notified when flatmates add new entries or when your entries are approved.
        </CardDescription>
        <div className="flex gap-2 mt-2">
          {getPermissionBadge()}
          {getSubscriptionBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {permission === 'default' && (
          <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700/50">
            <p className="text-sm text-blue-300 mb-3">
              🔔 Enable notifications to stay updated when flatmates add new expenses!
            </p>
            <Button
              onClick={requestPermission}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting Permission...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Enable Notifications
                </>
              )}
            </Button>
          </div>
        )}

        {permission === 'granted' && !isSubscribed && (
          <div className="p-3 bg-green-900/30 rounded-lg border border-green-700/50">
            <p className="text-sm text-green-300 mb-3">
              ✅ Permission granted! Click to subscribe to notifications.
            </p>
            <Button
              onClick={subscribe}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Subscribe to Notifications
                </>
              )}
            </Button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/50">
            <p className="text-sm text-red-300">
              🚫 Notifications are blocked. To enable them:
            </p>
            <ul className="text-xs text-red-300 mt-2 ml-4 space-y-1">
              <li>• Click the lock/notification icon in your browser's address bar</li>
              <li>• Select "Allow" for notifications</li>
              <li>• Refresh the page</li>
            </ul>
          </div>
        )}

        {permission === 'granted' && isSubscribed && (
          <div className="p-3 bg-green-900/30 rounded-lg border border-green-700/50">
            <p className="text-sm text-green-300 mb-3">
              ✅ You're subscribed to notifications! You'll get notified about new entries.
            </p>
            
            <div className="flex gap-2">
              {showTestButton && (
                <Button
                  onClick={sendTestNotification}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-green-600 text-green-300 hover:bg-green-600 hover:text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test
                    </>
                  )}
                </Button>
              )}
              
              <Button
                onClick={unsubscribe}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="flex-1 border-red-600 text-red-300 hover:bg-red-600 hover:text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unsubscribing...
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Unsubscribe
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
