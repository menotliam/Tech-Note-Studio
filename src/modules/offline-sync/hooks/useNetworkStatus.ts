"use client";

import { useEffect, useState } from "react";

const networkStatusEventName = "tech-note-studio:network-status";

type NetworkStatusEvent = CustomEvent<{ isOnline: boolean }>;

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleNetworkStatus = (event: Event) => {
      setIsOnline((event as NetworkStatusEvent).detail.isOnline);
    };
    const probeNetwork = () => {
      void checkInternetReachability().then(setIsOnline);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(networkStatusEventName, handleNetworkStatus);
    probeNetwork();
    const interval = window.setInterval(probeNetwork, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(networkStatusEventName, handleNetworkStatus);
      window.clearInterval(interval);
    };
  }, []);

  return isOnline;
}

export function publishNetworkStatus(isOnline: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(networkStatusEventName, { detail: { isOnline } }));
  }
}

async function checkInternetReachability() {
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    await fetch("https://www.gstatic.com/generate_204", {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
