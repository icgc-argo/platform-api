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

import 'babel-polyfill';
import { FILE_METADATA_FIELDS, FILE_RELEASE_STAGE } from 'utils/commonTypes/EsFileCentricDocument';
import egoTokenUtils from 'utils/egoTokenUtils';
import { UserProgramMembershipAccessLevel } from '@icgc-argo/ego-token-utils';
import { EgoJwtData } from '@icgc-argo/ego-token-utils/dist/common';
import {
  ArrangerFilterFieldOperation,
  ArrangerFilter,
  ArrangerFilterNode,
} from './arrangerFilterTypes';

const emptyFilter = () => ({
  op: 'and',
  content: [],
});

const getAccessControlFilter = (userJwtData: EgoJwtData | null): ArrangerFilter => {
  const userPrograms: string[] = userJwtData
    ? egoTokenUtils.getReadableProgramDataNames(userJwtData.context.scope)
    : [];
  const programMembershipAccessLevel: UserProgramMembershipAccessLevel = userJwtData
    ? egoTokenUtils.getProgramMembershipAccessLevel({
        permissions: userJwtData.context.scope,
      })
    : UserProgramMembershipAccessLevel.PUBLIC_MEMBER;

  /* Logical operator shorthands */
  const all = (conditions: ArrangerFilterNode[]): ArrangerFilter => ({
    op: 'and',
    content: [...conditions],
  });
  const not = (conditions: ArrangerFilterNode[]): ArrangerFilter => ({
    op: 'not',
    content: [...conditions],
  });
  const match = (
    field: keyof typeof FILE_METADATA_FIELDS,
    values: string[],
  ): ArrangerFilterFieldOperation => ({
    op: 'in',
    content: {
      field,
      value: values,
    },
  });
  /*******************************/

  /* common filters */
  const isFromOtherPrograms = not([match(FILE_METADATA_FIELDS['study_id'], userPrograms)]);
  const isUnReleasedFromOtherPrograms = all([
    isFromOtherPrograms,
    match(FILE_METADATA_FIELDS['release_stage'], [FILE_RELEASE_STAGE.OWN_PROGRAM]),
  ]);
  /******************/

  const userPermissionToQueryMap: {
    [accessLevel in UserProgramMembershipAccessLevel]: any;
  } = {
    DCC_MEMBER: emptyFilter(),
    FULL_PROGRAM_MEMBER: not([isUnReleasedFromOtherPrograms]),
    ASSOCIATE_PROGRAM_MEMBER: all([
      not([isUnReleasedFromOtherPrograms]),
      not([
        all([
          isFromOtherPrograms,
          match(FILE_METADATA_FIELDS['release_stage'], [FILE_RELEASE_STAGE.FULL_PROGRAMS]),
        ]),
      ]),
    ]),
    PUBLIC_MEMBER: match(FILE_METADATA_FIELDS['release_stage'], [FILE_RELEASE_STAGE.PUBLIC]),
  };
  const output = userPermissionToQueryMap[programMembershipAccessLevel];
  console.log('server-side filter: ', JSON.stringify(output));
  return output;
};

export default getAccessControlFilter;
