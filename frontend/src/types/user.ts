export interface User {
  id: string;
  walletAddress: string;
  username?: string;
  favoriteTeam?: string;
  createdAt: Date;
}

export interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number; // 0-100
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  globalRank?: number;
}

export interface AchievementBadge {
  id: string;
  badgeType: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt?: Date;
  nftAddress?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string; // username or shortened wallet
  points: number;
  accuracy: number;
  bestStreak: number;
  isCurrentUser?: boolean;
}
