'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import type { WalletName } from '@solana/wallet-adapter-base';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LEGAL_DISCLAIMER } from '@/lib/constants';
import { getNonce, login, loginMessage } from '@/lib/auth-api';
import { useUserStore } from '@/stores/useUserStore';

type Status = 'idle' | 'choosing' | 'connecting' | 'signing' | 'done' | 'leaving';

// Staggered entrance: title → tagline → ball → button → footer
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const FRIENDLY_ERRORS: Record<string, string> = {
  rejected: 'No worries — you declined the request. Tap Connect Wallet to try again.',
  'no-wallet': 'No Solana wallet found. Install Phantom, then refresh this page.',
  'no-sign': "This wallet can't sign messages. Please use Phantom or Backpack.",
};

export default function LoginPage() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const { wallets, wallet, select, connect, connected, publicKey, signMessage, disconnect } =
    useWallet();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const installedWallets = useMemo(
    () =>
      wallets.filter(
        (w) =>
          w.readyState === WalletReadyState.Installed ||
          w.readyState === WalletReadyState.Loadable,
      ),
    [wallets],
  );

  const fail = useCallback((key: string, fallback?: string) => {
    setStatus('idle');
    setError(FRIENDLY_ERRORS[key] ?? fallback ?? 'Something went wrong. Please try again.');
  }, []);

  const pickWallet = useCallback(
    (name: WalletName) => {
      setError(null);
      setStatus('connecting');
      select(name);
    },
    [select],
  );

  const handleConnectClick = useCallback(() => {
    setError(null);
    if (installedWallets.length === 0) {
      fail('no-wallet');
      return;
    }
    if (installedWallets.length === 1) {
      pickWallet(installedWallets[0].adapter.name);
      return;
    }
    setStatus('choosing');
  }, [installedWallets, pickWallet, fail]);

  // Step 1: once a wallet is selected, open its connect prompt.
  useEffect(() => {
    if (status !== 'connecting' || !wallet || connected) return;
    connect().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      fail(/reject|denied|cancel/i.test(message) ? 'rejected' : '', message);
    });
  }, [status, wallet, connected, connect, fail]);

  // Step 2: once connected, run the challenge → sign → verify flow.
  useEffect(() => {
    if (status !== 'connecting' || !connected || !publicKey) return;
    if (!signMessage) {
      fail('no-sign');
      return;
    }
    setStatus('signing');
    const walletAddress = publicKey.toBase58();

    (async () => {
      const { nonce } = await getNonce(walletAddress);
      const signature = await signMessage(
        new TextEncoder().encode(loginMessage(walletAddress, nonce)),
      );
      const signatureBase64 = btoa(String.fromCharCode(...signature));
      const { user } = await login(walletAddress, signatureBase64, nonce);
      setUser(user);
      // ✓ Connected! → "Loading matches…" → slide out → navigate (no flash)
      setStatus('done');
      setTimeout(() => setStatus('leaving'), 700);
    })().catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      await disconnect().catch(() => undefined);
      fail(/reject|denied|cancel/i.test(message) ? 'rejected' : '', message);
    });
  }, [status, connected, publicKey, signMessage, setUser, router, disconnect, fail]);

  const busy = status === 'connecting' || status === 'signing';
  const signedIn = status === 'done' || status === 'leaving';

  return (
    <motion.main
      className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center"
      variants={containerVariants}
      initial="hidden"
      animate={status === 'leaving' ? { opacity: 0, x: -60 } : 'visible'}
      transition={status === 'leaving' ? { duration: 0.45, ease: 'easeIn' } : undefined}
      onAnimationComplete={() => {
        if (status === 'leaving') router.replace('/');
      }}
    >
      <motion.div variants={itemVariants} className="flex flex-col items-center gap-3">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">PULSE</h1>
        <p className="max-w-sm text-lg font-bold text-black/70">Prove You Can Feel The Game</p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Image
          src="/images/logo-golden-ball.webp"
          alt=""
          width={140}
          height={94}
          priority
          aria-hidden
        />
      </motion.div>

      <motion.div variants={itemVariants} className="flex w-full max-w-xs flex-col gap-3">
        {status === 'choosing' ? (
          installedWallets.map((w) => (
            <Button
              key={w.adapter.name}
              className="w-full text-base"
              onClick={() => pickWallet(w.adapter.name)}
            >
              {w.adapter.name}
            </Button>
          ))
        ) : signedIn ? (
          <>
            <Button variant="success" className="w-full py-4 text-base" disabled>
              ✓ Connected!
            </Button>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-bold text-black/60"
            >
              Loading matches…
            </motion.p>
          </>
        ) : (
          <Button className="w-full py-4 text-base" isLoading={busy} onClick={handleConnectClick}>
            {status === 'signing' ? 'Check your wallet…' : '⚡ Connect Wallet'}
          </Button>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="alert"
            className="rounded-xl border-2 border-black bg-red-300 px-3 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {error}
            {error === FRIENDLY_ERRORS['no-wallet'] && (
              <>
                {' '}
                <a
                  href="https://phantom.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline decoration-2 underline-offset-2"
                >
                  Get Phantom
                </a>
              </>
            )}
          </motion.p>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col gap-4">
        <p className="text-sm font-bold text-black/60">Powered by TxODDS TxLINE + Solana</p>
        <p className="max-w-sm text-xs font-medium text-black/50">{LEGAL_DISCLAIMER}</p>
      </motion.div>
    </motion.main>
  );
}
