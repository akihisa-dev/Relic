const baseRendererCspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' file: data:",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
];

export const packagedRendererContentSecurityPolicy = [
  ...baseRendererCspDirectives,
  "connect-src 'self'"
].join("; ");

export const developmentRendererContentSecurityPolicy = [
  ...baseRendererCspDirectives,
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
].join("; ");

export function rendererContentSecurityPolicy(isDevelopment: boolean): string {
  return isDevelopment
    ? developmentRendererContentSecurityPolicy
    : packagedRendererContentSecurityPolicy;
}
