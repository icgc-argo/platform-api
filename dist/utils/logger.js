"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importStar(require("winston"));
const { combine, timestamp, colorize, prettyPrint, json, printf } = winston_1.format;
const logger = winston_1.default.createLogger({
    format: combine(timestamp(), printf(info => `${info.timestamp} ${info.level}: ${info.message}`)),
    transports: [
        new winston_1.transports.Console({
            level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
        }),
        new winston_1.transports.File({ filename: 'debug.log', level: 'debug' }),
    ],
});
exports.default = logger;
//# sourceMappingURL=logger.js.map