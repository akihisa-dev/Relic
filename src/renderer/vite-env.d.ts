/// <reference types="vite/client" />

import type { RelicApi } from "../shared/ipc";

declare global {
  interface Window {
    relic?: RelicApi;
  }
}
