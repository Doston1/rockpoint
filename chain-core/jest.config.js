/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/server.ts",
    "!src/database/migrate.ts",
    "!src/database/reset.ts",
    "!src/database/seed.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 30000,
  verbose: true,
  testSequencer: "<rootDir>/tests/testSequencer.js",
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  forceExit: true,
  detectOpenHandles: true,
};
