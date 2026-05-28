export const motionDurations = {
  instant: 0,
  fast: 0.12,
  base: 0.18,
  slow: 0.28
} as const;

export const motionEasings = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.16, 1, 0.3, 1]
} as const;

export const motionPresets = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: motionDurations.base, ease: motionEasings.standard }
  },
  panel: {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
    transition: { duration: motionDurations.base, ease: motionEasings.emphasized }
  },
  popover: {
    initial: { opacity: 0, y: -4, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -4, scale: 0.98 },
    transition: { duration: motionDurations.fast, ease: motionEasings.standard }
  }
} as const;

export type ReducedMotionPreference = "system" | "on" | "off";

export function shouldReduceMotion(preference: ReducedMotionPreference, systemPrefersReducedMotion: boolean) {
  return preference === "on" || (preference === "system" && systemPrefersReducedMotion);
}

