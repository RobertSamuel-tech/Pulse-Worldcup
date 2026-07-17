'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useRef } from 'react';
import { logout } from '@/lib/auth-api';
import { useUserStore } from '@/stores/useUserStore';

/**
 * Clears the session the moment the wallet disconnects (SECTION 12: "Clear
 * session on disconnect"). Renders nothing — just watches connection state.
 */
export function WalletSessionSync() {
  const { connected } = useWallet();
  const setUser = useUserStore((s) => s.setUser);
  const wasConnected = useRef(false);

  useEffect(() => {
    if (wasConnected.current && !connected) {
      void logout();
      setUser(null);
    }
    wasConnected.current = connected;
  }, [connected, setUser]);

  return null;
}
