import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import get from 'lodash/get';

import clinicalService from '../../services/clinical';
import egoTokenUtils from 'utils/egoTokenUtils';
import { GlobalGqlContext } from 'app';
import { FileUpload } from 'graphql-upload';
import typeDefs from './gqlTypeDefs'

const convertRegistrationStatsToGql = (
  statsEntry: {
    submitterId: string;
    rowNumbers: (string | number)[];
  }[],
) => {
  const output = {
    count: 0,
    rows: [] as (string | number)[],
    names: [] as string[],
    values: [] as {name: string, rows: (string | number)[] }[],
  };
  const names = statsEntry.map(se => se.submitterId) || ([] as string[]);
  output.count = names.length;
  names.forEach(name => {
    output.names.push(name);
    const rows = statsEntry.find(se => se.submitterId == name)?.rowNumbers || [];
    rows.forEach(row => !output.rows.includes(row) && output.rows.push(row));
    output.values.push({ name, rows });
  });

  return output;
};

type RegistrationErrorData = ErrorData & {
  info: {
    value: string;
    sampleSubmitterId: string;
    donorSubmitterId: string;
    specimenSubmitterId: string;
  };
};
const convertRegistrationErrorToGql = (errorData: RegistrationErrorData) => ({
  type: errorData.type,
  message: errorData.message,
  row: errorData.index,
  field: errorData.fieldName,
  value: errorData.info.value,
  sampleId: errorData.info.sampleSubmitterId,
  donorId: errorData.info.donorSubmitterId,
  specimenId: errorData.info.specimenSubmitterId,
});

const convertRegistrationDataToGql = (
  programShortName: string,
  data: {
    registration: {
      _id: string;
      creator: string;
      batchName: string;
      createdAt: string | number;
      records: EntityRecord[];
    };
    errors?: RegistrationErrorData[];
    batchErrors?: unknown[];
  },
) => {
  const registration = get(data, 'registration', {} as Partial<typeof data.registration>);
  const schemaAndValidationErrors = get(data, 'errors', [] as typeof data.errors);
  const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
  return {
    id: registration._id || null,
    programShortName,
    creator: registration.creator || null,
    fileName: registration.batchName || null,
    createdAt: registration.createdAt || null,
    records: () =>
      get(registration, 'records', [] as Required<typeof registration>['records']).map(
        (record, i) => convertClinicalRecordToGql(i, record),
      ),
    errors: schemaAndValidationErrors?.map(convertRegistrationErrorToGql),
    fileErrors: fileErrors?.map(convertClinicalFileErrorrToGql),
    newDonors: () => convertRegistrationStatsToGql(get(registration, 'stats.newDonorIds', [])),
    newSpecimens: () =>
      convertRegistrationStatsToGql(get(registration, 'stats.newSpecimenIds', [])),
    newSamples: () => convertRegistrationStatsToGql(get(registration, 'stats.newSampleIds', [])),
    alreadyRegistered: () =>
      convertRegistrationStatsToGql(get(registration, 'stats.alreadyRegistered', [])),
  };
};

const convertClinicalSubmissionDataToGql = (
  programShortName: string,
  data: {
    submission: {
      _id: string;
      state: string;
      version: string;
      updatedBy: string;
      updatedAt: string;
      clinicalEntities: { [k: string]: SubmissionEntity };
    };
    batchErrors?: unknown[];
  },
) => {
  const submission = get(data, 'submission', {} as Partial<typeof data.submission>);
  const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
  const clinicalEntities = get(
    submission,
    'clinicalEntities',
    {} as typeof data.submission.clinicalEntities,
  );

  return {
    id: submission._id || null,
    programShortName,
    state: submission.state || null,
    version: submission.version || null,
    updatedBy: submission.updatedBy || null,
    updatedAt: submission.updatedAt ? new Date(submission.updatedAt) : null,
    clinicalEntities: async () => {
      const clinicalSubmissionTypeList = await clinicalService.getClinicalSubmissionTypesList();
      const filledClinicalEntities = clinicalSubmissionTypeList.map(clinicalType => ({
        clinicalType,
        ...(clinicalEntities[clinicalType] || {}),
      }));
      return filledClinicalEntities.map(clinicalEntity =>
        convertClinicalSubmissionEntityToGql(clinicalEntity.clinicalType, clinicalEntity),
      );
    },
    fileErrors: fileErrors?.map(convertClinicalFileErrorrToGql),
  };
};

