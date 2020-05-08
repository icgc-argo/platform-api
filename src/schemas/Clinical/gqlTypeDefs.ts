import { gql } from 'apollo-server-express';
import costDirectiveTypeDef from '../costDirectiveTypeDef';

export default gql`
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