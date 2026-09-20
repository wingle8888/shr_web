export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
};

export function applySecurityHeaders(headers) {
  const out = headers instanceof Headers ? headers : new Headers(headers || {});
  Object.keys(SECURITY_HEADERS).forEach((key) => {
    if (!out.has(key)) out.set(key, SECURITY_HEADERS[key]);
  });
  return out;
}

export function withSecurityHeaders(response) {
  if (!response) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: applySecurityHeaders(response.headers),
  });
}

export default {
  CSP,
  SECURITY_HEADERS,
  applySecurityHeaders,
  withSecurityHeaders,
};