const convertClinicalFileErrorrToGql = (fileError: {
  message: string;
  batchNames: string[];
  code: string;
}) => {
  return {
    message: fileError.message,
    fileNames: fileError.batchNames,
    code: fileError.code,
  };
};

type SubmissionEntity = {
  batchName: string;
  creator: string;
  records: EntityRecord[];
  stats: unknown;
  dataUpdates: UpdateData[];
  schemaErrors: ErrorData[];
  dataErrors: ErrorData[];
  createdAt: string | number;
};
const convertClinicalSubmissionEntityToGql = (clinicalType: string, entity: SubmissionEntity) => {
  return {
    clinicalType,
    batchName: entity.batchName || null,
    creator: entity.creator || null,
    records: () =>
      get(entity, 'records', [] as typeof entity.records).map((record, index) =>
        convertClinicalRecordToGql(index, record),
      ),
    stats: entity.stats || null,
    schemaErrors: () => {
      const entityErrors = entity.schemaErrors || [];
      return entityErrors.map(error =>
        convertClinicalSubmissionSchemaErrorToGql(clinicalType, error),
      );
    },
    dataErrors: () =>
      get(entity, 'dataErrors', [] as typeof entity.dataErrors).map(error =>
        convertClinicalSubmissionDataErrorToGql(error),
      ),
    dataUpdates: () =>
      get(entity, 'dataUpdates', [] as typeof entity.dataUpdates).map(update =>
        convertClinicalSubmissionUpdateToGql(update),
      ),
    createdAt: entity.createdAt ? new Date(entity.createdAt) : null,
  };
};

type EntityRecord = { [k: string]: unknown };
const convertClinicalRecordToGql = (index: number | string, record: EntityRecord) => {
  const fields = [];
  for (var field in record) {
    const value =
      record[field] === undefined || record[field] === null ? undefined : `${record[field]}`;
    fields.push({ name: field, value: value });
  }
  return {
    row: index,
    fields: fields,
  };
};

type ErrorData = {
  type: string;
  message: string;
  index: number | string;
  fieldName: string;
};
const convertClinicalSubmissionDataErrorToGql = (errorData: ErrorData) => {
  return {
    type: errorData.type,
    message: errorData.message,
    row: errorData.index,
    field: errorData.fieldName,
    donorId: get(errorData, 'info.donorSubmitterId', '') || '',

    // errorData.info.value may come back as null if not provided in uploaded file
    value: get(errorData, 'info.value', '') || '',
  };
};

const convertClinicalSubmissionSchemaErrorToGql = (
  clinicalType: unknown,
  errorData: ErrorData,
) => ({
  ...convertClinicalSubmissionDataErrorToGql(errorData),
  clinicalType,
});

