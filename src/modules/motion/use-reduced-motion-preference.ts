"use client";

import { useEffect, useState } from "react";
import { shouldReduceMotion, type ReducedMotionPreference } from "@/modules/ui/ui.motion";

export const reducedMotionStorageKey = "technote.reducedMotion";
export const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

export function useReducedMotionPreference(preference: ReducedMotionPreference) {
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(reducedMotionMediaQuery);
    const update = () => setSystemPrefersReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return shouldReduceMotion(preference, systemPrefersReducedMotion);
}

export function persistReducedMotionPreference(preference: ReducedMotionPreference) {
  try {
    window.localStorage.setItem(reducedMotionStorageKey, preference);
  } catch {
    // Motion preference should still apply for the current session.
  }
}

export function applyReducedMotionAttribute(preference: ReducedMotionPreference, systemPrefersReducedMotion: boolean) {
  document.documentElement.dataset.reducedMotion = shouldReduceMotion(preference, systemPrefersReducedMotion)
    ? "true"
    : "false";
}

