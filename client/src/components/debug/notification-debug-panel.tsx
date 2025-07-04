/**
 * 🧪 Debug Component for Smart Notifications
 * Only visible in development mode for testing notification logic
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSmartNotifications } from '@/hooks/use-smart-notifications';
import { isPWA, getPWADisplayMode } from '@/lib/pwa-utils';

export function NotificationDebugPanel() {
  const {
    permission,
    isSupported,
    canAsk,
    isFirstPWAOpen,
    promptCount,
    lastPromptDate,
    requestPermission,
    clearData,
    getStats
  } = useSmartNotifications();

  const [stats, setStats] = useState(getStats());

  const refreshStats = () => {
    setStats(getStats());
  };

  const handleClearData = () => {
    clearData();
    refreshStats();
  };

  const handleRequestPermission = async () => {
    try {
      await requestPermission();
      refreshStats();
    } catch (error) {
      console.error('Failed to request permission:', error);
    }
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Notification Debug Panel
          <Badge variant="outline">DEV ONLY</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div>
          <h3 className="font-semibold mb-2">Current Status</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Permission: <Badge>{permission}</Badge></div>
            <div>Supported: <Badge variant={isSupported ? "default" : "destructive"}>{isSupported ? "Yes" : "No"}</Badge></div>
            <div>Can Ask: <Badge variant={canAsk ? "default" : "secondary"}>{canAsk ? "Yes" : "No"}</Badge></div>
            <div>PWA: <Badge variant={isPWA() ? "default" : "secondary"}>{isPWA() ? "Yes" : "No"}</Badge></div>
            <div>Display Mode: <Badge variant="outline">{getPWADisplayMode()}</Badge></div>
            <div>First PWA Open: <Badge variant={isFirstPWAOpen ? "default" : "secondary"}>{isFirstPWAOpen ? "Yes" : "No"}</Badge></div>
          </div>
        </div>

        {/* Tracking Stats */}
        <div>
          <h3 className="font-semibold mb-2">Tracking Stats</h3>
          <div className="text-sm space-y-1">
            <div>Prompt Count: <span className="font-mono">{promptCount}</span></div>
            <div>Last Prompt: <span className="font-mono">{lastPromptDate ? new Date(lastPromptDate).toLocaleString() : 'Never'}</span></div>
            {stats.lastDenialDate && (
              <div>Last Denial: <span className="font-mono">{new Date(stats.lastDenialDate).toLocaleString()}</span></div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            onClick={handleRequestPermission}
            disabled={!canAsk || !isSupported}
          >
            Request Permission
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={refreshStats}
          >
            Refresh Stats
          </Button>
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={handleClearData}
          >
            Clear Data
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-600 mt-4 p-2 bg-gray-100 rounded">
          <strong>Testing Instructions:</strong>
          <ul className="list-disc ml-4 mt-1 space-y-1">
            <li>Clear data and reload to test first-time flow</li>
            <li>Deny permission to test retry logic</li>
            <li>Check console for detailed logs</li>
            <li>Test in PWA mode vs browser mode</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
