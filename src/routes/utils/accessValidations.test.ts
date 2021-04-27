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

import { hasSufficientDacoAccess, hasSufficientProgramMembershipAccess } from './accessValidations';
import {
  EsFileCentricDocument,
  FILE_ACCESS,
  FILE_RELEASE_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import { EGO_DACO_POLICY_NAME } from 'config';
import { PERMISSIONS, PermissionScopeObj } from '@icgc-argo/ego-token-utils';

const baseFile: EsFileCentricDocument = {
  file_id: 'fake_file_id',
  study_id: 'fake_study_id',
  object_id: 'fake_obejct_id',
  file_type: 'fake_file_type',
  program_access_date: 'date',
  data_type: 'fake_data_type',
  data_category: 'fake_data_category',
  analysis_tools: '',
  file_access: FILE_ACCESS.OPEN,
  release_stage: FILE_RELEASE_STAGE.PUBLIC,
  analysis: {
    analysis_id: '',
    analysis_type: '',
    analysis_version: 0,
    publish_date: '',
    workflow: {
      workflow_name: '',
      workflow_version: '',
    },
    variant_class: '',
    experiment: {
      platform: '',
      experimental_strategy: '',
    },
  },
  clinical: {
    donor: {
      clinical_tumour_staging_system: '',
      number_lymph_nodes_examined: 0,
      number_lymph_nodes_positive: 0,
      performance_status: '',
      presenting_symptoms: '',
      primary_diagnosis_id: '',
      submitter_primary_diagnosis_id: '',
    },
    specimen: {
      pathological_m_category: '',
      pathological_n_category: '',
      pathological_stage_group: '',
      pathological_t_category: '',
      pathological_tumour_staging_system: '',
      percent_inflammatory_tissue: 0,
      percent_necrosis: 0,
      percent_proliferating_cells: 0,
      percent_stromal_cells: 0,
      percent_tumour_cells: 0,
      primary_diagnosis_id: '',
      reference_pathology_confirmed: '',
      specimen_acquisition_interval: 0,
      specimen_anatomic_location: '',
      specimen_id: '',
      specimen_processing: '',
      specimen_storage: '',
      submitter_primary_diagnosis_id: '',
      submitter_specimen_id: '',
      tumour_grade: '',
      tumour_grading_system: '',
      tumour_histological_type: '',
    },
    treatment: {
      adverse_events: '',
      anatomical_site_irradiated: '',
      chemotherapy_dosage_units: '',
      clinical_trial_number: '',
      clinical_trials_database: '',
      cumulative_drug_dosage: 0,
      days_per_cycle: 0,
      drug_name: '',
      drug_rxnormcui: '',
      hemotological_toxicity: '',
      hormone_drug_dosage_units: '',
      is_primary_treatment: '',
      line_of_treatment: 0,
      number_of_cycles: 0,
      outcome_of_treatment: '',
      primary_diagnosis_id: '',
      radiation_therapy_dosage: 0,
      radiation_therapy_fractions: 0,
      radiation_therapy_modality: '',
      radiation_therapy_type: '',
      response_to_treatment: '',
      submitter_primary_diagnosis_id: '',
      submitter_treatment_id: '',
      toxicity_type: '',
      treatment_duration: 0,
      treatment_id: '',
      treatment_intent: '',
      treatment_setting: '',
      treatment_start_interval: 0,
      treatment_type: '',
    },
  },
  file: {
    size: 0,
    md5sum: '',
    name: '',
    index_file: {
      object_id: '',
      file_type: '',
      md5sum: '',
      name: '',
      size: 0,
    },
  },
  donors: [
    {
      donor_id: '',
      submitter_donor_id: '',
      gender: '',
      specimens: [
        {
          specimen_id: '',
          submitter_specimen_id: '',
          tumour_normal_designation: '',
          specimen_tissue_source: '',
          specimen_type: '',
          samples: [
            {
              sample_id: '',
              submitter_sample_id: '',
              sample_type: '',
              matched_normal_submitter_sample_id: '',
            },
          ],
        },
      ],
    },
  ],
  repositories: [
    {
      code: '',
      name: '',
      organization: '',
      country: '',
      url: '',
    },
  ],
};

const PROGRAM_DATA_PREFIX = 'PROGRAMDATA-';
const FULL_PROGRAM_MEMBER_POLICY = 'PROGRAMMEMBERSHIP-FULL';
const ASSOCIATE_PROGRAM_MEMBER_POLICY = 'PROGRAMMEMBERSHIP-ASSOCIATE';

const DACO_SCOPE = {
  policy: EGO_DACO_POLICY_NAME,
  permission: PERMISSIONS.READ,
};

describe('accesValidations', () => {
  describe('hasSufficientProgramMembershipAccess', () => {
    describe('individual program member for file', () => {
      let scopes: PermissionScopeObj[];
      beforeAll(() => {
        const userScopes: PermissionScopeObj[] = [
          {
            policy: PROGRAM_DATA_PREFIX + baseFile.study_id,
            permission: PERMISSIONS.READ,
          },
          DACO_SCOPE,
        ];
        scopes = userScopes;
      });

      it('allows access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.OWN_PROGRAM },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for programs with associate membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access  for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.OPEN },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
    });

    describe('user with full program membership, not a member of file', () => {
      let scopes: PermissionScopeObj[];
      beforeAll(() => {
        const userScopes: PermissionScopeObj[] = [
          {
            policy: FULL_PROGRAM_MEMBER_POLICY,
            permission: PERMISSIONS.READ,
          },
          DACO_SCOPE,
        ];
        scopes = userScopes;
      });

      it('denies access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.OWN_PROGRAM },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('allows access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access  for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.OPEN },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
    });

    describe('user with associate program membership, not a member of file', () => {
      let scopes: PermissionScopeObj[];
      beforeAll(() => {
        const userScopes: PermissionScopeObj[] = [
          {
            policy: ASSOCIATE_PROGRAM_MEMBER_POLICY,
            permission: PERMISSIONS.READ,
          },
          DACO_SCOPE,
        ];
        scopes = userScopes;
      });

      it('denies access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.OWN_PROGRAM },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('denies access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('allows access for programs with associate membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.OPEN },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
    });

    describe('authorized public user', () => {
      let scopes: PermissionScopeObj[];
      beforeAll(() => {
        const userScopes: PermissionScopeObj[] = [DACO_SCOPE];
        scopes = userScopes;
      });

      it('denies access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.OWN_PROGRAM },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('denies access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      }),
        it('denies access for programs with associate membership', () => {
          const file = {
            ...baseFile,
            ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
          };
          const res = hasSufficientProgramMembershipAccess({ scopes, file });
          expect(res).toBe(false);
        });
      it('allows access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.OPEN },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
    });

    describe('unauthorized public user', () => {
      let scopes: PermissionScopeObj[];
      beforeAll(() => {
        const userScopes: PermissionScopeObj[] = [];
        scopes = userScopes;
      });

      it('denies access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.OWN_PROGRAM },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('denies access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('denies access for programs with associate membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      });
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.OPEN },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
    });
  });

  describe('DACO', () => {
    const controlledFile: typeof baseFile = {
      ...baseFile,
      file_access: FILE_ACCESS.CONTROLLED,
    };
    const publicFile: typeof baseFile = {
      ...baseFile,
      file_access: FILE_ACCESS.OPEN,
    };
    it('permission give access', () => {
      const scopes: PermissionScopeObj[] = [
        {
          policy: 'DACO',
          permission: PERMISSIONS.READ,
        },
      ];
      const res = hasSufficientDacoAccess({ scopes, file: publicFile });
      expect(res).toBe(true);
    });

    it('fails with no DACO access', () => {
      const scopes: PermissionScopeObj[] = [];
      const res = hasSufficientDacoAccess({ scopes, file: controlledFile });
      expect(res).toBe(false);
    });

    it('fails with denied DACO access', () => {
      const scopes: PermissionScopeObj[] = [
        {
          policy: 'DACO',
          permission: PERMISSIONS.DENY,
        },
        {
          policy: 'DACO',
          permission: PERMISSIONS.READ,
        },
      ];
      const res = hasSufficientDacoAccess({ scopes, file: controlledFile });
      expect(res).toBe(false);
    });
  });

  /* it('allows public access', async () => {
  const scopes: PermissionScopeObj[] = [{ policy: '', permission: PERMISSIONS.READ }];
  const file = {
    ...baseFile,
    ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.PUBLIC },
  };
  const hasAccess = hasSufficientProgramMembershipAccess({ file, scopes });
  expect(hasAccess).toBe(true);
});

it('allows file available to users who are member of the program which is associated with the file', async () => {
  expect(false).toBe(true);
});*/
});
