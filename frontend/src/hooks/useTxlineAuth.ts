'use client';

import { useCallback, useState } from 'react';

export interface TxlineAuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
}

/**
 * Handles the wallet-signature login against our backend, which in turn
 * manages TxLINE guest session + on-chain subscription + API token server-side.
 * TODO(Step: auth flow): implement nonce → sign → verify → JWT flow.
 */
export function useTxlineAuth() {
  const [state, setState] = useState<TxlineAuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    error: null,
  });

  const login = useCallback(async () => {
    setState((s) => ({ ...s, isAuthenticating: true, error: null }));
    // TODO: wallet signMessage + POST /api/auth/login
    setState({ isAuthenticated: false, isAuthenticating: false, error: 'Not implemented yet' });
  }, []);

  const logout = useCallback(() => {
    setState({ isAuthenticated: false, isAuthenticating: false, error: null });
  }, []);

  return { ...state, login, logout };
}
