import { useLayoutEffect, useState } from "react";

export function useStableTimelineBounds(
  computedBounds: { axisEnd: number; axisStart: number },
  key: string
): { axisEnd: number; axisStart: number } {
  const [stable, setStable] = useState<{ bounds: { axisEnd: number; axisStart: number }; key: string } | null>(null);

  useLayoutEffect(() => {
    setStable((current) => {
      if (!current || current.key !== key) {
        return { bounds: computedBounds, key };
      }

      const nextBounds = {
        axisEnd: Math.max(current.bounds.axisEnd, computedBounds.axisEnd),
        axisStart: Math.min(current.bounds.axisStart, computedBounds.axisStart)
      };

      if (
        nextBounds.axisEnd === current.bounds.axisEnd &&
        nextBounds.axisStart === current.bounds.axisStart
      ) {
        return current;
      }

      return { bounds: nextBounds, key };
    });
  }, [computedBounds.axisEnd, computedBounds.axisStart, key]);

  if (!stable || stable.key !== key) return computedBounds;

  return stable.bounds;
}
