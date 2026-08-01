/// <reference types="jest" />

// Environnement de test inline. Aucun fichier .env.test versionne — les valeurs
// ci-dessous sont non-secretes (DB locale de test, JWT bidon documente comme tel).
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5001';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'yugioh_collection_test';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only_do_not_use_in_production';
process.env.JWT_EXPIRES_IN = '1h';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads_test';
process.env.MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '5242880';
process.env.YGOPRODECK_API_URL =
  process.env.YGOPRODECK_API_URL || 'https://db.ygoprodeck.com/api/v7';

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
