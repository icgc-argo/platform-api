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

// @ts-ignore
import { createProjectSchema } from '@arranger/server/dist/startProject';

import { GraphQLSchema } from 'graphql';
import { transformSchema, TransformRootFields } from 'graphql-tools';
import { ARRANGER_PROJECT_ID } from 'config';
import { Client } from '@elastic/elasticsearch';
import initArrangerMetadata from './initArrangerMetadata';
import { GlobalGqlContext } from 'app';
import { FILE_METADATA_FIELDS, FILE_RELEASE_STAGE } from 'utils/commonTypes/EsFileCentricDocument';
import egoTokenUtils from 'utils/egoTokenUtils';
import { UserProgramMembershipAccessLevel } from '@icgc-argo/ego-token-utils';

export type ArrangerGqlContext = {
  es: Client;
  projectId: string;
};

const emptyFilter = () => ({
  op: 'and',
  content: [],
});

type Sqon = {};
const getAccessControlFilter = (egoToken: string): Sqon => {
  const userPrograms: string[] = [];
  const programMembershipAccessLevel: UserProgramMembershipAccessLevel =
    UserProgramMembershipAccessLevel.PUBLIC_MEMBER;

  /* Logical operator shorthands */
  const all = (conditions: any[]) => ({
    op: 'and',
    content: [...conditions],
  });
  const not = (conditions: any[]) => ({
    op: 'not',
    content: [...conditions],
  });
  const match = (field: keyof typeof FILE_METADATA_FIELDS, values: string[]) => ({
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
  return userPermissionToQueryMap[programMembershipAccessLevel];
};

const getArrangerGqlSchema = async (esClient: Client) => {
  await initArrangerMetadata(esClient);

  // Create arranger schema
  const { schema: argoArrangerSchema } = (await createProjectSchema({
    es: esClient,
    id: ARRANGER_PROJECT_ID,
    graphqlOptions: {},
    enableAdmin: false,
    getServerSideFilter: ({ egoToken }: GlobalGqlContext) => getAccessControlFilter(egoToken),
  })) as { schema: GraphQLSchema };

  // Arranger schema has a recursive field called 'viewer' inside of type 'Root'
  // there is bug in graphql-tools which is unable to interpret this so 'mergeSchema' doesn't work
  // this schema transform is a work around for that, which removes the field
  const transformedSchema = transformSchema(argoArrangerSchema, [
    removeViewerFieldInRootTypeTransform,
  ]);

  return transformedSchema;
};

// This transform is applied to every root field in a schema
// it only removes the Query field named viewer
const removeViewerFieldInRootTypeTransform = new TransformRootFields(
  (operation: 'Query' | 'Mutation' | 'Subscription', fieldName: String, _) => {
    if (operation === 'Query' && fieldName === 'viewer') return null; // return null deletes the field
    return undefined; // return undefined doesn't change field
  },
);

export default getArrangerGqlSchema;
