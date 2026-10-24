// jest.config.ts

import { Config } from "jest";
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

  transform: {
    "^.+\\.(ts|js)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: false, // Keep as false since your tsconfig is commonjs
      },
    ],
  },

  // 🔑 Updated list to include @exodus and other jsdom dependencies
  transformIgnorePatterns: [
    "/node_modules/(?!(jsdom|parse5|entities|@exodus|bytes|html-encoding-sniffer|whatwg-url|data-uri-to-buffer|formdata-polyfill|fetch-blob|node-fetch|saxes)/)",
  ],

  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
};
export default config;