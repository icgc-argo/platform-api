import { gql, AuthenticationError } from 'apollo-server-express';
import { GraphQLJSONObject } from 'graphql-type-json';
import { makeExecutableSchema } from 'graphql-tools';
import get from 'lodash/get';
import omit from 'lodash/omit';

import createEgoUtils from '@icgc-argo/ego-token-utils/dist/lib/ego-token-utils';

import { EGO_PUBLIC_KEY } from '../../config';

const TokenUtils = createEgoUtils(EGO_PUBLIC_KEY);

import costDirectiveTypeDef from '../costDirectiveTypeDef';
import clinicalService from '../../services/clinical';
import { ERROR_MESSAGES } from '../../services/clinical/messages';

const typeDefs = gql`
  ${costDirectiveTypeDef}
  scalar Upload
  scalar JSONObject

  """
  It is possible for there to be no available ClinicalRegistrationData for a program,
    in this case the object will return with id and creator equal to null, and an empty records list.
  """
  type ClinicalRegistrationData @cost(complexity: 10) {
    id: ID
    creator: String

    records: [ClinicalRegistrationRecord]!
    errors: [ClinicalRegistrationError]!

    newDonors: ClinicalRegistrationStats!
    newSpecimens: ClinicalRegistrationStats!
    newSamples: ClinicalRegistrationStats!
    alreadyRegistered: ClinicalRegistrationStats!
  }

  type ClinicalRegistrationRecord @cost(complexity: 5) {
    row: Int!
    programShortName: String!
    donorSubmitterId: String!
    specimenSubmitterId: String!
    specimentType: String!
    sampleSubmitterId: String!
    sampleType: String!
    gender: String!
    tumourNormalDesignation: String!

    """
    data is a JSON Object without defined keys that will contain any additional fields that are
      returned by the clinical registration and not part of the above hardcoded list
    """
    data: JSONObject!
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

  type ClinicalRegistrationError @cost(complexity: 5) {
    type: String!
    message: String!
    row: Int!
    field: String!
    value: String!
    sampleId: String!
    donorId: String!
    specimenId: String!
  }

  type Query {
    """
    Retrieve current stored Clinical Registration data for a program
    """
    clinicalRegistration(shortName: String!): ClinicalRegistrationData!
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
  }
`;

const convertRegistrationRecordToGql = (record, row) => ({
  row,
  programShortName: record.program_id,
  donorSubmitterId: record.submitter_donor_id,
  specimenSubmitterId: record.submitter_specimen_id,
  specimentType: record.specimen_type,
  sampleSubmitterId: record.submitter_sample_id,
  sampleType: record.sample_type,
  gender: record.gender,
  tumourNormalDesignation: record.tumour_normal_designation,
  data: () =>
    omit(record, [
      'program_id',
      'submitter_donor_id',
      'submitter_specimen_id',
      'specimen_type',
      'submitter_sample_id',
      'sample_type',
      'tumour_normal_designation',
      'gender',
    ]),
});

const convertRegistrationStatsToGql = statsEntry => {
  const output = {
    count: 0,
    rows: [],
    names: [],
    values: [],
  };
  const names = Object.keys(statsEntry) || [];
  output.count = names.length;
  names.forEach(name => {
    output.names.push(name);
    const rows = statsEntry[name];
    rows.forEach(row => !output.rows.includes(row) && output.rows.push(row));
    output.values.push({ name, rows });
  });

  return output;
};

const convertRegistrationErrorToGql = errorData => ({
  type: errorData.type,
  message: get(ERROR_MESSAGES, errorData.type, ''), // Empty String if we don't have a message for the given type
  row: errorData.index,
  field: errorData.fieldName,
  value: errorData.info.value,
  sampleId: errorData.info.sampleSubmitterId,
  donorId: errorData.info.donorSubmitterId,
  specimenId: errorData.info.specimenSubmitterId,
});

const convertRegistrationDataToGql = data => {
  return {
    id: data._id || null,
    creator: data.creator || null,
    records: () =>
      get(data, 'records', []).map((record, i) => convertRegistrationRecordToGql(record, i)),
    errors: () =>
      get(data, 'errors', []).map((errorData, i) => convertRegistrationErrorToGql(errorData, i)),

    newDonors: () => convertRegistrationStatsToGql(get(data, 'stats.newDonorIds', {})),
    newSpecimens: () => convertRegistrationStatsToGql(get(data, 'stats.newSpecimenIds', {})),
    newSamples: () => convertRegistrationStatsToGql(get(data, 'stats.newSampleIds', {})),
    alreadyRegistered: () =>
      convertRegistrationStatsToGql(get(data, 'stats.alreadyRegistered', {})),
  };
};

const resolvers = {
  Query: {
    clinicalRegistration: async (obj, args, context, info) => {
      const { Authorization } = context;
      const { shortName } = args;

      const response = await clinicalService.getRegistrationData(shortName, Authorization);
      return convertRegistrationDataToGql(response);
    },
  },
  Mutation: {
    uploadClinicalRegistration: async (obj, args, context, info) => {
      const { Authorization, egoToken } = context;
      const { shortName, registrationFile } = args;

      // Here we are confirming that the user has at least some ability to write Program Data
      //  This is to reduce the opportunity for spamming the gateway with file uploads
      if (!TokenUtils.canWriteSomeProgramData(egoToken)) {
        throw new AuthenticationError('User is not authorized to write data');
      }

      const userId = TokenUtils.decodeToken(egoToken).sub;

      const { filename, createReadStream } = await registrationFile;
      const fileStream = createReadStream();
      const response = await clinicalService.uploadRegistrationData(
        shortName,
        filename,
        fileStream,
        Authorization,
      );

      // Success data is inside the key "registration", error data is in the root level
      const data = response.successful ? response.registration : response;
      return convertRegistrationDataToGql(data);
    },
    clearClinicalRegistration: async (obj, args, context, info) => {
      const { Authorization } = context;
      const { shortName, registrationId } = args;
      const response = await clinicalService.clearRegistrationData(
        shortName,
        registrationId,
        Authorization,
      );
      if (response.error) {
        throw new UserInputError(response.message);
      }
      return true;
    },
    commitClinicalRegistration: async (obj, args, context, info) => {
      const { Authorization } = context;
      const { shortName, registrationId } = args;
      const response = await clinicalService.commitRegistrationData(
        shortName,
        registrationId,
        Authorization,
      );
      return get(response, 'newSamples', []);
    },
  },
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
