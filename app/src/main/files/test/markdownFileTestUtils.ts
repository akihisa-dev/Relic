import type { RealpathOperations } from "../paths";

export function createRealpathRaceOperations(options: {
  changingPath: string;
  safeRealPath: string;
  unsafeRealPath: string;
  workspacePath: string;
}): RealpathOperations {
  let changingPathChecks = 0;

  return {
    async realpath(filePath) {
      if (filePath === options.workspacePath) return options.workspacePath;
      if (filePath === options.changingPath) {
        changingPathChecks += 1;
        return changingPathChecks === 1
          ? options.safeRealPath
          : options.unsafeRealPath;
      }

      return filePath;
    }
  };
}
