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
const apollo_server_express_1 = require("apollo-server-express");
const graphql_tools_1 = require("graphql-tools");
const get_1 = __importDefault(require("lodash/get"));
const ego_token_utils_1 = __importDefault(require("@icgc-argo/ego-token-utils/dist/lib/ego-token-utils"));
const config_1 = require("../../config");
const TokenUtils = ego_token_utils_1.default(config_1.EGO_PUBLIC_KEY);
const costDirectiveTypeDef_1 = __importDefault(require("../costDirectiveTypeDef"));
const clinical_1 = __importDefault(require("../../services/clinical"));
const typeDefs = apollo_server_express_1.gql `
  ${costDirectiveTypeDef_1.default}
  scalar Upload
  scalar DateTime

  enum SubmissionState {
    OPEN
    VALID
    INVALID
    PENDING_APPROVAL
    INVALID_BY_MIGRATION
  }

  """
  It is possible for there to be no available ClinicalRegistrationData for a program,
    in this case the object will return with id and creator equal to null, and an empty records list.
  """
  type ClinicalRegistrationData @cost(complexity: 10) {
    id: ID
    programShortName: ID
    creator: String
    fileName: String
    createdAt: DateTime
    records: [ClinicalRecord]!
    errors: [ClinicalRegistrationError]!
    fileErrors: [ClinicalFileError]

    newDonors: ClinicalRegistrationStats!
    newSpecimens: ClinicalRegistrationStats!
    newSamples: ClinicalRegistrationStats!
    alreadyRegistered: ClinicalRegistrationStats!
  }

  type ClinicalRegistrationStats @cost(complexity: 10) {
    count: Int!
    rows: [Int]!
    names: [String]!
    values: [ClinicalRegistrationStatValue]!
  }

  type ClinicalRegistrationStatValue {
    name: String!
    rows: [Int]!
  }

  type ClinicalSubmissionData @cost(complexity: 10) {
    id: ID
    programShortName: ID
    state: SubmissionState
    version: String
    updatedBy: String
    updatedAt: DateTime
    clinicalEntities: [ClinicalEntityData]! @cost(complexity: 20)
    fileErrors: [ClinicalFileError]
  }

  type ClinicalEntityData {
    clinicalType: String!
    batchName: String
    creator: String
    records: [ClinicalRecord]!
    stats: ClinicalSubmissionStats
    dataErrors: [ClinicalSubmissionDataError]!
    schemaErrors: [ClinicalSubmissionSchemaError]!
    dataUpdates: [ClinicalSubmissionUpdate]!
    createdAt: DateTime
  }

  """
  Generic schema of clinical tsv records
  """
  type ClinicalRecord {
    row: Int!
    fields: [ClinicalRecordField!]!
  }
  type ClinicalRecordField {
    name: String!
    value: String
  }

  """
  Each field is an array of row index referenced in ClinicalSubmissionRecord
  """
  type ClinicalSubmissionStats {
    noUpdate: [Int]!
    new: [Int]!
    updated: [Int]!
    errorsFound: [Int]!
  }

  """
  All schemas below describe clinical errors
  """
  type ClinicalFileError @cost(complexity: 5) {
    message: String!
    fileNames: [String]!
    code: String!
  }

  interface ClinicalEntityError {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    donorId: String!
  }

  type ClinicalRegistrationError implements ClinicalEntityError @cost(complexity: 5) {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    sampleId: String
    donorId: String!
    specimenId: String
  }

  type ClinicalSubmissionDataError implements ClinicalEntityError @cost(complexity: 5) {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    donorId: String!
  }

  type ClinicalSubmissionSchemaError implements ClinicalEntityError @cost(complexity: 10) {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    donorId: String!
    clinicalType: String!
  }

  type ClinicalSubmissionUpdate @cost(complexity: 5) {
    row: Int!
    field: String!
    newValue: String!
    oldValue: String!
    donorId: String!
  }

  type Query {
    """
    Retrieve current stored Clinical Registration data for a program
    """
    clinicalRegistration(shortName: String!): ClinicalRegistrationData!

    """
    Retrieve current stored Clinical Submission data for a program
    """
    clinicalSubmissions(programShortName: String!): ClinicalSubmissionData!

    """
    Retrieve current stored Clinical Submission Types list
    """
    clinicalSubmissionTypesList: [String!]

    """
    Retrieve current stored Clinical Submission Data Dictionary Schema version
    """
    clinicalSubmissionSchemaVersion: String!

    """
    Retrieve current Clinical Submission disabled state for both sample_registration and clinical entity files
    """
    clinicalSubmissionSystemDisabled: Boolean!
  }

  type Mutation {
    """
    Upload a Registration file
    """
    uploadClinicalRegistration(
      shortName: String!
      registrationFile: Upload!
    ): ClinicalRegistrationData! @cost(complexity: 30)

    """
    Remove the Clinical Registration data currently uploaded and not committed
    """
    clearClinicalRegistration(shortName: String!, registrationId: String!): Boolean!
      @cost(complexity: 10)

    """
    Complete registration of the currently uploaded Clinical Registration data
    On Success, returns a list of the new sample IDs that were committed
    """
    commitClinicalRegistration(shortName: String!, registrationId: String!): [String]!
      @cost(complexity: 20)

    """
    Upload Clinical Submission files
    """
    uploadClinicalSubmissions(
      programShortName: String!
      clinicalFiles: [Upload!]
    ): ClinicalSubmissionData! @cost(complexity: 30)

    """
    Clear Clinical Submission
    fileType is optional, if it is not provided all fileTypes will be cleared. The values for fileType are the same as the file names from each template (ex. donor, specimen)
    """
    clearClinicalSubmission(
      programShortName: String!
      version: String!
      fileType: String
    ): ClinicalSubmissionData! @cost(complexity: 20)

    """
    Validate the uploaded clinical files
    """
    validateClinicalSubmissions(
      programShortName: String!
      version: String!
    ): ClinicalSubmissionData! @cost(complexity: 30)

    """
    - If there is update: makes a clinical submission ready for approval by a DCC member,
    returning submission data with updated state
    - If there is NO update: merges clinical data to system, returning an empty submission
    """
    commitClinicalSubmission(programShortName: String!, version: String!): ClinicalSubmissionData!
      @cost(complexity: 30)

    """
    Available for DCC members to reopen a clinical submission
    """
    reopenClinicalSubmission(programShortName: String!, version: String!): ClinicalSubmissionData!
      @cost(complexity: 30)

    """
    Available for DCC members to approve a clinical submission
    """
    approveClinicalSubmission(programShortName: String!, version: String!): Boolean!
      @cost(complexity: 30)
  }
`;
const convertRegistrationStatsToGql = statsEntry => {
    const output = {
        count: 0,
        rows: [],
        names: [],
        values: [],
    };
    const names = statsEntry.map(se => se.submitterId) || [];
    output.count = names.length;
    names.forEach(name => {
        output.names.push(name);
        const rows = statsEntry.find(se => se.submitterId == name).rowNumbers || [];
        rows.forEach(row => !output.rows.includes(row) && output.rows.push(row));
        output.values.push({ name, rows });
    });
    return output;
};
const convertRegistrationErrorToGql = errorData => ({
    type: errorData.type,
    message: errorData.message,
    row: errorData.index,
    field: errorData.fieldName,
    value: errorData.info.value,
    sampleId: errorData.info.sampleSubmitterId,
    donorId: errorData.info.donorSubmitterId,
    specimenId: errorData.info.specimenSubmitterId,
});
const convertRegistrationDataToGql = (programShortName, data) => {
    const registration = get_1.default(data, 'registration', {});
    const schemaAndValidationErrors = get_1.default(data, 'errors', []);
    const fileErrors = get_1.default(data, 'batchErrors', []);
    return {
        id: registration._id || null,
        programShortName,
        creator: registration.creator || null,
        fileName: registration.batchName || null,
        createdAt: registration.createdAt || null,
        records: () => get_1.default(registration, 'records', []).map((record, i) => convertClinicalRecordToGql(i, record)),
        errors: schemaAndValidationErrors.map(convertRegistrationErrorToGql),
        fileErrors: fileErrors.map(convertClinicalFileErrorrToGql),
        newDonors: () => convertRegistrationStatsToGql(get_1.default(registration, 'stats.newDonorIds', [])),
        newSpecimens: () => convertRegistrationStatsToGql(get_1.default(registration, 'stats.newSpecimenIds', [])),
        newSamples: () => convertRegistrationStatsToGql(get_1.default(registration, 'stats.newSampleIds', [])),
        alreadyRegistered: () => convertRegistrationStatsToGql(get_1.default(registration, 'stats.alreadyRegistered', [])),
    };
};
const convertClinicalSubmissionDataToGql = (programShortName, data) => {
    const submission = get_1.default(data, 'submission', {});
    const fileErrors = get_1.default(data, 'batchErrors', []);
    const clinicalEntities = get_1.default(submission, 'clinicalEntities', {});
    return {
        id: submission._id || null,
        programShortName,
        state: submission.state || null,
        version: submission.version || null,
        updatedBy: submission.updatedBy || null,
        updatedAt: submission.updatedAt ? new Date(submission.updatedAt) : null,
        clinicalEntities: () => __awaiter(void 0, void 0, void 0, function* () {
            const clinicalSubmissionTypeList = yield clinical_1.default.getClinicalSubmissionTypesList();
            const filledClinicalEntities = clinicalSubmissionTypeList.map(clinicalType => (Object.assign({ clinicalType }, (clinicalEntities[clinicalType] || {}))));
            return filledClinicalEntities.map(clinicalEntity => convertClinicalSubmissionEntityToGql(clinicalEntity.clinicalType, clinicalEntity));
        }),
        fileErrors: fileErrors.map(convertClinicalFileErrorrToGql),
    };
};
const convertClinicalFileErrorrToGql = fileError => {
    console.log(JSON.stringify(fileError));
    return {
        message: fileError.message,
        fileNames: fileError.batchNames,
        code: fileError.code,
    };
};
const convertClinicalSubmissionEntityToGql = (clinicalType, entity) => {
    return {
        clinicalType,
        batchName: entity.batchName || null,
        creator: entity.creator || null,
        records: () => get_1.default(entity, 'records', []).map((record, index) => convertClinicalRecordToGql(index, record)),
        stats: entity.stats || null,
        schemaErrors: () => {
            const entityErrors = entity.schemaErrors || [];
            return entityErrors.map(error => convertClinicalSubmissionSchemaErrorToGql(clinicalType, error));
        },
        dataErrors: () => get_1.default(entity, 'dataErrors', []).map(error => convertClinicalSubmissionDataErrorToGql(error)),
        dataUpdates: () => get_1.default(entity, 'dataUpdates', []).map(update => convertClinicalSubmissionUpdateToGql(update)),
        createdAt: entity.createdAt ? new Date(entity.createdAt) : null,
    };
};
const convertClinicalRecordToGql = (index, record) => {
    const fields = [];
    for (var field in record) {
        const value = record[field] === undefined || record[field] === null ? undefined : `${record[field]}`;
        fields.push({ name: field, value: value });
    }
    return {
        row: index,
        fields: fields,
    };
};
const convertClinicalSubmissionDataErrorToGql = errorData => {
    return {
        type: errorData.type,
        message: errorData.message,
        row: errorData.index,
        field: errorData.fieldName,
        donorId: get_1.default(errorData, 'info.donorSubmitterId', '') || '',
        // errorData.info.value may come back as null if not provided in uploaded file
        value: get_1.default(errorData, 'info.value', '') || '',
    };
};
const convertClinicalSubmissionSchemaErrorToGql = (clinicalType, errorData) => (Object.assign(Object.assign({}, convertClinicalSubmissionDataErrorToGql(errorData)), { clinicalType }));
const convertClinicalSubmissionUpdateToGql = updateData => {
    return {
        row: updateData.index,
        field: updateData.fieldName,
        newValue: updateData.info.newValue,
        oldValue: updateData.info.oldValue,
        donorId: updateData.info.donorSubmitterId,
    };
};
const resolvers = {
    Query: {
        clinicalRegistration: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { shortName } = args;
            const response = yield clinical_1.default.getRegistrationData(shortName, Authorization);
            return convertRegistrationDataToGql(shortName, { registration: response });
        }),
        clinicalSubmissions: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { programShortName } = args;
            const response = yield clinical_1.default.getClinicalSubmissionData(programShortName, Authorization);
            return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
        }),
        clinicalSubmissionTypesList: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            return yield clinical_1.default.getClinicalSubmissionTypesList();
        }),
        clinicalSubmissionSchemaVersion: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            return yield clinical_1.default.getClinicalSubmissionSchemaVersion();
        }),
        clinicalSubmissionSystemDisabled: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            return yield clinical_1.default.getClinicalSubmissionSystemDisabled();
        }),
    },
    Mutation: {
        uploadClinicalRegistration: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization, egoToken } = context;
            const { shortName, registrationFile } = args;
            // Here we are confirming that the user has at least some ability to write Program Data
            // This is to reduce the opportunity for spamming the gateway with file uploads
            if (!TokenUtils.canWriteSomeProgramData(egoToken)) {
                throw new apollo_server_express_1.AuthenticationError('User is not authorized to write data');
            }
            const { filename, createReadStream } = yield registrationFile;
            const fileStream = createReadStream();
            // try {
            const response = yield clinical_1.default.uploadRegistrationData(shortName, filename, fileStream, Authorization);
            return convertRegistrationDataToGql(shortName, response);
        }),
        clearClinicalRegistration: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { shortName, registrationId } = args;
            const response = yield clinical_1.default.clearRegistrationData(shortName, registrationId, Authorization);
            if (response.error) {
                throw new UserInputError(response.message);
            }
            return true;
        }),
        commitClinicalRegistration: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { shortName, registrationId } = args;
            const response = yield clinical_1.default.commitRegistrationData(shortName, registrationId, Authorization);
            return get_1.default(response, 'newSamples', []);
        }),
        uploadClinicalSubmissions: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization, egoToken } = context;
            const { programShortName, clinicalFiles } = args;
            // see reason in uploadRegistration
            if (!TokenUtils.canWriteSomeProgramData(egoToken)) {
                throw new apollo_server_express_1.AuthenticationError('User is not authorized to write data');
            }
            const filesMap = {};
            yield Promise.all(clinicalFiles).then(val => val.forEach(file => (filesMap[file.filename] = file.createReadStream())));
            const response = yield clinical_1.default.uploadClinicalSubmissionData(programShortName, filesMap, Authorization);
            return convertClinicalSubmissionDataToGql(programShortName, response);
        }),
        clearClinicalSubmission: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { programShortName, fileType, version } = args;
            const response = yield clinical_1.default.clearClinicalSubmissionData(programShortName, version, fileType || 'all', Authorization);
            return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
        }),
        validateClinicalSubmissions: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { programShortName, version } = args;
            const response = yield clinical_1.default.validateClinicalSubmissionData(programShortName, version, Authorization);
            return convertClinicalSubmissionDataToGql(programShortName, response);
        }),
        commitClinicalSubmission: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { programShortName, version } = args;
            const response = yield clinical_1.default.commitClinicalSubmissionData(programShortName, version, Authorization);
            return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
        }),
        reopenClinicalSubmission: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { programShortName, version } = args;
            const response = yield clinical_1.default.reopenClinicalSubmissionData(programShortName, version, Authorization);
            return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
        }),
        approveClinicalSubmission: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization } = context;
            const { programShortName, version } = args;
            const response = yield clinical_1.default.approveClinicalSubmissionData(programShortName, version, Authorization);
            return response ? true : false;
        }),
    },
};
exports.default = graphql_tools_1.makeExecutableSchema({
    typeDefs,
    resolvers,
});
//# sourceMappingURL=index.js.map