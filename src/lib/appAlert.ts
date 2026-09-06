import { useSyncExternalStore } from 'react';
import { i18n } from './i18n';

export type AppAlertKind = 'warning' | 'error' | 'info';

export interface AppAlertButton {
  text:     string;
  onPress?: () => void;
  style?:   'default' | 'cancel' | 'destructive';
}

export interface AppAlertRequest {
  kind:     AppAlertKind;
  title:    string;
  message?: string;
  buttons:  AppAlertButton[];
}

let current: AppAlertRequest | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

export function appAlert(kind: AppAlertKind, title: string, message?: string, buttons?: AppAlertButton[]) {
  current = {
    kind,
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: i18n.t('common.ok') }],
  };
  notify();
}

export function dismissAppAlert() {
  current = null;
  notify();
}

// Shared "applying this preset will overwrite your current settings" confirmation,
// used by every preset-apply flow (timing, speed, incline, spin) — skips the prompt
// entirely when there's nothing to overwrite.
export function confirmIfDirty(dirty: boolean, messageKey: string, apply: () => void): void {
  if (!dirty) {
    apply();
    return;
  }
  appAlert(
    'warning',
    i18n.t('alerts.overwriteTitle'),
    i18n.t(messageKey),
    [{ text: i18n.t('alerts.cancel'), style: 'cancel' }, { text: i18n.t('alerts.apply'), onPress: apply }],
  );
}

export function useAppAlert(): AppAlertRequest | null {
  return useSyncExternalStore(
    onChange => { listeners.add(onChange); return () => listeners.delete(onChange); },
    () => current,
  );
}
