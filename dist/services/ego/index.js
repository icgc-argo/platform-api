"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * This file dynamically generates a gRPC client from Ego.proto.
 * The content of Ego.proto is copied directly from: https://github.com/overture-stack/ego/blob/develop/src/main/proto/Ego.proto
 */
const grpc_1 = __importDefault(require("grpc"));
const loader = __importStar(require("@grpc/proto-loader"));
const config_1 = require("../../config");
const grpcUtils_1 = require("../../utils/grpcUtils");
const node_fetch_1 = __importDefault(require("node-fetch"));
const restUtils_1 = require("../../utils/restUtils");
const logger_1 = __importDefault(require("../../utils/logger"));
const memoize_1 = __importDefault(require("lodash/memoize"));
const url_join_1 = __importDefault(require("url-join"));
const PROTO_PATH = __dirname + '/Ego.proto';
const EGO_API_KEY_ENDPOINT = url_join_1.default(config_1.EGO_ROOT_REST, '/o/api_key');
const packageDefinition = loader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto = grpc_1.default.loadPackageDefinition(packageDefinition).bio.overture.ego.grpc;
const userService = grpcUtils_1.withRetries(new proto.UserService(config_1.EGO_ROOT_GRPC, grpc_1.default.credentials.createInsecure()));
let memoizedGetDacoIds = null;
let dacoIdsCalled = new Date();
const dacoGroupIdExpiry = 86400000; // 24hours
const getUser = (id, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        userService.getUser({ id }, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'Ego.getUser'));
    });
});
const listUsers = ({ pageNum, limit, sort, groups, query } = {}, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = {
        page: { page_number: pageNum, page_size: limit, sort },
        group_ids: groups,
        query: { value: query },
    };
    return yield new Promise((resolve, reject) => {
        userService.listUsers(payload, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'Ego.listUsers'));
    });
});
/**
 * @typedef {{ name: string; expiryDate: string; description: string; scope: string[], isRevoked: boolean, issueDate: string }} EgoAccessKeyObj
 * @param {string} userId
 * @param {string} Authorization
 * @returns {Promise<Array<EgoAccessKeyObj>>}
 */
const getEgoAccessKeys = (userId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const RESULT_SET_KEY = 'resultSet';
    const COUNT_KEY = 'count';
    const firstResponse = yield node_fetch_1.default(url_join_1.default(EGO_API_KEY_ENDPOINT, `?user_id=${userId}`), {
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    const totalCount = firstResponse[COUNT_KEY];
    const firstResults = firstResponse[RESULT_SET_KEY];
    const remainingPageIndex = firstResults.length;
    const remainingResponse = yield node_fetch_1.default(url_join_1.default(EGO_API_KEY_ENDPOINT, `?user_id=${userId}&limit=${totalCount - remainingPageIndex}&offset=${remainingPageIndex}`), {
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    const remainingResults = remainingResponse[RESULT_SET_KEY];
    return [...firstResults, ...remainingResults].filter(({ isRevoked }) => !isRevoked);
});
/**
 * @param {string} userId
 * @param {Array<string>} scopes
 * @param {string} Authorization
 * @returns {Promise<EgoAccessKeyObj>}
 */
const generateEgoAccessKey = (userId, scopes, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const url = url_join_1.default(EGO_API_KEY_ENDPOINT, `?user_id=${userId}&scopes=${encodeURIComponent(scopes.join())}`);
    const response = yield node_fetch_1.default(url, {
        method: 'POST',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
/**
 *
 * @param {string} userName
 * @param {string} Authorization
 * @returns {Promise<{scopes: string[]}>}
 */
const getScopes = (userName, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.EGO_ROOT_REST}/o/scopes?userName=${userName}`;
    const response = yield node_fetch_1.default(url, {
        method: 'get',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
/**
 * @param { EgoAccessKeyObj[] } keys
 * @param {string} Authorization
 * @returns {Promise<{key: string; success: boolean}[]> | null}
 */
const deleteKeys = (keys, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const accessKeys = keys.map(k => k.name);
    const ps = yield Promise.all(accessKeys.map((key) => __awaiter(void 0, void 0, void 0, function* () {
        const url = url_join_1.default(EGO_API_KEY_ENDPOINT, `?apiKey=${encodeURIComponent(key)}`);
        return node_fetch_1.default(url, {
            method: 'delete',
            headers: { Authorization },
        })
            .then(resp => ({ key, success: true }))
            .catch(err => {
            logger_1.default.error(err);
            return { key, success: false };
        });
    })));
    return ps;
});
// check for new group id over 24hours otherwise use memo func
const getDacoIds = (userId, Authorization) => {
    const checkIdExpiry = new Date() - dacoIdsCalled >= dacoGroupIdExpiry;
    if (!memoizedGetDacoIds || checkIdExpiry) {
        memoizedGetDacoIds = getMemoizedDacoIds();
        dacoIdsCalled = new Date();
    }
    return memoizedGetDacoIds(userId, Authorization);
};
const getMemoizedDacoIds = () => memoize_1.default((userId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const queryUrl = `${config_1.EGO_ROOT_REST}/groups?query=`;
    const dacoQueryUrl = queryUrl + 'daco';
    // query param will search descriptions too, so filter on name also
    const response = yield node_fetch_1.default(dacoQueryUrl, {
        method: 'get',
        headers: { Authorization },
    })
        .then(resp => resp.json())
        .then(({ resultSet = [] }) => resultSet.filter(data => data.name === 'DACO'))
        .then(group => {
        if (group.length === 0) {
            throw new Error('DACO group id not found');
        }
        else {
            return group[0].id;
        }
    })
        .catch(err => {
        logger_1.default.error(err);
        return null;
    });
    return response;
}));
/**
 * @param {string} str
 */
const toTimestamp = str => Math.round(new Date(str).getTime() / 1000);
/**
 * @param {EgoAccessKeyObj} accessKeyObj
 * @returns {number}
 */
const getTimeToExpiry = accessKeyObj => {
    return toTimestamp(accessKeyObj.expiryDate) - Math.round(Date.now() / 1000);
};
exports.default = {
    getUser,
    listUsers,
    generateEgoAccessKey,
    getScopes,
    getEgoAccessKeys,
    deleteKeys,
    getDacoIds,
    getTimeToExpiry,
};
//# sourceMappingURL=index.js.map