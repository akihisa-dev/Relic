import { useEffect, useState } from "react";

import type { CardbookState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";

interface UseCardbookAliasesInput {
  setCardbookError: (message: string | null) => void;
  cardbookState: CardbookState | null;
}

export function useCardbookAliases({
  setCardbookError,
  cardbookState
}: UseCardbookAliasesInput): AliasIndex {
  const [aliasesByPath, setAliasesByPath] = useState<AliasIndex>({});

  useEffect(() => {
    if (!cardbookState?.activeCardbook || !window.relic) {
      setAliasesByPath({});
      return;
    }

    let canceled = false;

    void window.relic.getCardbookAliases().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setAliasesByPath(result.value);
      } else {
        setAliasesByPath({});
        setCardbookError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setCardbookError, cardbookState?.activeCardbook?.id, cardbookState?.cardTree]);

  return aliasesByPath;
}
