import type { RelicApi } from "../shared/ipc";

export interface RelicClient extends RelicApi {}

export type RelicClientProvider = () => RelicClient | undefined;

const windowRelicClientProvider: RelicClientProvider = () => (
  typeof window === "undefined" ? undefined : window.relic
);

let relicClientProvider = windowRelicClientProvider;

export const relicClient = {
  get current(): RelicClient | undefined {
    return relicClientProvider();
  }
};

export function installRelicClientProvider(provider: RelicClientProvider): () => void {
  const previousProvider = relicClientProvider;
  relicClientProvider = provider;

  return () => {
    relicClientProvider = previousProvider;
  };
}
