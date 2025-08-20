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
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/server.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 10000,
  verbose: true,
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.test.json",
    },
  },
};
