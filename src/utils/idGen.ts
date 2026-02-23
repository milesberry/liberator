// Unique ID generator — uses the Web Crypto API (available in all modern browsers)
export function newId(): string {
  return crypto.randomUUID();
}

// Short prefix for TypeVar scoping: first 6 chars of a UUID
export function shortId(): string {
  return crypto.randomUUID().slice(0, 6);
}
