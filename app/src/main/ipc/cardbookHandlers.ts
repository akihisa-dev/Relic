import { registerCardbookDataHandlers } from "./cardbookDataHandlers";
import { registerCardbookPreferenceHandlers } from "./cardbookPreferenceHandlers";
import { registerCardbookRegistrationHandlers } from "./cardbookRegistrationHandlers";

export { buildCardbookState } from "./cardbookState";

export function registerCardbookHandlers(): void {
  registerCardbookRegistrationHandlers();
  registerCardbookDataHandlers();
  registerCardbookPreferenceHandlers();
}
