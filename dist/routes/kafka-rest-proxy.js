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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const ego_token_utils_1 = __importDefault(require("@icgc-argo/ego-token-utils/dist/lib/ego-token-utils"));
const url_join_1 = __importDefault(require("url-join"));
const logger_1 = __importDefault(require("../utils/logger"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const body_parser_1 = require("body-parser");
const TokenUtils = ego_token_utils_1.default(config_1.EGO_PUBLIC_KEY);
var express = require('express');
var router = express.Router();
const apiRoot = config_1.KAFKA_REST_PROXY_ROOT;
// fetch needs to use the json body parser
router.use(body_parser_1.json());
// middleware to secure the kafka proxy endpoint
// it expects a valid jwt
router.use((req, res, next) => {
    const jwt = (req.headers.authorization || '').split(' ')[1] || '';
    if (jwt === '') {
        return res.status(401).send({
            message: "this endpoint needs a valid jwt token"
        });
    }
    let decodedToken = '';
    try {
        decodedToken = TokenUtils.decodeToken(jwt);
    }
    catch (err) {
        logger_1.default.error('failed to decode token');
    }
    if (!decodedToken || decodedToken.exp < new Date().getUTCMilliseconds()) {
        return res.status(401).send({
            message: "expired token"
        });
    }
    return next();
});
router.post('/:topic', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const url = url_join_1.default(apiRoot, "topics", req.params.topic);
    const msg = req.body;
    logger_1.default.debug(`received message in kafka proxy ${JSON.stringify(msg)}`);
    const kafkaRestProxyBody = JSON.stringify({
        records: [{
                value: msg
            }]
    });
    return node_fetch_1.default(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/vnd.kafka.json.v2+json',
            'Accept': 'application/vnd.kafka.v2+json'
        },
        body: kafkaRestProxyBody
    }).then(response => {
        res.contentType('application/vnd.kafka.v2+json');
        res.status(response.status);
        return response.body.pipe(res);
    }).catch(e => {
        logger_1.default.error('failed to send message to kafka proxy' + e);
        return res.status(500).send(e);
    });
}));
module.exports = router;
//# sourceMappingURL=kafka-rest-proxy.js.map