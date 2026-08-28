// Shared path data for the run/circuit/spinning glyphs, drawn by both
// ActivityTypeIcon (session cards, headers) and FolderIcon (folder icon picker).
export interface ActivityIconShape {
  circles?: { cx: number; cy: number; r: number }[];
  paths: string[];
}

export const ACTIVITY_ICON_SHAPES: Record<'run' | 'walk' | 'circuit' | 'spinning' | 'tabata', ActivityIconShape> = {
  run: {
    circles: [{ cx: 15.5, cy: 4.6, r: 2.1 }],
    paths: [
      'M14.2 8.3 10 13.4l3.6 1.9.5 5',
      'M10 13.4 6.2 16.8 4 18.4',
      'M13.6 9.6l3.3 1.7 2.7-.6',
      'M16.9 11.3l-.4 3',
    ],
  },
  walk: {
    circles: [{ cx: 12.6, cy: 4.6, r: 2.1 }],
    paths: [
      'M12.4 8.3v5.4',
      'M12.4 13.7 9 19.5',
      'M12.4 13.7 15.8 18.6',
      'M12.4 10.2 9.3 13',
      'M12.4 10.2 16 11.6',
    ],
  },
  circuit: {
    paths: [
      'M3.2 9.5v5',
      'M6.4 7.2v9.6',
      'M6.4 12h11.2',
      'M17.6 7.2v9.6',
      'M20.8 9.5v5',
    ],
  },
  spinning: {
    circles: [{ cx: 6, cy: 16.4, r: 3.5 }, { cx: 18, cy: 16.4, r: 3.5 }],
    paths: [
      'M11 16.4 9 8.2M11 16.4 16 8.2M9 8.2h7M11 16.4H6M16 8.2l2 8.2',
      'M7.9 7.7h2.4',
      'M16 8.2V6.4M14.7 6.4h2.6',
    ],
  },
  // Repeating high/low interval pulses — the 20s-on / 10s-off Tabata rhythm.
  tabata: {
    paths: [
      'M4.5 5v14',
      'M9.5 9.5v5',
      'M14.5 5v14',
      'M19.5 9.5v5',
    ],
  },
};
