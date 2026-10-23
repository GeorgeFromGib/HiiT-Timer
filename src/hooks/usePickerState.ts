import { useState } from 'react';
import { type PickerColumn, type PickerSpec } from './pickerShapes';

export { MIN_TARGET_DURATION_MINUTES, MAX_TARGET_DURATION_MINUTES, type PickerColumn } from './pickerShapes';

export interface EditSessionPicker {
  title:      string;
  columns:    PickerColumn[];
  separator?: string;
  selected:   number[]; // current wheel index per column, used to seed the modal
}

export interface PickerValues {
  selected: number[];
}

/** Holds at most one open picker; `openPicker(null)` is a no-op so callers can pass a lookup that missed. */
export function usePickerState() {
  const [active, setActive] = useState<{ spec: PickerSpec; selected: number[] } | null>(null);

  const picker: EditSessionPicker | null = active ? {
    title:     active.spec.title,
    columns:   active.spec.shape.columns(),
    separator: active.spec.shape.separator,
    selected:  active.selected,
  } : null;

  function openPicker(spec: PickerSpec | null) {
    if (spec) setActive({ spec, selected: spec.shape.encode(spec.current) });
  }

  function commitPicker(values: PickerValues) {
    if (!active) return;
    active.spec.onCommit(active.spec.shape.decode(values.selected));
    setActive(null);
  }

  return { picker, openPicker, commitPicker, dismissPicker: () => setActive(null) };
}
