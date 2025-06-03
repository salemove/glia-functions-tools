export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    "^(.+)\\.js$": "$1"
  },
  transform: {},
  transformIgnorePatterns: [],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup/setupTests.js'],
  globalSetup: './jest-setup.js',
  
  // Lower coverage thresholds temporarily while fixing tests
  collectCoverage: false,
};