import { useCallback, useEffect, useRef } from "react";
import type { DependencyList } from "react";

export type IsCurrentRequest = () => boolean;

export function useAsyncRequestGuard(dependencies: DependencyList): () => IsCurrentRequest {
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;

    return () => {
      generationRef.current += 1;
    };
  }, dependencies);

  return useCallback(() => {
    const generation = ++generationRef.current;
    return () => generationRef.current === generation;
  }, []);
}
