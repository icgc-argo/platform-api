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
    clinicalEntities: [ClinicalSubmissionEntity]! @cost(complexity: 20)
    fileErrors: [ClinicalFileError]
  }

  type ClinicalSubmissionEntity {
    clinicalType: String!
    batchName: String
    creator: String
    records: [ClinicalRecord]!
    stats: ClinicalSubmissionStats
    dataErrors: [ClinicalSubmissionDataError]!
    schemaErrors: [ClinicalSubmissionSchemaError]!
    dataUpdates: [ClinicalSubmissionUpdate]!
    dataWarnings: [ClinicalSubmissionSchemaError]!
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

  """
  Clinical Data Schemas
  """
  type DonorRecords {
    program_id: String
    age_at_menarche: Int
    bmi: Int
    cause_of_death: String
    donor_id: String
    height: Int
    menopause_status: String
    number_of_children: Int
    number_of_pregnancies: Int
    primary_site: String
    submitter_donor_id: String
    survival_time: Int
    vital_status: String
    weight: Int
  }

  type FollowUpRecords {
    program_id: String
    submitter_donor_id: String
    anatomic_site_progression_or_recurrences: String
    disease_status_at_followup: String
    follow_up_id: String
    interval_of_followup: Int
    is_primary_treatment: String
    method_of_progression_status: String
    posttherapy_m_category: String
    posttherapy_n_category: String
    posttherapy_stage_group: String
    posttherapy_t_category: String
    posttherapy_tumour_staging_system: String
    primary_diagnosis_id: String
    recurrence_m_category: String
    recurrence_n_category: String
    recurrence_stage_group: String
    recurrence_t_category: String
    recurrence_tumour_staging_system: String
    relapse_interval: Int
    relapse_type: String
    submitter_follow_up_id: String
    submitter_primary_diagnosis_id: String
    submitter_treatment_id: String
    treatment_id: String
    treatment_type: String
    weight_at_followup: Int
  }

  type PrimaryDiagnosisRecords {
    program_id: String
    submitter_donor_id: String
    age_at_diagnosis: Int
    basis_of_diagnosis: String
    cancer_type_additional_information: String
    cancer_type_code: String
    clinical_m_category: String
    clinical_n_category: String
    clinical_stage_group: String
    clinical_t_category: String
    clinical_tumour_staging_system: String
    number_lymph_nodes_examined: Int
    number_lymph_nodes_positive: Int
    performance_status: String
    presenting_symptoms: String
    primary_diagnosis_id: String
    submitter_primary_diagnosis_id: String
  }

  type SpecimenRecords {
    program_id: String
    submitter_donor_id: String
    pathological_m_category: String
    pathological_n_category: String
    pathological_stage_group: String
    pathological_t_category: String
    pathological_tumour_staging_system: String
    percent_inflammatory_tissue: Int
    percent_necrosis: Int
    percent_proliferating_cells: Int
    percent_stromal_cells: Int
    percent_tumour_cells: Int
    primary_diagnosis_id: String
    reference_pathology_confirmed: String
    specimen_acquisition_interval: Int
    specimen_anatomic_location: String
    specimen_id: String
    specimen_processing: String
    specimen_storage: String
    submitter_primary_diagnosis_id: String
    submitter_specimen_id: String
    tumour_grade: String
    tumour_grading_system: String
    tumour_histological_type: String
  }

  type TreatmentRecords {
    program_id: String
    submitter_donor_id: String
    adverse_events: String
    anatomical_site_irradiated: String
    chemotherapy_dosage_units: String
    clinical_trial_number: String
    clinical_trials_database: String
    cumulative_drug_dosage: Int
    days_per_cycle: Int
    drug_name: String
    drug_rxnormcui: String
    hemotological_toxicity: String
    hormone_drug_dosage_units: String
    is_primary_treatment: String
    line_of_treatment: Int
    number_of_cycles: Int
    outcome_of_treatment: String
    primary_diagnosis_id: String
    radiation_therapy_dosage: Int
    radiation_therapy_fractions: Int
    radiation_therapy_modality: String
    radiation_therapy_type: String
    response_to_treatment: String
    submitter_primary_diagnosis_id: String
    submitter_treatment_id: String
    toxicity_type: String
    treatment_duration: Int
    treatment_id: String
    treatment_intent: String
    treatment_setting: String
    treatment_start_interval: Int
    treatment_type: String
  }

  type ClinicalDataEntities {
    donor: [DonorRecords]
    follow_ups: [FollowUpRecords]
    primary_diagnosis: [PrimaryDiagnosisRecords]
    specimens: [SpecimenRecords]
    treatments: [TreatmentRecords]
    #dummy
    family_history: [ClinicalDataRecord]
    chemotherapy: [ClinicalDataRecord]
    immunotherapy: [ClinicalDataRecord]
    surgery: [ClinicalDataRecord]
    radiation: [ClinicalDataRecord]
    hormone_therapy: [ClinicalDataRecord]
    exposure: [ClinicalDataRecord]
    comorbidity: [ClinicalDataRecord]
    biomarker: [ClinicalDataRecord]
  }

  type ClinicalDataRecord {
    program_id: String
    submitter_donor_id: String
  }

  type ClinicalData {
    programShortName: String!
    clinicalEntities: ClinicalDataEntities!
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

    """
    Retrieve all stored Clinical Data for a program
    """
    clinicalData(programShortName: String!): ClinicalData!
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
