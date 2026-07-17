import { create } from 'zustand';

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'achievement';
  message: string;
}

interface UIState {
  connectionState: ConnectionState;
  toasts: ToastMessage[];
  activeModal: string | null;
  soundEnabled: boolean;
  hapticsEnabled: boolean;

  setConnectionState: (state: ConnectionState) => void;
  showToast: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: string) => void;
  openModal: (name: string) => void;
  closeModal: () => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  connectionState: 'connected',
  toasts: [],
  activeModal: null,
  soundEnabled: true,
  hapticsEnabled: true,

  setConnectionState: (connectionState) => set({ connectionState }),
  showToast: (type, message) =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), type, message }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
}));
