type IpcSenderAuthorization = (sender: unknown) => boolean;

let authorizeIpcSender: IpcSenderAuthorization = () => false;

export function configureIpcSenderAuthorization(
  authorization: IpcSenderAuthorization
): void {
  authorizeIpcSender = authorization;
}

export function isAuthorizedIpcSender(sender: unknown): boolean {
  try {
    return authorizeIpcSender(sender);
  } catch {
    return false;
  }
}
