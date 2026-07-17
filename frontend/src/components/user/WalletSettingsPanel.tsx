'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { logout } from '@/lib/auth-api';
import {
  getHistory,
  getSolBalance,
  requestAirdrop,
} from '@/lib/profile-api';
import { SOLANA_NETWORK } from '@/lib/constants';
import { cn, shortenAddress } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';
import { isMusicEnabled, setMusicEnabled } from '@/utils/background-music';

const SOUND_KEY = 'pulse_sound_enabled';
const HAPTICS_KEY = 'pulse_haptics_enabled';

function useLocalToggle(key: string): [boolean, () => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(localStorage.getItem(key) !== '0');
  }, [key]);
  const toggle = useCallback(() => {
    setOn((v) => {
      localStorage.setItem(key, v ? '0' : '1');
      return !v;
    });
  }, [key]);
  return [on, toggle];
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl border-2 border-black bg-white/70 px-3 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      {label}
      <span
        className={cn(
          'rounded-full border-2 border-black px-2 py-0.5 text-xs font-black',
          on ? 'bg-emerald-300' : 'bg-slate-200',
        )}
      >
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

export function WalletSettingsPanel({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.setUser);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [airdropState, setAirdropState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sound, toggleSound] = useLocalToggle(SOUND_KEY);
  const [haptics, toggleHaptics] = useLocalToggle(HAPTICS_KEY);
  const [music, setMusic] = useState(true);
  useEffect(() => setMusic(isMusicEnabled()), []);
  const toggleMusic = useCallback(() => {
    setMusic((v) => {
      setMusicEnabled(!v); // persists + live-stops/starts the loop
      return !v;
    });
  }, []);

  const refreshBalance = useCallback(() => {
    setRefreshing(true);
    setBalanceError(false);
    getSolBalance(walletAddress)
      .then(setBalance)
      .catch(() => setBalanceError(true))
      .finally(() => setRefreshing(false));
  }, [walletAddress]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const copyAddress = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const airdrop = (): void => {
    setAirdropState('busy');
    requestAirdrop(walletAddress)
      .then(() => {
        setAirdropState('ok');
        setTimeout(refreshBalance, 2_000);
      })
      .catch(() => setAirdropState('fail'))
      .finally(() => setTimeout(() => setAirdropState('idle'), 4_000));
  };

  const exportCsv = (): void => {
    setExporting(true);
    getHistory('all', 100, 0)
      .then(({ predictions }) => {
        const header = 'date,match,minute,predicted,correct,event,points';
        const rows = predictions.map((p) =>
          [
            p.createdAt,
            p.match ? `${p.match.homeTeamCode} vs ${p.match.awayTeamCode}` : '',
            p.matchMinute,
            p.predictedAction ? 'YES' : 'NO',
            p.wasCorrect ? 'yes' : 'no',
            p.eventType ?? 'NONE',
            p.pointsEarned,
          ].join(','),
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pulse-predictions.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => undefined)
      .finally(() => setExporting(false));
  };

  const disconnect = async (): Promise<void> => {
    await logout().catch(() => undefined);
    clearUser(null);
    router.replace('/login');
  };

  const actionBtn =
    'rounded-xl border-2 border-black bg-white/70 px-3 py-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide">Wallet & Settings</h2>
        <span className="rounded-full border-2 border-black bg-purple-300 px-2 py-0.5 text-[10px] font-black uppercase">
          {SOLANA_NETWORK}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border-2 border-black bg-white/70 px-2 py-1 font-mono text-xs font-bold">
          {shortenAddress(walletAddress)}
        </span>
        <span className="rounded-lg border-2 border-black bg-amber-200 px-2 py-1 font-mono text-xs font-black">
          {balanceError ? 'RPC error' : balance === null ? '…' : `${balance.toFixed(3)} SOL`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button className={actionBtn} disabled={refreshing} onClick={refreshBalance}>
          {refreshing ? '…' : '↻ Refresh'}
        </button>
        <button className={actionBtn} onClick={() => void copyAddress()}>
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
        <a
          className={`${actionBtn} text-center`}
          href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          🔍 Solscan
        </a>
        {SOLANA_NETWORK === 'devnet' && (
          <button className={actionBtn} disabled={airdropState === 'busy'} onClick={airdrop}>
            {airdropState === 'busy'
              ? '…'
              : airdropState === 'ok'
                ? '✓ Sent!'
                : airdropState === 'fail'
                  ? 'Faucet dry 😅'
                  : '🪂 Airdrop 1 SOL'}
          </button>
        )}
        <button className={actionBtn} disabled={exporting} onClick={exportCsv}>
          {exporting ? '…' : '⬇️ Export CSV'}
        </button>
        <button
          className={`${actionBtn} bg-red-300 hover:bg-red-400`}
          onClick={() => setConfirmOpen(true)}
        >
          ⏏ Disconnect
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <Toggle label="🔊 Sound Effects" on={sound} onToggle={toggleSound} />
        <Toggle label="🎵 Background Music" on={music} onToggle={toggleMusic} />
        <Toggle label="📳 Haptic Feedback" on={haptics} onToggle={toggleHaptics} />
      </div>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Disconnect wallet?">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">
            You&apos;ll be signed out of PULSE. Your points and streaks are saved to your wallet.
          </p>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-xl border-2 border-black bg-red-400 px-4 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              onClick={() => void disconnect()}
            >
              Yes, disconnect
            </button>
            <button
              className="flex-1 rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
