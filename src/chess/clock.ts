import { useCallback, useEffect, useRef, useState } from "react";

export interface ClockState {
  white: number; // ms remaining
  black: number;
  activeSide: "w" | "b" | null;
  flag: "w" | "b" | null; // side that ran out
}

export interface UseClockOptions {
  enabled: boolean;
  initialMs: number;
  incrementMs: number;
  onFlag?: (side: "w" | "b") => void;
}

export function useClock({ enabled, initialMs, incrementMs, onFlag }: UseClockOptions) {
  const [state, setState] = useState<ClockState>({
    white: initialMs,
    black: initialMs,
    activeSide: null,
    flag: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onFlagRef = useRef(onFlag);
  onFlagRef.current = onFlag;

  // Tick loop.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setState((s) => {
        if (!s.activeSide || s.flag) return s;
        const delta = 100;
        if (s.activeSide === "w") {
          const next = Math.max(0, s.white - delta);
          if (next === 0 && s.white > 0) {
            onFlagRef.current?.("w");
            return { ...s, white: 0, activeSide: null, flag: "w" };
          }
          return { ...s, white: next };
        } else {
          const next = Math.max(0, s.black - delta);
          if (next === 0 && s.black > 0) {
            onFlagRef.current?.("b");
            return { ...s, black: 0, activeSide: null, flag: "b" };
          }
          return { ...s, black: next };
        }
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [enabled]);

  const reset = useCallback(
    (ms: number) => {
      setState({
        white: ms,
        black: ms,
        activeSide: null,
        flag: null,
      });
    },
    [],
  );

  const onMove = useCallback(
    (sideJustMoved: "w" | "b") => {
      if (!enabledRef.current) return;
      setState((s) => {
        if (s.flag) return s;
        // Add increment to side that just moved, then switch active side.
        const nextSide: "w" | "b" = sideJustMoved === "w" ? "b" : "w";
        return {
          ...s,
          white: sideJustMoved === "w" ? s.white + incrementMs : s.white,
          black: sideJustMoved === "b" ? s.black + incrementMs : s.black,
          activeSide: nextSide,
        };
      });
    },
    [incrementMs],
  );

  const pause = useCallback(() => {
    setState((s) => ({ ...s, activeSide: null }));
  }, []);

  return { state, reset, onMove, pause };
}

export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalSec < 20) {
    const tenth = Math.floor((ms % 1000) / 100);
    return `${min}:${sec.toString().padStart(2, "0")}.${tenth}`;
  }
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
