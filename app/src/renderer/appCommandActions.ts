import type { ApplicationMenuCommand } from "../shared/ipc";

export type AppCommandActions = Record<ApplicationMenuCommand, () => void>;
