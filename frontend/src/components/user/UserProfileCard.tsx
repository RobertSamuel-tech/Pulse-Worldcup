'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { saveSettings, type ProfileBundle } from '@/lib/profile-api';
import { shortenAddress } from '@/lib/utils';
import { teamFlag, TEAM_NAMES } from '@/utils/flags';

function memberSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

interface UserProfileCardProps {
  profile: ProfileBundle;
  onSaved: (user: { username: string | null; favoriteTeam: string | null }) => void;
}

export function UserProfileCard({ profile, onSaved }: UserProfileCardProps) {
  const { user } = profile;
  const [username, setUsername] = useState(user.username ?? '');
  const [favoriteTeam, setFavoriteTeam] = useState(user.favoriteTeam ?? '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = username !== (user.username ?? '') || favoriteTeam !== (user.favoriteTeam ?? '');

  const copyAddress = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const save = (): void => {
    setSaving(true);
    setError(null);
    saveSettings({
      ...(username.trim() ? { username: username.trim() } : {}),
      ...(favoriteTeam ? { favoriteTeam } : {}),
    })
      .then(({ user: saved }) => onSaved(saved))
      .catch(() => setError("Couldn't save. Try again."))
      .finally(() => setSaving(false));
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-black bg-amber-200">
          <Image src="/images/logo-golden-ball.webp" alt="" width={40} height={27} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">
            {user.username || shortenAddress(user.walletAddress)}
          </p>
          <p className="text-xs font-medium text-black/60">
            Member since {memberSince(user.createdAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border-2 border-black bg-white/70 px-2 py-1 font-mono text-xs font-bold">
          {shortenAddress(user.walletAddress)}
        </span>
        <button
          className="rounded-lg border-2 border-black bg-white/70 px-2 py-1 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          onClick={() => void copyAddress()}
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
        <a
          href={`https://solscan.io/account/${user.walletAddress}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border-2 border-black bg-white/70 px-2 py-1 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          🔍 Solscan
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-bold">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            placeholder="Pick a name"
            className="rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-medium outline-none focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">
          Favorite team
          <select
            value={favoriteTeam}
            onChange={(e) => setFavoriteTeam(e.target.value)}
            className="rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-medium outline-none focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            <option value="">— pick a team —</option>
            {TEAM_NAMES.map((t) => (
              <option key={t} value={t}>
                {teamFlag(t) ?? ''} {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {dirty && (
        <button
          className="rounded-xl border-2 border-black bg-black px-4 py-2 text-sm font-bold text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'Saving…' : '💾 Save changes'}
        </button>
      )}
    </Card>
  );
}
