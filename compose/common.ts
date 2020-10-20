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

export const createClient = async (host: string): Promise<Client> => {
  const esClient = new Client({
    node: host,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  try {
    await esClient.ping();
    return esClient;
  } catch (err) {
    console.log(`failing to ping elasticsearch at ${host}: `, err);
    throw err;
  }
};

export const deleteIndex = async (client: Client, index: string) => {
  try {
    console.log(`deleting index ${index}`);
    await client.indices.delete({
      index: index,
    });
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

export const index = async (client: Client, index: string, data: typeof indexData) => {
  await Promise.all(
    data.map((doc, idx) => {
      console.log(`doc_${idx}`);
      return client.index({
        index: index,
        refresh: 'wait_for',
        body: {
          ...doc,
          donors: [doc.donors].map(donor => ({
            ...donor,
            specimens: [donor.specimens].map(specimen => ({
              ...specimen,
              samples: [specimen.samples],
            })),
          })),
          repositories: [doc.repositories],
        },
      });
    }),
  );

  console.log('Complete!');
};
