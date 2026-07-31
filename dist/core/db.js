"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
exports.prisma = new client_1.PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
    ],
});
exports.prisma.$on('query', (e) => {
    logger_1.logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, 'Prisma Query');
});
exports.prisma.$on('info', (e) => {
    logger_1.logger.info(e.message);
});
exports.prisma.$on('warn', (e) => {
    logger_1.logger.warn(e.message);
});
exports.prisma.$on('error', (e) => {
    logger_1.logger.error(e.message);
});
