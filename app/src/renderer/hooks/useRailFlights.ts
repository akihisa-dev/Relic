import { useCallback, useEffect, useRef, useState } from "react";

export interface RailTabFlight {
  direction: "open" | "close";
  fromX: number;
  fromY: number;
  label: string;
  toX: number;
  toY: number;
}

export interface SidebarCreateFlight {
  fromX: number;
  fromY: number;
  label: string;
  toX: number;
  toY: number;
}

export function useRailFlights(): {
  clearRailTabFlight: () => void;
  railTabFlight: RailTabFlight | null;
  showRailTabFlight: (flight: RailTabFlight, duration?: number) => void;
  showSidebarCreateFlight: (flight: SidebarCreateFlight, duration?: number) => void;
  sidebarCreateFlight: SidebarCreateFlight | null;
} {
  const [railTabFlight, setRailTabFlight] = useState<RailTabFlight | null>(null);
  const [sidebarCreateFlight, setSidebarCreateFlight] = useState<SidebarCreateFlight | null>(null);
  const railTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showRailTabFlight = useCallback((flight: RailTabFlight, duration = 360): void => {
    if (railTimerRef.current) clearTimeout(railTimerRef.current);
    setRailTabFlight(flight);
    railTimerRef.current = setTimeout(() => {
      setRailTabFlight(null);
      railTimerRef.current = null;
    }, duration);
  }, []);

  const showSidebarCreateFlight = useCallback((flight: SidebarCreateFlight, duration = 300): void => {
    if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current);
    setSidebarCreateFlight(flight);
    sidebarTimerRef.current = setTimeout(() => {
      setSidebarCreateFlight(null);
      sidebarTimerRef.current = null;
    }, duration);
  }, []);

  const clearRailTabFlight = useCallback((): void => {
    if (railTimerRef.current) {
      clearTimeout(railTimerRef.current);
      railTimerRef.current = null;
    }
    setRailTabFlight(null);
  }, []);

  useEffect(() => {
    return () => {
      const railTimer = railTimerRef.current;
      const sidebarTimer = sidebarTimerRef.current;
      if (railTimer) clearTimeout(railTimer);
      if (sidebarTimer) clearTimeout(sidebarTimer);
    };
  }, []);

  return {
    clearRailTabFlight,
    railTabFlight,
    showRailTabFlight,
    showSidebarCreateFlight,
    sidebarCreateFlight
  };
}
