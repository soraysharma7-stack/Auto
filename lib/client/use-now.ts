"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  const timer = setInterval(callback, 30_000);
  return () => clearInterval(timer);
}
const getSnapshot = () => Date.now();
const getServerSnapshot = () => 0;

/** A hydration-safe clock for online/expiry labels, refreshed every 30 seconds. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
