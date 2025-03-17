export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(@inquirer|commander|chalk))'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli/index.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup/setupTests.js'],
};
