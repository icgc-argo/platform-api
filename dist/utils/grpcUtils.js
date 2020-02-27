"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grpc_1 = __importDefault(require("grpc"));
const retry_1 = __importDefault(require("retry"));
const camelCase_1 = __importDefault(require("lodash/camelCase"));
const transform_1 = __importDefault(require("lodash/transform"));
const isObject_1 = __importDefault(require("lodash/isObject"));
const isArray_1 = __importDefault(require("lodash/isArray"));
const keys_1 = __importDefault(require("lodash/keys"));
const has_1 = __importDefault(require("lodash/has"));
const logger_1 = __importDefault(require("./logger"));
/* When building gRPC requests we frequently need to provide a value as:
 * { value: "asdf" }
 */
exports.wrapValue = value => ({
    value,
});
exports.getAuthMeta = jwt => {
    const meta = new grpc_1.default.Metadata();
    if (jwt) {
        meta.add('jwt', jwt);
    }
    return meta;
};
exports.defaultPromiseCallback = (resolve, reject, serviceName) => (err, response) => {
    if (err) {
        logger_1.default.error(`GRPC error - ${serviceName}: ${err}`);
        reject(err);
    }
    resolve(response);
};
exports.getGrpcMethodsNames = grpcService => Object.getOwnPropertyNames(grpcService.__proto__).filter(name => !(name.search(/^\$/) > -1 || name === 'constructor'));
exports.withRetries = (grpcClient, retryConfig = {
    retries: 5,
    factor: 3,
    minTimeout: 1 * 1000,
    maxTimeout: 60 * 1000,
    randomize: true,
}, errorCodes = []) => {
    const STREAM_REMOVED_CODE = 2;
    const STREAM_REMOVED_DETAILS = 'Stream removed';
    const methodNames = exports.getGrpcMethodsNames(grpcClient).reduce(
    //converts to a hasmap for run-time performance
    (acc, methodName) => (Object.assign(Object.assign({}, acc), { [methodName]: methodName })), {});
    const methodWithRetry = (methodName, originalMethod) => (payload, metadata, cb) => {
        const operation = retry_1.default.operation(retryConfig);
        operation.attempt(currentAttempt => {
            originalMethod(payload, metadata, (err, response) => {
                if (err &&
                    err.code === STREAM_REMOVED_CODE &&
                    err.details === STREAM_REMOVED_DETAILS &&
                    operation.retry(err)) {
                    logger_1.default.warn(`grpc method ${methodName} failed with errorCode ${err.code}. Full error: ${err}. Retrying after ${currentAttempt} attempt(s).`);
                    return;
                }
                cb(err, response);
            });
        });
    };
    return new Proxy(grpcClient, {
        get: (client, methodName) => {
            const originalValue = client[methodName];
            if (typeof originalValue === 'function') {
                const originalMethod = originalValue.bind(client);
                if (methodNames[methodName]) {
                    return methodWithRetry(methodName, originalMethod);
                }
                else {
                    return originalMethod;
                }
            }
            else {
                return originalValue;
            }
        },
    });
};
// Convert nested grpc object to gql object. Make sure your gql definitions matches proto definitions
function grpcToGql(obj) {
    return transform_1.default(obj, (result, value, key) => {
        let v = value;
        // Unwrap value
        if (keys_1.default(value).length === 1 && has_1.default(value, 'value')) {
            v = value.value;
        }
        // Flatten timestamp
        v = timestampToDateTime(v);
        if (v instanceof Date) {
            result[camelCase_1.default(key)] = v;
            return;
        }
        // Convert key name to camelCase and recursively convert value
        result[camelCase_1.default(key)] = isObject_1.default(v) && !isArray_1.default(v) ? grpcToGql(v) : v;
    }, {});
}
exports.grpcToGql = grpcToGql;
// Convert a Timestamp object to ISO datetime string, or return the same one if it's not a Timestamp
function timestampToDateTime(maybeTimestamp) {
    const isTimestamp = keys_1.default(maybeTimestamp).length === 2 &&
        has_1.default(maybeTimestamp, 'seconds') &&
        has_1.default(maybeTimestamp, 'nanos');
    if (isTimestamp) {
        const { seconds, nanos } = maybeTimestamp;
        return new Date(seconds * 1000 + nanos / 1000000);
    }
    return maybeTimestamp;
}
//# sourceMappingURL=grpcUtils.js.map