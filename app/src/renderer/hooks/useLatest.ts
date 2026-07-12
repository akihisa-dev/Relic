import { useLayoutEffect, useRef } from "react";

export function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
