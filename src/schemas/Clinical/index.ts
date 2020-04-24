import { gql, AuthenticationError, UserInputError } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import get from 'lodash/get';

import costDirectiveTypeDef from '../costDirectiveTypeDef';
import clinicalService from '../../services/clinical';
import egoTokenUtils from 'utils/egoTokenUtils';
import { GlobalGqlContext } from 'app';
import { FileUpload } from 'graphql-upload';

const typeDefs = gql`
  ${costDirectiveTypeDef}
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
      //@ts-ignore consult Jaser on modifying clearRegistrationData or remove this check altogether
      if (response.error) {
        //@ts-ignore
        throw new UserInputError(response.message);
      }
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
