import {isIP} from 'node:net';

export const DEFAULT_HOSTS = Object.freeze({
  publicClientHosts: ['payease.khmerx.org', 'payeas.khmerx.org', 'api.khmerx.org', 'admin.khmerx.org'],
  adminHosts: ['admin.khmerx.org'],
  apiHosts: ['api.khmerx.org'],
});

function list(value, fallback) {
  if (Array.isArray(value)) return value.map(String).map(x => x.trim().toLowerCase()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return [...fallback];
}

export function hostRules(config = {}) {
  return {
    publicClientHosts: list(config.publicClientHosts, DEFAULT_HOSTS.publicClientHosts),
    adminHosts: list(config.adminHosts, DEFAULT_HOSTS.adminHosts),
    apiHosts: list(config.apiHosts, DEFAULT_HOSTS.apiHosts),
  };
}

export function isAllowedHost(host, rules, privateHost = '') {
  const value = String(host || '').toLowerCase();
  return (privateHost && value === String(privateHost).toLowerCase()) ||
    rules.publicClientHosts.includes(value) || rules.adminHosts.includes(value) || rules.apiHosts.includes(value);
}

export function isPublicClientHost(host, rules) { return rules.publicClientHosts.includes(String(host || '').toLowerCase()); }
export function isAdminHost(host, rules) { return rules.adminHosts.includes(String(host || '').toLowerCase()); }
export function isApiHost(host, rules) { return rules.apiHosts.includes(String(host || '').toLowerCase()); }

function ipv4(value) {
  const parts = String(value || '').split('.');
  return parts.length === 4 && parts.every(part => /^\d+$/.test(part) && Number(part) <= 255) ? parts.map(Number) : null;
}

export function isTrustedProxyAddress(address) {
  const value = String(address || '').toLowerCase().replace(/^::ffff:/, '');
  if (value === '::1' || value === 'localhost') return true;
  const parts = ipv4(value);
  if (!parts) return value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
  const [a, b] = parts;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function resolveClientIp(remoteAddress, realIp) {
  const remote = String(remoteAddress || 'unknown').replace(/^::ffff:/, '');
  const candidate = String(realIp || '').split(',')[0].trim();
  // Only accept a syntactically valid address from a trusted proxy.  An
  // arbitrary header value must never become a rate-limit key.
  return isTrustedProxyAddress(remote) && candidate && isIP(candidate) ? candidate : remote;
}
