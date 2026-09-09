/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts', '**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          useDefineForClassFields: false,
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/tests/mocks/react-native.ts',
    '^@react-native-community/netinfo$': '<rootDir>/tests/mocks/netinfo.ts',
    '^react-native-serialport$': '<rootDir>/tests/mocks/serialport.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@nozbe/watermelondb|rxjs)/)',
  ],
};
