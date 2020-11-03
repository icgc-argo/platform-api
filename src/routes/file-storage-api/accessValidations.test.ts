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
import { FILE_ACCESS, FILE_RELEASE_STAGE } from 'utils/commonTypes/EsFileCentricDocument';
import { EGO_DACO_POLICY_NAME } from 'config';
import { PERMISSIONS, PermissionScopeObj } from '@icgc-argo/ego-token-utils';

const baseFile = {
  file_id: 'fake_file_id',
  study_id: 'fake_study_id',
  object_id: 'fake_obejct_id',
  file_type: 'fake_file_type',
  program_access_date: 'date',
  data_type: 'fake_data_type',
  data_category: 'fake_data_category',
  analysis_tools: '',
  file_access: FILE_ACCESS.PUBLIC,
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
  permission: PERMISSIONS.READ as keyof typeof PERMISSIONS,
};

describe('hasSufficientProgramMembershipAccess', () => {
  describe('individual program member for file', () => {
    let scopes: PermissionScopeObj[];
    beforeAll(() => {
      const userScopes: PermissionScopeObj[] = [
        {
          policy: PROGRAM_DATA_PREFIX + baseFile.study_id,
          permission: PERMISSIONS.READ as keyof typeof PERMISSIONS,
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
    }),
      it('allows access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for programs with associate membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access  for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.PUBLIC },
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
          permission: PERMISSIONS.READ as keyof typeof PERMISSIONS,
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
    }),
      it('allows access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for programs associated with file', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access  for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.PUBLIC },
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
          permission: PERMISSIONS.READ as keyof typeof PERMISSIONS,
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
    }),
      it('denies access for programs with full membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.FULL_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      }),
      it('allows access for programs with associate membership', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.PUBLIC },
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
    }),
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
      }),
      it('allows access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      }),
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.PUBLIC },
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
    }),
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
      }),
      it('denies access for public release controlled', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.CONTROLLED },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(false);
      }),
      it('allows access for public release open', () => {
        const file = {
          ...baseFile,
          ...{ release_stage: FILE_RELEASE_STAGE.PUBLIC, file_access: FILE_ACCESS.PUBLIC },
        };
        const res = hasSufficientProgramMembershipAccess({ scopes, file });
        expect(res).toBe(true);
      });
  });
});

describe('DACO', () => {
  it('permission give access', () => {
    const scopes: PermissionScopeObj[] = [
      {
        policy: 'DACO',
        permission: PERMISSIONS.READ as keyof typeof PERMISSIONS,
      },
    ];
    const res = hasSufficientDacoAccess({ scopes });
    expect(res).toBe(true);
  }),
    it('fails with no DACO access', () => {
      const scopes: PermissionScopeObj[] = [];
      const res = hasSufficientDacoAccess({ scopes });
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
