'use client';

import { WalletProvider } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { WalletSessionSync } from './WalletSessionSync';

/**
 * Solana wallet context. Phantom, Backpack and other modern wallets register
 * themselves via the Wallet Standard, so no explicit adapters are needed.
 * No ConnectionProvider: the browser never talks to the chain — signatures only.
 */
export function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [], []);
  return (
    <WalletProvider wallets={wallets} autoConnect={false}>
      <WalletSessionSync />
      {children}
    </WalletProvider>
  );
}
