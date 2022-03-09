module.exports = {
    transform: {
        ".+\\.ts$": "ts-jest",
    },
    testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|js)$",
    moduleFileExtensions: ["ts", "js"],
    setupFilesAfterEnv: ["./source/setupTests.ts"],
};