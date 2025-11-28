// Polyfills for jest-expo compatibility
// This file runs before jest-expo setup to ensure required globals exist

// Ensure window object exists
if (typeof window === 'undefined') {
  global.window = {};
}

// Ensure document object exists
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({}),
    createTextNode: () => ({}),
    getElementById: () => null,
  };
}

// Ensure navigator object exists
if (typeof navigator === 'undefined') {
  global.navigator = {
    userAgent: 'node.js',
    product: 'ReactNative',
  };
}

// Ensure location object exists
if (typeof location === 'undefined') {
  global.location = {
    href: '',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
  };
}

// Polyfill for requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
