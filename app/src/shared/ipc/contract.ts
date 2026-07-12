export type IpcTransport = "invoke" | "local" | "send" | "subscribe";
export type MainIpcRegistration = "handle" | "lifecycle" | "none" | "on" | "sender";

export interface IpcMethodContract {
  channel: string | null;
  main: MainIpcRegistration;
  transport: IpcTransport;
  validatesInput: boolean;
}

export type IpcFeatureContract = Record<string, IpcMethodContract>;
