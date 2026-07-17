import { startLeaderboardCacheWarmer } from '../services/leaderboard.service';

/**
 * Keeps the top-100 leaderboard cache warm (recompute every 60s) so reads are
 * always instant. Resolution events also invalidate the cache immediately.
 */
export function startLeaderboardWorker(): void {
  startLeaderboardCacheWarmer();
}
