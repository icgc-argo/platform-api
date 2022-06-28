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

import egoTokenUtils from 'utils/egoTokenUtils';
import {
  EsFileCentricDocument,
  FILE_ACCESS,
  FILE_EMBARGO_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import {
  PERMISSIONS,
  PermissionScopeObj,
  UserProgramMembershipAccessLevel,
} from '@icgc-argo/ego-token-utils';
import { EGO_DACO_POLICY_NAME } from 'config';

export const hasSufficientProgramMembershipAccess = (config: {
  scopes: PermissionScopeObj[];
  file?: EsFileCentricDocument;
}): boolean => {
  if (config.file) {
    const { scopes, file } = config;
    const embargoStage = file.meta.embargo_stage;

    const serializedScopes = scopes.map(egoTokenUtils.serializeScope);
    const accessLevel = egoTokenUtils.getProgramMembershipAccessLevel({
      permissions: serializedScopes,
    });

    const programId = file.meta.study_id;

    if (embargoStage === FILE_EMBARGO_STAGE.OWN_PROGRAM) {
      return (
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({
          permissions: serializedScopes,
          programId,
        })
      );
    }

    if (embargoStage === FILE_EMBARGO_STAGE.FULL_PROGRAMS) {
      return (
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({
          permissions: serializedScopes,
          programId,
        }) ||
        accessLevel === UserProgramMembershipAccessLevel.FULL_PROGRAM_MEMBER
      );
    }

    if (embargoStage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS) {
      return (
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({
          permissions: serializedScopes,
          programId,
        }) ||
        accessLevel === UserProgramMembershipAccessLevel.FULL_PROGRAM_MEMBER ||
        accessLevel ===
          UserProgramMembershipAccessLevel.ASSOCIATE_PROGRAM_MEMBER
      );
    }

    if (embargoStage === FILE_EMBARGO_STAGE.PUBLIC) {
      return true;
    }
  }
  return false;
};

export const hasSufficientDacoAccess = (config: {
  scopes: PermissionScopeObj[];
  file: EsFileCentricDocument;
}): boolean => {
  const dacoScopes = config.scopes.filter(
    ({ policy }) => policy === EGO_DACO_POLICY_NAME,
  );
  const userHasDacoAccess =
    dacoScopes.length > 0 &&
    dacoScopes.some((scope) => scope.permission === PERMISSIONS.READ) &&
    dacoScopes.every((scope) => scope.permission !== PERMISSIONS.DENY);
  return (
    config.file.file_access === FILE_ACCESS.OPEN ||
    (config.file.file_access === FILE_ACCESS.CONTROLLED && userHasDacoAccess)
  );
};
