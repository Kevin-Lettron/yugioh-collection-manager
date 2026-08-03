"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
const generateToken = (payload) => {
    const secret = (0, env_1.getRequiredEnv)('JWT_SECRET');
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    // @ts-ignore - TypeScript has issues with jwt.sign return type
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    const secret = (0, env_1.getRequiredEnv)('JWT_SECRET');
    return jsonwebtoken_1.default.verify(token, secret);
};
exports.verifyToken = verifyToken;
