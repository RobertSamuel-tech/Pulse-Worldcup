'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { IntuitionStats } from '@/lib/profile-api';

/** Rough global baselines per event type (until we aggregate real ones). */
const GLOBAL_AVERAGES = { goals: 52, cards: 48, corners: 55, calm: 61 };

const SKILL_TITLES: Record<string, { title: string; emoji: string }> = {
  Goals: { title: 'GOAL WHISPERER', emoji: '⚽' },
  Cards: { title: 'CARD PROPHET', emoji: '🟨' },
  Corners: { title: 'CORNER ORACLE', emoji: '🚩' },
  Calm: { title: 'ZEN MASTER', emoji: '🧘' },
};

export function IntuitionProfileChart({ intuition }: { intuition: IntuitionStats }) {
  const p = intuition.intuitionProfile;
  const data = [
    { skill: 'Goals', you: p.goalAccuracy, avg: GLOBAL_AVERAGES.goals },
    { skill: 'Cards', you: p.cardAccuracy, avg: GLOBAL_AVERAGES.cards },
    { skill: 'Corners', you: p.cornerAccuracy, avg: GLOBAL_AVERAGES.corners },
    { skill: 'Calm', you: p.calmAccuracy, avg: GLOBAL_AVERAGES.calm },
  ];

  const played = data.filter((d) => d.you > 0);
  const strongest = played.length
    ? played.reduce((a, b) => (b.you - b.avg > a.you - a.avg ? b : a))
    : null;
  const insight =
    strongest && SKILL_TITLES[strongest.skill]
      ? `${SKILL_TITLES[strongest.skill]!.emoji} You're a ${SKILL_TITLES[strongest.skill]!.title}! (${Math.round(strongest.you)}% vs ${strongest.avg}% avg)`
      : 'Make some predictions to reveal your intuition profile!';

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-sm font-black uppercase tracking-wide">Intuition Profile</h2>
      <div className="h-[300px] w-full md:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="rgba(0,0,0,0.25)" />
            <PolarAngleAxis
              dataKey="skill"
              tick={{ fill: '#0a0a0a', fontSize: 13, fontWeight: 700 }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Global avg"
              dataKey="avg"
              stroke="#64748B"
              strokeDasharray="5 4"
              strokeWidth={2}
              fill="#64748B"
              fillOpacity={0.08}
            />
            <Radar
              name="You"
              dataKey="you"
              stroke="#6366F1"
              strokeWidth={3}
              fill="#6366F1"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="rounded-xl border-2 border-black bg-indigo-400 px-3 py-2 text-center text-sm font-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {insight}
      </p>
      <p className="text-center text-xs font-medium text-black/50">
        Solid = you · Dashed = global average
      </p>
    </Card>
  );
}
