/// <reference types="jest" />
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Increase timeout for database operations
jest.setTimeout(10000);

export {};
