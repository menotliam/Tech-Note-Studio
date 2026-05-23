"use client";

import { Cloud, CloudOff } from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export function NetworkStatusIndicator() {
  const isOnline = useNetworkStatus();

  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      {isOnline ? <Cloud size={15} className="text-primary" /> : <CloudOff size={15} className="text-red-600" />}
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
