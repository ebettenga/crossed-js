module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'tsx', 'jsx'],
  testMatch: ['**/tests/**/*.test.[tj]s?(x)'],
  setupFiles: ['dotenv/config'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  maxWorkers: 1,
};
