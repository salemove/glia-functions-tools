// Global setup - any initialization that should run before Jest
export default async () => {
  console.log('Setting up test environment...');
  
  // Fixes for ES modules in tests
  if (typeof globalThis.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = await import('util');
    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;
  }
  
  console.log('Test environment setup complete.');
};