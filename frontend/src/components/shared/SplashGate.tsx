'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SplashScreen } from './SplashScreen';
import { getSession } from '@/lib/auth-api';

const SPLASH_FLAG = 'pulse_splash_complete';

/**
 * Shows the splash exactly once per browser session (sessionStorage flag).
 * After the intro: first-time visitors on the home page who aren't signed in
 * are taken to /login; refreshes and returning navigation skip the splash.
 */
export function SplashGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_FLAG) !== '1') {
      setShowSplash(true);
    }
  }, []);

  const handleComplete = useCallback(() => {
    sessionStorage.setItem(SPLASH_FLAG, '1');
    setShowSplash(false);
    // Onboarding flow: splash → login for signed-out first-timers landing on home.
    if (pathname === '/' && !getSession()) {
      router.replace('/login');
    }
  }, [pathname, router]);

  if (!showSplash) return null;
  return <SplashScreen onComplete={handleComplete} />;
}
