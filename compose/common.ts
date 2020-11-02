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

import { Client } from '@elastic/elasticsearch';
import indexData from './file_centric/sample_file_centric.json';
import indexSettings from './file_centric/file_mapping.json';
import _ from 'lodash';

const esUsernameEnv = 'ES_USERNAME';
const esPasswordEnv = 'ES_PASSWORD';
const esHostEnv = 'ES_HOST';

export const createClient = async (): Promise<Client> => {
  const auth = {
    username: process.env[esUsernameEnv] as string,
    password: process.env[esPasswordEnv] as string,
  };
  const host = process.env[esHostEnv] || 'http://localhost:9200';
  const esClient = new Client({
    node: host,
    auth: (auth.username && auth.password && auth) || undefined,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  try {
    await esClient.ping();
    return esClient;
  } catch (err) {
    console.log(`failing to ping elasticsearch at ${host}: `, err);
    console.log(`A custom elasticsearch host can also be provided with the ${esHostEnv} env`);
    console.log(
      `!!!!!!! If your elasticsearch is password protected, provide the credential through ${esUsernameEnv} and ${esPasswordEnv} env var !!!!!!!`,
    );
    throw err;
  }
};

export const deleteIndex = async (client: Client, index: string) => {
  try {
    console.log(`deleting index ${index}`);
    const deleteResult = await client.indices.delete({
      index: index,
    });
    console.log(deleteResult);
  } catch (err) {
    console.log(`could not delete index ${index}: `, err);
    if ((await client.indices.exists({ index: index })).body) {
      throw err;
    }
  }
};

export const createIndex = async (
  client: Client,
  index: string,
  settings: typeof indexSettings,
) => {
  console.log(`creating index ${index}`);

  await client.indices.create({
    index: index,
    body: settings,
  });

  console.log('index created');
};

export const toEsBulkIndexActions = <T = {}>(
  indexName: string,
  getDocumentId: (document: T) => string | undefined,
) => (docs: Array<T>) =>
  _.flatMap(docs, doc => {
    const documentId = getDocumentId(doc);
    return [
      {
        index: documentId ? { _index: indexName, _id: documentId } : { _index: indexName },
      },
      doc,
    ];
  });

export const index = async (client: Client, index: string, data: typeof indexData) => {
  let i = 0;
  for (const chunk of _.chunk(data, 1000)) {
    await client.bulk({
      refresh: 'true',
      body: toEsBulkIndexActions<any>(index, doc => doc.object_id)(
        chunk.map(doc => ({
          ...doc,
          donors: [doc.donors].map(donor => ({
            ...donor,
            specimens: [donor.specimens].map(specimen => ({
              ...specimen,
              samples: [specimen.samples],
            })),
          })),
          repositories: [doc.repositories],
        })),
      ),
    });
    console.log(`done chunk ${i++}`);
  }
  console.log('Complete!');
};