type UpdateData = {
  index: string | number;
  fieldName: string;
  info: {
    newValue: unknown;
    oldValue: unknown;
    donorSubmitterId: string;
  };
};
const convertClinicalSubmissionUpdateToGql = (updateData: UpdateData) => {
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
    clinicalRegistration: async (
      obj: unknown,
      args: { shortName: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { shortName } = args;

      const response = await clinicalService.getRegistrationData(shortName, Authorization);
      return convertRegistrationDataToGql(shortName, { registration: response });
    },
    clinicalSubmissions: async (
      obj: unknown,
      args: { programShortName: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { programShortName } = args;

      const response = await clinicalService.getClinicalSubmissionData(
        programShortName,
        Authorization,
      );
      return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
    },
    clinicalSubmissionTypesList: async (obj: unknown, args: {}, context: GlobalGqlContext) => {
      return await clinicalService.getClinicalSubmissionTypesList();
    },
    clinicalSubmissionSchemaVersion: async (obj: unknown, args: {}, context: GlobalGqlContext) => {
      return await clinicalService.getClinicalSubmissionSchemaVersion();
    },
    clinicalSubmissionSystemDisabled: async (obj: unknown, args: {}, context: GlobalGqlContext) => {
      return await clinicalService.getClinicalSubmissionSystemDisabled();
    },
  },
  Mutation: {
    uploadClinicalRegistration: async (
      obj: unknown,
      args: {
        shortName: string;
        registrationFile: FileUpload;
      },
      context: GlobalGqlContext,
    ) => {
      const { Authorization, egoToken } = context;
      const { shortName, registrationFile } = args;
      const permissions = egoTokenUtils.getPermissionsFromToken(egoToken);
      // Here we are confirming that the user has at least some ability to write Program Data
      // This is to reduce the opportunity for spamming the gateway with file uploads
      if (!egoTokenUtils.canWriteSomeProgramData(permissions)) {
        throw new AuthenticationError('User is not authorized to write data');
      }

      const { filename, createReadStream } = await registrationFile;
      const fileStream = createReadStream();

      // try {
      const response = await clinicalService.uploadRegistrationData(
        shortName,
        filename,
        fileStream,
        Authorization,
      );

      return convertRegistrationDataToGql(shortName, response);
    },
    clearClinicalRegistration: async (
      obj: unknown,
      args: {
        shortName: string;
        registrationId: string;
      },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { shortName, registrationId } = args;
      const response = await clinicalService.clearRegistrationData(
        shortName,
        registrationId,
        Authorization,
      );
      return true;
    },
    commitClinicalRegistration: async (
      obj: unknown,
      args: { shortName: string; registrationId: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { shortName, registrationId } = args;
      const response = await clinicalService.commitRegistrationData(
        shortName,
        registrationId,
        Authorization,
      );
      return get(response, 'newSamples', []);
    },
    uploadClinicalSubmissions: async (
      obj: unknown,
      args: { programShortName: string; clinicalFiles: Array<FileUpload> },
      context: GlobalGqlContext,
    ) => {
      const { Authorization, egoToken } = context;
      const { programShortName, clinicalFiles } = args;
      const permissions = egoTokenUtils.getPermissionsFromToken(egoToken)

      // see reason in uploadRegistration
      if (!egoTokenUtils.canWriteSomeProgramData(permissions)) {
        throw new AuthenticationError('User is not authorized to write data');
      }

      const filesMap: { [k: string]: ReturnType<FileUpload['createReadStream']> } = {};

      await Promise.all(clinicalFiles).then(val =>
        val.forEach(file => (filesMap[file.filename] = file.createReadStream())),
      );
      const response = await clinicalService.uploadClinicalSubmissionData(
        programShortName,
        filesMap,
        Authorization,
      );
      return convertClinicalSubmissionDataToGql(programShortName, response);
    },
    clearClinicalSubmission: async (
      obj: unknown,
      args: { programShortName: string; fileType: string; version: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { programShortName, fileType, version } = args;

      const response = await clinicalService.clearClinicalSubmissionData(
        programShortName,
        version,
        fileType || 'all',
        Authorization,
      );

      return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
    },
    validateClinicalSubmissions: async (
      obj: unknown,
      args: { programShortName: string; version: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { programShortName, version } = args;
      const response = await clinicalService.validateClinicalSubmissionData(
        programShortName,
        version,
        Authorization,
      );
      return convertClinicalSubmissionDataToGql(programShortName, response);
    },
    commitClinicalSubmission: async (
      obj: unknown,
      args: { programShortName: string; version: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { programShortName, version } = args;
      const response = await clinicalService.commitClinicalSubmissionData(
        programShortName,
        version,
        Authorization,
      );
      return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
    },
    reopenClinicalSubmission: async (
      obj: unknown,
      args: { programShortName: string; version: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { programShortName, version } = args;
      const response = await clinicalService.reopenClinicalSubmissionData(
        programShortName,
        version,
        Authorization,
      );
      return convertClinicalSubmissionDataToGql(programShortName, { submission: response });
    },
    approveClinicalSubmission: async (
      obj: unknown,
      args: { programShortName: string; version: string },
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const { programShortName, version } = args;
      const response = await clinicalService.approveClinicalSubmissionData(
        programShortName,
        version,
        Authorization,
      );
      return response ? true : false;
    },
  },
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});