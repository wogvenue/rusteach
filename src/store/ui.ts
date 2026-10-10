// Ephemeral UI state (not persisted): toasts and XP bursts. Render <Toaster/> once at the app root.
import { create } from 'zustand';
import type { ReactNode } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'achievement' | 'xp' | 'level';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  icon?: ReactNode; // emoji string or element
  duration?: number; // ms, default 3500
}

interface UiState {
  toasts: Toast[];
  push(t: Omit<Toast, 'id'>): number;
  dismiss(id: number): void;
}

let seq = 1;

export const useUi = create<UiState>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-5) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.duration ?? 3500);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUi.getState().push(t);

/** Small "+N XP" toast; call with the xp returned by store actions (no-op for 0). */
export function xpToast(amount: number, reason?: string) {
  if (amount > 0) toast({ kind: 'xp', title: `+${amount} XP`, description: reason, duration: 1800 });
}
