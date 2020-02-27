"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = Number(process.env.PORT) || 9000;
exports.NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
exports.GQL_MAX_COST = Number(process.env.GQL_MAX_COST) || 1000;
// Arranger configs
exports.ARRANGER_ROOT = process.env.ARRANGER_ROOT || 'http://localhost:5050';
exports.ARRANGER_PROJECT_ID = process.env.ARRANGER_PROJECT_ID || 'test';
// Ego config
exports.EGO_ROOT_REST = process.env.EGO_ROOT_REST || 'http://localhost:8081';
exports.EGO_ROOT_GRPC = process.env.EGO_ROOT_GRPC || 'localhost:50051';
exports.EGO_JWT_SECRET = process.env.EGO_JWT_SECRET;
// Default ego public key value is the example value provided in the application.yml of the public overture repository
exports.EGO_PUBLIC_KEY = process.env.EGO_PUBLIC_KEY ||
    `-----BEGIN PUBLIC KEY-----\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0lOqMuPLCVusc6szklNXQL1FHhSkEgR7An+8BllBqTsRHM4bRYosseGFCbYPn8r8FsWuMDtxp0CwTyMQR2PCbJ740DdpbE1KC6jAfZxqcBete7gP0tooJtbvnA6X4vNpG4ukhtUoN9DzNOO0eqMU0Rgyy5HjERdYEWkwTNB30i9I+nHFOSj4MGLBSxNlnuo3keeomCRgtimCx+L/K3HNo0QHTG1J7RzLVAchfQT0lu3pUJ8kB+UM6/6NG+fVyysJyRZ9gadsr4gvHHckw8oUBp2tHvqBEkEdY+rt1Mf5jppt7JUV7HAPLB/qR5jhALY2FX/8MN+lPLmb/nLQQichVQIDAQAB\r\n-----END PUBLIC KEY-----`;
// Program Service config
exports.PROGRAM_SERVICE_ROOT = process.env.PROGRAM_SERVICE_ROOT || 'localhost:50052';
exports.CLINICAL_SERVICE_ROOT = process.env.CLINICAL_SERVICE_ROOT || 'http://localhost:3000';
exports.SUBMISSION_TEMPLATE_PATH = process.env.SUBMISSION_TEMPLATE_PATH || '/submission/schema/template/';
exports.KAFKA_REST_PROXY_ROOT = process.env.KAFKA_REST_PROXY_ROOT || 'http://localhost:8085';
//# sourceMappingURL=config.js.map