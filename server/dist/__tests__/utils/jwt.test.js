"use strict";
/// <reference types="jest" />
/**
 * Unit tests for JWT utility functions
 * Tests token generation and verification
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_1 = require("../../utils/jwt");
// Store original env value
const originalJwtSecret = process.env.JWT_SECRET;
describe('JWT Utilities', () => {
    // Mock payload
    const mockPayload = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
    };
    beforeEach(() => {
        // Set test JWT secret
        process.env.JWT_SECRET = 'test_secret_key';
    });
    afterEach(() => {
        // Restore original secret
        process.env.JWT_SECRET = originalJwtSecret;
    });
    describe('generateToken', () => {
        it('should generate a valid JWT token', () => {
            const token = (0, jwt_1.generateToken)(mockPayload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        });
        it('should include user data in token payload', () => {
            const token = (0, jwt_1.generateToken)(mockPayload);
            const decoded = jsonwebtoken_1.default.decode(token);
            expect(decoded.id).toBe(mockPayload.id);
            expect(decoded.email).toBe(mockPayload.email);
            expect(decoded.username).toBe(mockPayload.username);
        });
        it('should set expiration time', () => {
            const token = (0, jwt_1.generateToken)(mockPayload);
            const decoded = jsonwebtoken_1.default.decode(token);
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
            // Check that expiration is approximately 7 days from now
            const sevenDaysInSeconds = 7 * 24 * 60 * 60;
            const expiresIn = decoded.exp - decoded.iat;
            expect(expiresIn).toBe(sevenDaysInSeconds);
        });
        it('should generate different tokens for different payloads', () => {
            const payload1 = { id: 1, email: 'user1@example.com', username: 'user1' };
            const payload2 = { id: 2, email: 'user2@example.com', username: 'user2' };
            const token1 = (0, jwt_1.generateToken)(payload1);
            const token2 = (0, jwt_1.generateToken)(payload2);
            expect(token1).not.toBe(token2);
        });
        it('should use fallback secret when JWT_SECRET not set', () => {
            delete process.env.JWT_SECRET;
            const token = (0, jwt_1.generateToken)(mockPayload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });
        it('should generate verifiable token', () => {
            const token = (0, jwt_1.generateToken)(mockPayload);
            // This should not throw
            const verified = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
            expect(verified).toBeDefined();
        });
    });
    describe('verifyToken', () => {
        it('should verify and decode a valid token', () => {
            const token = (0, jwt_1.generateToken)(mockPayload);
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.id).toBe(mockPayload.id);
            expect(decoded.email).toBe(mockPayload.email);
            expect(decoded.username).toBe(mockPayload.username);
        });
        it('should throw error for invalid token', () => {
            const invalidToken = 'invalid.token.here';
            expect(() => (0, jwt_1.verifyToken)(invalidToken)).toThrow();
        });
        it('should throw error for expired token', () => {
            // Create a token that expires immediately
            const expiredToken = jsonwebtoken_1.default.sign(mockPayload, process.env.JWT_SECRET || 'test', { expiresIn: '-1s' });
            expect(() => (0, jwt_1.verifyToken)(expiredToken)).toThrow();
        });
        it('should throw error for token signed with different secret', () => {
            const tokenWithDifferentSecret = jsonwebtoken_1.default.sign(mockPayload, 'different_secret', { expiresIn: '7d' });
            expect(() => (0, jwt_1.verifyToken)(tokenWithDifferentSecret)).toThrow();
        });
        it('should throw error for malformed token', () => {
            expect(() => (0, jwt_1.verifyToken)('not-a-valid-jwt')).toThrow();
        });
        it('should throw error for empty token', () => {
            expect(() => (0, jwt_1.verifyToken)('')).toThrow();
        });
        it('should throw error for token with tampered payload', () => {
            const token = (0, jwt_1.generateToken)(mockPayload);
            const parts = token.split('.');
            // Tamper with the payload
            const tamperedPayload = Buffer.from(JSON.stringify({
                ...mockPayload,
                id: 999, // Changed ID
            })).toString('base64url');
            const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
            expect(() => (0, jwt_1.verifyToken)(tamperedToken)).toThrow();
        });
        it('should use fallback secret when JWT_SECRET not set', () => {
            // First generate token with fallback secret
            delete process.env.JWT_SECRET;
            const token = (0, jwt_1.generateToken)(mockPayload);
            // Then verify with same fallback
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.id).toBe(mockPayload.id);
        });
    });
    describe('generateToken and verifyToken integration', () => {
        it('should work together for valid authentication flow', () => {
            // Simulate login
            const user = { id: 42, email: 'user@example.com', username: 'realuser' };
            const token = (0, jwt_1.generateToken)(user);
            // Simulate request with token
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.id).toBe(user.id);
            expect(decoded.email).toBe(user.email);
            expect(decoded.username).toBe(user.username);
        });
        it('should maintain data integrity', () => {
            const originalPayload = {
                id: 123,
                email: 'integrity@test.com',
                username: 'integrityuser',
            };
            const token = (0, jwt_1.generateToken)(originalPayload);
            const decoded = (0, jwt_1.verifyToken)(token);
            // Verify all fields are preserved
            expect(decoded.id).toBe(originalPayload.id);
            expect(decoded.email).toBe(originalPayload.email);
            expect(decoded.username).toBe(originalPayload.username);
        });
        it('should work with special characters in payload', () => {
            const payloadWithSpecialChars = {
                id: 1,
                email: "user+test@example.com",
                username: "user_with-special.chars",
            };
            const token = (0, jwt_1.generateToken)(payloadWithSpecialChars);
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.email).toBe(payloadWithSpecialChars.email);
            expect(decoded.username).toBe(payloadWithSpecialChars.username);
        });
        it('should work with unicode characters', () => {
            const payloadWithUnicode = {
                id: 1,
                email: "user@example.com",
                username: "user_with_unicode",
            };
            const token = (0, jwt_1.generateToken)(payloadWithUnicode);
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.username).toBe(payloadWithUnicode.username);
        });
    });
    describe('edge cases', () => {
        it('should handle very long usernames', () => {
            const longUsername = 'a'.repeat(1000);
            const payload = {
                id: 1,
                email: 'test@example.com',
                username: longUsername,
            };
            const token = (0, jwt_1.generateToken)(payload);
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.username).toBe(longUsername);
        });
        it('should handle numeric email-like strings', () => {
            const payload = {
                id: 12345,
                email: '12345@domain.com',
                username: '12345user',
            };
            const token = (0, jwt_1.generateToken)(payload);
            const decoded = (0, jwt_1.verifyToken)(token);
            expect(decoded.id).toBe(12345);
            expect(decoded.email).toBe('12345@domain.com');
        });
        it('should preserve exact ID values', () => {
            const ids = [0, 1, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
            for (const id of ids) {
                const payload = { id, email: 'test@test.com', username: 'user' };
                const token = (0, jwt_1.generateToken)(payload);
                const decoded = (0, jwt_1.verifyToken)(token);
                expect(decoded.id).toBe(id);
            }
        });
    });
});
