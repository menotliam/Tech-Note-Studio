export const layoutStorageKey = "tech-note-studio.layout.v0.3";

export const panelWidthLimits = {
  explorerWidth: {
    min: 220,
    max: 420,
    defaultValue: 288
  },
  secondaryPanelWidth: {
    min: 220,
    max: 360,
    defaultValue: 256
  }
} as const;

export function clampPanelWidth(key: keyof typeof panelWidthLimits, width: number) {
  const limits = panelWidthLimits[key];

  if (!Number.isFinite(width)) {
    return limits.defaultValue;
  }

  return Math.min(limits.max, Math.max(limits.min, Math.round(width)));
}

