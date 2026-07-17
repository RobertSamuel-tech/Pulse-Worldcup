import { WalletConnectionProvider } from '@/components/providers/WalletConnectionProvider';
import type { ReactNode } from 'react';

/**
 * Solana wallet context is scoped to the auth flow only — the ~110KB
 * wallet-adapter bundle is needed here for connect+sign, but nowhere else
 * (SECTION 11). Route-level code splitting keeps it out of every other
 * page's JS entirely, with no artificial loading delay on /login itself
 * (an earlier attempt to lazy-load it app-wide via next/dynamic instead
 * pushed /login's own LCP to 3.2s — this is faster for both sides).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <WalletConnectionProvider>{children}</WalletConnectionProvider>;
}
