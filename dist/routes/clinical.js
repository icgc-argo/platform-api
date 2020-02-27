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
const url_join_1 = __importDefault(require("url-join"));
const config_1 = require("../config");
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = __importDefault(require("../utils/logger"));
var express = require('express');
var router = express.Router();
// Our specification download service can't use GraphQL because GraphQL specification requires the content-type
// that it returns be json, and we want to be able to return other content types, such as tab-separated-values,
// so that the user is automatically prompted to save the file from their browser.
const apiRoot = url_join_1.default(config_1.CLINICAL_SERVICE_ROOT, config_1.SUBMISSION_TEMPLATE_PATH);
// This is mostly passthrough, so file names and response will be set in clincial
// 'all' will retrieve the zip file with all templates
// for specific templates 'templateName'.tsv or 'templateName' will get the tsv from clinical
router.get('/template/:template', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const name = req.params.template.replace(/.tsv$/, '');
    node_fetch_1.default(url_join_1.default(apiRoot, name))
        .then(r => {
        res.status(r.status);
        res.headers = r.headers.raw();
        // copying headers doesn't copy the content-type&content-disposition header...
        res.set({
            'Content-Type': r.headers.get('content-type') || 'application/json',
            'Content-Disposition': r.headers.get('content-disposition') || 'inline',
        });
        // pass buffered data to next '.then'
        return r.buffer(); // buffer() turns the body into the buffred data
    })
        .then(bufferedData => res.send(bufferedData))
        .catch(err => handleError(err, res));
}));
// This is for handling nodejs/system errors (e.g. connection failed)
function handleError(err, res) {
    logger_1.default.error('Clinical Router Error - ' + err);
    return res.status(500).send('Internal Server Error');
}
module.exports = router;
//# sourceMappingURL=clinical.js.map