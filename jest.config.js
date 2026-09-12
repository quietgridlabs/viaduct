export default {
  roots: ["<rootDir>/src"],
  // Nested agent worktrees carry their own copy of the suite and of
  // node_modules, so leaving them in scope runs every test twice against a
  // stale tree and a mismatched React.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/.claude/"],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  preset: "ts-jest",
  testEnvironment: "jsdom",
  verbose: true,
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  moduleNameMapper: {
    "^vitest$": "<rootDir>/src/test/vitest-jest-shim.ts",
    "^@app/(.*)$": "<rootDir>/src/app/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@entities/(.*)$": "<rootDir>/src/entities/$1",
    "^@features/(.*)$": "<rootDir>/src/features/$1",
    "^@widgets/(.*)$": "<rootDir>/src/widgets/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@assets/(.*)$": "<rootDir>/src/assets/$1",
    "^@contexts/(.*)$": "<rootDir>/src/contexts/$1",
    "^@data/(.*)$": "<rootDir>/src/data/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@icons/(.*)$": "<rootDir>/src/icons/$1",
    "^@locales/(.*)$": "<rootDir>/src/locales/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@plugins/(.*)$": "<rootDir>/src/plugins/$1",
    "^@slots/(.*)$": "<rootDir>/src/slots/$1",
    "^@theme/(.*)$": "<rootDir>/src/theme/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    ".+\\.(css|less|sass|scss|png|jpg|gif|ttf|woff|woff2|svg)$":
      "jest-transform-stub",
    "^.+\\.(ts|tsx)$": [`ts-jest`, { tsconfig: 'tsconfig.app.json' }]
  },
};
