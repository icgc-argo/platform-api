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

import { createTestClient } from 'apollo-server-testing';
import { MOCK_API_KEYS, MOCK_API_KEY_SCOPES } from 'routes/file-storage-api/handlers/test/utils';
import { reduce } from 'axax/es5/reduce';

import { Request } from 'express';
import getArrangerGqlSchema, { ArrangerGqlContext } from '..';
import { ARRANGER_PROJECT_ID } from 'config';
import { ApolloServer } from 'apollo-server-express';
import { Client } from '@elastic/elasticsearch';
import { ArrangerFilter } from '../arrangerFilterTypes';
// import { EgoJwtData, UserStatus, UserType } from '@icgc-argo/ego-token-utils/dist/common';

type QueryResponse = { file: { hits: { edges: { node: { object_id: string } }[] } } };

const mockJwtData = (apiKey: keyof typeof MOCK_API_KEYS): any => ({
  aud: [],
  context: {
    scope: MOCK_API_KEY_SCOPES[apiKey],
    user: {
      createdAt: 0,
      email: '',
      firstName: '',
      lastLogin: 0,
      lastName: '',
      preferredLanguage: '',
      status: 'APPROVED',
      type: 'USER',
      providerType: 'GOOGLE',
      providerSubjectId: '',
    },
  },
  exp: Infinity,
  iat: 0,
  iss: '',
  jti: '',
  sub: '',
});

const createArrangerApi = async ({
  esClient,
  apiKey,
}: {
  apiKey: keyof typeof MOCK_API_KEYS;
  esClient: Client;
}) => {
  const apolloServer = new ApolloServer({
    schema: await getArrangerGqlSchema(esClient, true),
    context: ({ req }: { req: Request }): ArrangerGqlContext => ({
      es: esClient, // for arranger only
      projectId: ARRANGER_PROJECT_ID, // for arranger only
      userJwtData: mockJwtData(apiKey),
    }),
  });
  const graphqlClient = createTestClient(apolloServer);
  return graphqlClient;
};

export const fileDocumentStream = async function* ({
  esClient,
  apiKey,
  clientSideFilters,
}: {
  apiKey: keyof typeof MOCK_API_KEYS;
  esClient: Client;
  clientSideFilters?: ArrangerFilter;
}) {
  let offset = 0;
  const pageSize = 1000;
  const graphqlClient = await createArrangerApi({
    esClient,
    apiKey,
  });

  cycle: while (true) {
    const queryResponse = await graphqlClient.query<
      QueryResponse,
      {
        offset: number;
        first: number;
        filters?: ArrangerFilter;
      }
    >({
      query: `
        query($offset: Int, $first: Int, $filters: JSON) {
          file {
            hits (
              first: $first,
              offset: $offset,
              sort: { field: "object_id" },
              filters: $filters
            ) {
              edges {
                node {
                  object_id
                }
              }
            }
          }
        }
      `,
      variables: {
        offset: offset,
        first: pageSize,
        filters: clientSideFilters,
      },
    });

    if (!queryResponse.data) {
      throw new Error(queryResponse.errors?.toString());
    } else if (queryResponse.data.file.hits.edges.length > 0) {
      offset += pageSize;
      yield queryResponse.data;
    } else {
      break cycle;
    }
  }
};

export const reduceToFileHits = (stream: ReturnType<typeof fileDocumentStream>) =>
  reduce<QueryResponse, QueryResponse['file']['hits']['edges']>((acc, r) => {
    r.file.hits.edges.forEach((edge) => {
      acc.push(edge);
    });
    return acc;
  }, [])(stream);

export const aggregateAllObjectIds = async ({
  esClient,
  apiKey,
  clientSideFilters,
}: {
  apiKey: keyof typeof MOCK_API_KEYS;
  esClient: Client;
  clientSideFilters?: ArrangerFilter;
}) => {
  const graphqlClient = await createArrangerApi({
    esClient,
    apiKey,
  });

  const respone = await graphqlClient.query<
    {
      file: {
        aggregations: {
          object_id: {
            buckets: {
              key: string;
            }[];
          };
        };
      };
    },
    {
      filters?: ArrangerFilter;
    }
  >({
    query: `
      query($filters: JSON) {
        file {
          aggregations (filters: $filters, aggregations_filter_themselves: true) {
            object_id {
              buckets {
                key
              }
            }
          }
        }
      }
    `,
    variables: {
      filters: clientSideFilters,
    },
  });

  if (respone.errors) {
    throw new Error(respone.errors.toString());
  }

  return respone.data;
};
