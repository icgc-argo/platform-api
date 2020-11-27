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
import { MOCK_API_KEYS } from 'routes/file-storage-api/handlers/test/utils';
import { reduce } from 'axax/es5/reduce';

type QueryResponse = { file: { hits: { edges: { node: { object_id: string } }[] } } };
export const fileDocumentStream = async function*({
  gqlClient,
  apiKey,
}: {
  apiKey: keyof typeof MOCK_API_KEYS;
  gqlClient: ReturnType<typeof createTestClient>;
}) {
  let currentPage = 0;
  const pageSize = 1000;
  cycle: while (true) {
    const queryResponse = await gqlClient.query<
      QueryResponse,
      {
        offset: number;
        first: number;
      }
    >({
      query: `
        query($offset: Int, $first: Int) {
          file {
            hits (first: $first, offset: $offset) {
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
        offset: currentPage,
        first: pageSize,
      },
    });

    if (!queryResponse.data) {
      console.log('no queryResponse.data: ', queryResponse);
      throw new Error('boo');
    } else if (queryResponse.data.file.hits.edges.length > 0) {
      currentPage++;
      yield queryResponse.data;
    } else {
      break cycle;
    }
  }
};

export const reduceToFileHits = (stream: ReturnType<typeof fileDocumentStream>) =>
  reduce<QueryResponse, QueryResponse['file']['hits']['edges']>((acc, r) => {
    r.file.hits.edges.forEach(edge => {
      acc.push(edge);
    });
    return acc;
  }, [])(stream);
