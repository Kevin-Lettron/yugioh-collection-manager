/** @type {import('jest').Config} */
export default {
  // Use jsdom environment for React testing
  testEnvironment: 'jsdom',

  // Setup files to run after Jest is initialized
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Module name mapping for path aliases (matching Vite config)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.js',
  },

  // Transform TypeScript and JSX files
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{ts,tsx}',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/__mocks__/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Transform ignore patterns - don't transform node_modules except specific packages
  transformIgnorePatterns: [
    'node_modules/(?!(axios|socket.io-client|react-hot-toast)/)',
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,
};
