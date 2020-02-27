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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importStar(require("node-fetch"));
const form_data_1 = __importDefault(require("form-data"));
const config_1 = require("../../config");
const restUtils_1 = require("../../utils/restUtils");
const getRegistrationData = (programShortName, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration`;
    const response = yield node_fetch_1.default(url, {
        method: 'get',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const uploadRegistrationData = (programShortName, filename, fileStream, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const formData = new form_data_1.default();
    // Need to buffer whole file from stream to ensure it all gets added to form data.
    const fileBuffer = yield new node_fetch_1.Response(fileStream).buffer();
    // For FormData to send a buffer as a file, it requires a filename in the options.
    formData.append('registrationFile', fileBuffer, {
        filename,
    });
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration`;
    const response = yield node_fetch_1.default(url, {
        method: 'post',
        headers: { Authorization },
        body: formData,
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const clearRegistrationData = (programShortName, registrationId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration/${registrationId}`, {
        method: 'delete',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => true);
    return response;
});
const commitRegistrationData = (programShortName, registrationId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration/${registrationId}/commit`, {
        method: 'post',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
/**
 * @returns {Promise<string[]>}
 */
const getClinicalSubmissionTypesList = () => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/schema/list`;
    const response = yield node_fetch_1.default(url, {
        method: 'get',
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
/**
 * @returns {Promise<string>}
 */
const getClinicalSubmissionSchemaVersion = () => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/schema`;
    const response = yield node_fetch_1.default(url, {
        method: 'get',
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    console.log(response.version);
    return response.version;
});
/**
 * @returns {Promise<boolean>}
 */
const getClinicalSubmissionSystemDisabled = () => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/configs/submission-disabled`;
    const response = yield node_fetch_1.default(url, {
        method: 'get',
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const getClinicalSubmissionData = (programShortName, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/`;
    const response = yield node_fetch_1.default(url, {
        method: 'get',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const uploadClinicalSubmissionData = (programShortName, filesMap, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const formData = new form_data_1.default();
    for (var filename in filesMap) {
        const fileBuffer = yield new node_fetch_1.Response(filesMap[filename]).buffer();
        formData.append('clinicalFiles', fileBuffer, {
            filename,
        });
    }
    const url = `${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/upload`;
    const response = yield node_fetch_1.default(url, {
        method: 'post',
        headers: { Authorization },
        body: formData,
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const clearClinicalSubmissionData = (programShortName, versionId, fileType, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/${versionId}/${fileType}`, {
        method: 'delete',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const validateClinicalSubmissionData = (programShortName, versionId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/validate/${versionId}`, {
        method: 'post',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const commitClinicalSubmissionData = (programShortName, versionId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/commit/${versionId}`, {
        method: 'post',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const reopenClinicalSubmissionData = (programShortName, versionId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/reopen/${versionId}`, {
        method: 'post',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response.json());
    return response;
});
const approveClinicalSubmissionData = (programShortName, versionId, Authorization) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(`${config_1.CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/approve/${versionId}`, {
        method: 'post',
        headers: { Authorization },
    })
        .then(restUtils_1.restErrorResponseHandler)
        .then(response => response);
    return true;
});
exports.default = {
    getRegistrationData,
    uploadRegistrationData,
    clearRegistrationData,
    commitRegistrationData,
    getClinicalSubmissionTypesList,
    getClinicalSubmissionSchemaVersion,
    getClinicalSubmissionSystemDisabled,
    getClinicalSubmissionData,
    uploadClinicalSubmissionData,
    clearClinicalSubmissionData,
    validateClinicalSubmissionData,
    commitClinicalSubmissionData,
    reopenClinicalSubmissionData,
    approveClinicalSubmissionData,
};
//# sourceMappingURL=index.js.map