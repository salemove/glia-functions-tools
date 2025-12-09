export default {
  testEnvironment: 'node',
  // Don't use module name mapper for ES modules
  moduleNameMapper: {},
  transform: {},
  transformIgnorePatterns: [],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup/setupTests.js'],
  globalSetup: './jest-setup.js',

  // Disable coverage features that are causing issues with ES modules
  collectCoverage: false,
  coverageProvider: 'v8',
  // Explicitly disable the transform that's causing issues
  coverageReporters: ['text', 'lcov'],
  // Make sure Jest globals are available
  injectGlobals: true
};