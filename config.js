export const PORT = Number(process.env.PORT) || 9000;
export const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
export const GQL_MAX_COST = Number(process.env.GQL_MAX_COST) || 1000;

// Arranger configs
export const ARRANGER_ROOT = process.env.ARRANGER_ROOT || 'http://localhost:5050';
export const ARRANGER_PROJECT_ID = process.env.ARRANGER_PROJECT_ID || 'test';

// Ego config
export const EGO_ROOT_REST = process.env.EGO_ROOT_REST || 'http://localhost:8081';
export const EGO_ROOT_GRPC = process.env.EGO_ROOT_GRPC || 'localhost:50051';
export const EGO_JWT_SECRET = process.env.EGO_JWT_SECRET;

// Default ego public key value is the example value provided in the application.yml of the public overture repository
export const EGO_PUBLIC_KEY =
  process.env.EGO_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----\r\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0lOqMuPLCVusc6szklNXQL1FHhSkEgR7An+8BllBqTsRHM4bRYosseGFCbYPn8r8FsWuMDtxp0CwTyMQR2PCbJ740DdpbE1KC6jAfZxqcBete7gP0tooJtbvnA6X4vNpG4ukhtUoN9DzNOO0eqMU0Rgyy5HjERdYEWkwTNB30i9I+nHFOSj4MGLBSxNlnuo3keeomCRgtimCx+L/K3HNo0QHTG1J7RzLVAchfQT0lu3pUJ8kB+UM6/6NG+fVyysJyRZ9gadsr4gvHHckw8oUBp2tHvqBEkEdY+rt1Mf5jppt7JUV7HAPLB/qR5jhALY2FX/8MN+lPLmb/nLQQichVQIDAQAB\r\n-----END PUBLIC KEY-----`;

// Program Service config
export const PROGRAM_SERVICE_ROOT = process.env.PROGRAM_SERVICE_ROOT || 'localhost:50052';
export const CLINICAL_SERVICE_ROOT = process.env.CLINICAL_SERVICE_ROOT || 'http://localhost:3000';
export const SUBMISSION_TEMPLATE_PATH =
  process.env.SUBMISSION_TEMPLATE_PATH || '/submission/schema/template/';
