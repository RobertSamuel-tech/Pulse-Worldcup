export class PulseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PulseError';
  }
}

export class TxLineAuthError extends PulseError {
  constructor(message: string) {
    super(message, 'TXLINE_AUTH_FAILED', 401);
    this.name = 'TxLineAuthError';
  }
}

export class PredictionConflictError extends PulseError {
  constructor() {
    super(
      'You already have an active prediction. Please wait for it to resolve.',
      'PREDICTION_CONFLICT',
      409,
    );
    this.name = 'PredictionConflictError';
  }
}

export class MatchNotLiveError extends PulseError {
  constructor(matchId: string) {
    super(`Match ${matchId} is not currently live.`, 'MATCH_NOT_LIVE', 400);
    this.name = 'MatchNotLiveError';
  }
}

export class UnauthorizedError extends PulseError {
  constructor(message = 'Authentication required.') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class WalletUnfundedError extends PulseError {
  constructor(address: string) {
    super(
      `Server wallet ${address} has no devnet SOL and the faucet is rate-limited. ` +
        `Send test SOL to it via https://faucet.solana.com, then retry.`,
      'WALLET_UNFUNDED',
      503,
    );
    this.name = 'WalletUnfundedError';
  }
}

export class NotFoundError extends PulseError {
  constructor(resource: string) {
    super(`${resource} not found.`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}
