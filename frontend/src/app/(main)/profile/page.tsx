'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { UserProfileCard } from '@/components/user/UserProfileCard';
import { StatisticsOverview } from '@/components/user/StatisticsOverview';
import { IntuitionProfileChart } from '@/components/user/IntuitionProfileChart';
import { PredictionHistoryList } from '@/components/user/PredictionHistoryList';
import { AchievementBadgesGrid } from '@/components/user/AchievementBadgesGrid';
import { ScratchHistoryList } from '@/components/scratch/ScratchHistoryList';
import { WalletSettingsPanel } from '@/components/user/WalletSettingsPanel';
import { getSession } from '@/lib/auth-api';
import {
  getAchievements,
  getIntuition,
  getProfile,
  type Achievement,
  type IntuitionStats,
  type ProfileBundle,
} from '@/lib/profile-api';

function SectionSkeleton({ height }: { height: string }) {
  return (
    <div
      className={`w-full animate-pulse rounded-xl border-4 border-black/20 bg-white/50 ${height}`}
    />
  );
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function Section({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <ErrorBoundary
        fallback={
          <p className="rounded-xl border-2 border-dashed border-black bg-white/50 p-4 text-sm font-bold">
            This section hit a snag — refresh to retry.
          </p>
        }
      >
        {children}
      </ErrorBoundary>
    </motion.div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileBundle | null>(null);
  const [intuition, setIntuition] = useState<IntuitionStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Auth guard: profile is meaningless signed out.
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    // Parallel fetches — each section renders as its data lands.
    getProfile().then(setProfile).catch(() => setError(true));
    getIntuition().then(setIntuition).catch(() => undefined);
    getAchievements()
      .then(({ achievements: a }) => setAchievements(a))
      .catch(() => undefined);
  }, [router]);

  if (error) {
    return (
      <section className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="rounded-xl border-2 border-black bg-red-300 px-4 py-3 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          Couldn&apos;t load your profile. Pull to refresh or try again shortly.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-4">
      <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Profile</h1>

      <Section index={0}>
        {profile ? (
          <UserProfileCard
            profile={profile}
            onSaved={(user) =>
              setProfile((p) => (p ? { ...p, user: { ...p.user, ...user } } : p))
            }
          />
        ) : (
          <SectionSkeleton height="h-56" />
        )}
      </Section>

      <Section index={1}>
        {profile ? <StatisticsOverview stats={profile.stats} /> : <SectionSkeleton height="h-24" />}
      </Section>

      <Section index={2}>
        {intuition ? (
          <IntuitionProfileChart intuition={intuition} />
        ) : (
          <SectionSkeleton height="h-80" />
        )}
      </Section>

      <Section index={3}>
        <PredictionHistoryList />
      </Section>

      <Section index={4}>
        <ScratchHistoryList />
      </Section>

      <Section index={5}>
        {achievements ? (
          <AchievementBadgesGrid achievements={achievements} />
        ) : (
          <SectionSkeleton height="h-40" />
        )}
      </Section>

      <Section index={6}>
        {profile ? (
          <WalletSettingsPanel walletAddress={profile.user.walletAddress} />
        ) : (
          <SectionSkeleton height="h-64" />
        )}
      </Section>
    </section>
  );
}
