import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

type UnexpectedConsoleMessage = {
  arguments: unknown[];
  level: "error" | "warn";
};

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const unexpectedConsoleMessages: UnexpectedConsoleMessage[] = [];

console.error = (...arguments_: unknown[]): void => {
  unexpectedConsoleMessages.push({ arguments: arguments_, level: "error" });
  originalConsoleError(...arguments_);
};
console.warn = (...arguments_: unknown[]): void => {
  unexpectedConsoleMessages.push({ arguments: arguments_, level: "warn" });
  originalConsoleWarn(...arguments_);
};

afterEach(() => {
  const messages = unexpectedConsoleMessages.splice(0);
  if (messages.length === 0) return;
  const details = messages.map(({ arguments: arguments_, level }) => (
    `${level}: ${arguments_.map((value) => value instanceof Error ? value.stack ?? value.message : String(value)).join(" ")}`
  ));
  throw new Error(`Unexpected renderer console output:\n${details.join("\n")}`);
});

if (typeof SVGElement !== "undefined" && !("getComputedTextLength" in SVGElement.prototype)) {
  Object.defineProperty(SVGElement.prototype, "getComputedTextLength", {
    configurable: true,
    value(this: SVGElement): number {
      return (this.textContent ?? "").length * 8;
    }
  });
}
if (typeof SVGElement !== "undefined" && !("getBBox" in SVGElement.prototype)) {
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value(this: SVGElement): DOMRect {
      return new DOMRect(0, 0, (this.textContent ?? "").length * 8, 16);
    }
  });
}

if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}

if (typeof Range !== "undefined" && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top: 0,
    width: 0,
    x: 0,
    y: 0
  });
}
