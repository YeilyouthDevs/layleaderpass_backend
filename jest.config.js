// jest.config.js
module.exports = {
    rootDir: '.',
    preset: 'ts-jest',
    testEnvironment: 'node',
    globalSetup: './jestGlobalSetup.ts',
    globalTeardown: './jestGlobalTeardown.ts',
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
};
