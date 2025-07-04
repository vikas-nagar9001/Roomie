/**
 * 🚀 PWA Detection Utilities
 * Detects PWA installation and first-time opens
 */

/**
 * Check if the app is running as a PWA
 */
export function isPWA(): boolean {
  // Check for various PWA indicators
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isNavigatorStandalone = (window.navigator as any).standalone === true;
  
  return isStandalone || isFullscreen || isNavigatorStandalone;
}

/**
 * Check if this is the first time opening the PWA
 */
export function isFirstPWAOpen(): boolean {
  const PWA_OPENED_KEY = 'roomie_pwa_opened';
  
  if (!isPWA()) {
    return false;
  }
  
  const hasOpenedBefore = localStorage.getItem(PWA_OPENED_KEY);
  
  if (!hasOpenedBefore) {
    // Mark as opened
    localStorage.setItem(PWA_OPENED_KEY, 'true');
    return true;
  }
  
  return false;
}

/**
 * Get PWA display mode
 */
export function getPWADisplayMode(): string {
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  if (window.matchMedia('(display-mode: browser)').matches) {
    return 'browser';
  }
  return 'unknown';
}

/**
 * Log PWA status for debugging
 */
export function logPWAStatus(): void {
  const pwaStatus = {
    isPWA: isPWA(),
    displayMode: getPWADisplayMode(),
    isFirstOpen: isFirstPWAOpen(),
    userAgent: navigator.userAgent,
    standalone: (window.navigator as any).standalone
  };
  
  console.log('🚀 PWA Status:', pwaStatus);
}
