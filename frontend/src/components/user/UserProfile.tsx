import { shortenAddress } from '@/lib/utils';
import type { User } from '@/types/user';

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-black tracking-tight">
        {user.username ?? shortenAddress(user.walletAddress)}
      </h1>
      {user.favoriteTeam ? (
        <p className="text-sm font-medium text-black/60">Supports {user.favoriteTeam}</p>
      ) : null}
    </div>
  );
}
