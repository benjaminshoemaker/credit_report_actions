import '@testing-library/jest-dom';

// Ensure crypto.randomUUID exists in JSDOM to keep IDs deterministic/stable
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error allow polyfill for test env
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = () => '00000000-0000-4000-8000-000000000000';
}

export {};
