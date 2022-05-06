/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import get from 'lodash/get';

import clinicalService from '../../services/clinical';
import egoTokenUtils from 'utils/egoTokenUtils';
import { GlobalGqlContext } from 'app';
import { FileUpload } from 'graphql-upload';
import typeDefs from './gqlTypeDefs'


const ARRAY_DELIMETER_CHAR = '|';

function convertToString(val: unknown) {
  return val === undefined || val === null ? '' : `${val}`;
}

function normalizeValue(val: unknown) {
  if (Array.isArray(val)) {
    return val.map(convertToString).join(ARRAY_DELIMETER_CHAR);
  }
  return convertToString(val);
}

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
  value: normalizeValue(errorData.info.value),
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
    fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
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
      fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
    };
  };

type ClinicalEntityData = {
  programShortName: string;
  clinicalEntities: ClinicalEntityRecord[];
  completionStats: CompletionStats;
};

type ClinicalVariables = {
    programShortName: string;
    filters: {
      entityTypes: string[];
      page: number;
      limit: number; 
      donorIds: number[];
      submitterDonorIds: string[];
      completionState: string;
      sort: string;
    }, 
}

enum CoreClinicalEntities {
  'donor',
  'specimens',
  'primaryDiagnosis',
  'followUps',
  'treatments',
  'familyHistory'
}

type CompletionStats = {
  coreCompletion: CoreCompletionFields;
  coreCompletionDate: string;
  coreCompletionPercentage: number;
  overriddenCoreCompletion: [CoreClinicalEntities];
  donorId: number;
}

type CoreCompletionFields = {
  [k in CoreClinicalEntities]?: number;
};

interface ClinicalEntityRecord { 
  entityName: string,
  records: EntityRecord[][],
  entityFields: string[],
};

type ClinicalErrors = {
    donorId: number;
    submitterDonorId: string;
    errors: ClinicalErrorRecord[];
}[];

type ClinicalErrorRecord = {
     entityName: string;
     errorType: string;
     fieldName: string;
     index: number;
     message: string;
}

const convertClinicalDataToGql = (
  programShortName: string,
  data: any,
): ClinicalEntityData => {
  const { completionStats } = data;
  const clinicalEntities: ClinicalEntityRecord[] = data.clinicalEntities.map((entity: any) => {

    const records: EntityRecord[][] = entity.records.map((record: any) => (
      Object.keys(record)
        .map(key => key && ({ name: key, value: record[key] })
    )));

    const entityData = {
      entityName: entity.entityName,
      entityFields: entity.entityFields,
      records,
    };

    return entityData;
  });

  const clinicalData = {
    programShortName,
    clinicalEntities,
    completionStats,
  };

  return clinicalData
};

const convertClinicalErrorsToGql = (
  data: ClinicalErrors,
): ClinicalErrors => {

  return data
};

const convertClinicalFileErrorToGql = (fileError: {
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
  dataWarnings: ErrorData[];
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
      get(entity, 'dataErrors', [] as typeof entity.dataErrors).map((error: ErrorData) =>
        convertClinicalSubmissionDataErrorToGql(error),
      ),
    dataWarnings: () => 
      get(entity, 'dataWarnings', [] as typeof entity.dataWarnings).map((warning: ErrorData) => 
        convertClinicalSubmissionDataErrorToGql(warning)
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
    const value = normalizeValue(record[field]);
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
    // errorData.info.value may come back as null if not provided in uploaded file
  const errorValue = get(errorData, 'info.value', '') || '';
  return {
    type: errorData.type,
    message: errorData.message,
    row: errorData.index,
    field: errorData.fieldName,
    donorId: get(errorData, 'info.donorSubmitterId', '') || '',    
    value: normalizeValue(errorValue), 
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
    newValue: normalizeValue(updateData.info.newValue),
    oldValue: normalizeValue(updateData.info.oldValue),
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
    clinicalData: async (
      obj: unknown,
      args: ClinicalVariables,
      context: GlobalGqlContext,
    ) => {
      const { Authorization } = context;
      const response = await clinicalService.getClinicalData(
        args,
        Authorization,
      );
      console.log('obj', obj);
      return convertClinicalDataToGql(args.programShortName, response);
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
  ClinicalData: {
    clinicalErrors: async (
      parent: ClinicalEntityData,
      args: ClinicalVariables,
      context: GlobalGqlContext,
        ) => {
          const { Authorization } = context;
          const response = await clinicalService.getClinicalErrors(
            parent.programShortName,
            Authorization,
          );

          return response
      },
  }
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
  resolverValidationOptions: {
    requireResolversForResolveType: false
  }
});
