"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.getCurrentUser = getCurrentUser;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const db_1 = require("../../core/db");
const config_1 = require("../../core/config");
const errors_1 = require("../../core/errors");
// Helper to sign JWTs
function generateTokens(userId, email, name, sessionId) {
    const accessToken = jsonwebtoken_1.default.sign({ userId, email, name, sessionId }, config_1.config.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ sessionId, jti: (0, uuid_1.v4)() }, config_1.config.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
}
// 1. Register User
async function register(req, res, next) {
    try {
        const { name, email, password, deviceId, age } = req.body;
        // Check if email already registered
        const existingUser = await db_1.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new errors_1.ConflictError('Email is already registered', 'EMAIL_ALREADY_EXISTS');
        }
        // Hash password
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        // Create User, Profile and VerificationState in transaction
        const newUser = await db_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    passwordHash,
                    profile: {
                        create: {
                            age,
                            trustScore: 30, // Default base score
                            isIdentityVerified: false,
                            isPhoneVerified: false,
                            completedTripsCount: 0,
                        },
                    },
                    verification: {
                        create: {},
                    },
                    notificationPreference: {
                        create: {},
                    },
                },
                include: {
                    profile: true,
                    verification: true,
                },
            });
            return user;
        });
        // Create Session
        const activeDeviceId = deviceId || (0, uuid_1.v4)();
        const session = await db_1.prisma.session.create({
            data: {
                userId: newUser.id,
                deviceId: activeDeviceId,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip || req.socket.remoteAddress,
            },
        });
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(newUser.id, newUser.email, newUser.name, session.id);
        // Save refresh token to db
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await db_1.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                sessionId: session.id,
                expiresAt,
            },
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    profile: newUser.profile,
                    verification: newUser.verification,
                },
                accessToken,
                refreshToken,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// 2. Login User
async function login(req, res, next) {
    try {
        const { email, password, deviceId } = req.body;
        const user = await db_1.prisma.user.findUnique({
            where: { email },
            include: {
                profile: true,
                verification: true,
            },
        });
        if (!user || user.isDeleted) {
            throw new errors_1.UnauthorizedError('Email or password is incorrect', 'INVALID_CREDENTIALS');
        }
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new errors_1.UnauthorizedError('Email or password is incorrect', 'INVALID_CREDENTIALS');
        }
        const activeDeviceId = deviceId || (0, uuid_1.v4)();
        // Remove any stale session for this user/device combination
        await db_1.prisma.session.deleteMany({
            where: {
                userId: user.id,
                deviceId: activeDeviceId,
            },
        });
        // Create Session
        const session = await db_1.prisma.session.create({
            data: {
                userId: user.id,
                deviceId: activeDeviceId,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip || req.socket.remoteAddress,
            },
        });
        // Generate Tokens
        const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.name, session.id);
        // Save refresh token to db
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await db_1.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                sessionId: session.id,
                expiresAt,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    profile: user.profile,
                    verification: user.verification,
                },
                accessToken,
                refreshToken,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// 3. Refresh Tokens
async function refresh(req, res, next) {
    try {
        const { refreshToken: oldToken } = req.body;
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(oldToken, config_1.config.JWT_REFRESH_SECRET);
        }
        catch {
            throw new errors_1.UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
        }
        // Look up refresh token in database
        const dbToken = await db_1.prisma.refreshToken.findUnique({
            where: { token: oldToken },
            include: {
                session: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (!dbToken || dbToken.isRevoked || dbToken.expiresAt < new Date()) {
            throw new errors_1.UnauthorizedError('Refresh token is expired or revoked', 'REFRESH_TOKEN_EXPIRED');
        }
        // Revoke/Delete old refresh token (Strict rotation)
        await db_1.prisma.refreshToken.delete({
            where: { token: oldToken },
        });
        // Update Session last active status
        const session = await db_1.prisma.session.update({
            where: { id: dbToken.sessionId },
            data: { lastActiveAt: new Date() },
        });
        // Generate new token pair
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(dbToken.session.user.id, dbToken.session.user.email, dbToken.session.user.name, session.id);
        // Save new refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await db_1.prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                sessionId: session.id,
                expiresAt,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Tokens refreshed successfully',
            data: {
                accessToken,
                refreshToken: newRefreshToken,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// 4. Logout User
async function logout(req, res, next) {
    try {
        const sessionId = req.sessionId;
        if (!sessionId) {
            throw new errors_1.UnauthorizedError('Session identification missing', 'SESSION_MISSING');
        }
        // Cascade delete session and associated refresh tokens
        await db_1.prisma.session.delete({
            where: { id: sessionId },
        });
        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
            data: {},
        });
    }
    catch (err) {
        next(err);
    }
}
// 5. Get Current User (/me)
async function getCurrentUser(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('User credentials not found in request context', 'USER_MISSING');
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                verification: true,
            },
        });
        if (!user) {
            throw new errors_1.NotFoundError('User account not found', 'USER_NOT_FOUND');
        }
        res.status(200).json({
            success: true,
            message: 'Current user details retrieved',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    profile: user.profile,
                    verification: user.verification,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
}
