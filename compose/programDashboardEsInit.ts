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

import es from '@elastic/elasticsearch';
const mapping = require('./sample_schema.json');
const donors = require('./donors.json');

const client = new es.Client({
  node: 'http://localhost:9200',
});

export const initIndexMapping = async (index: string, esClient: es.Client) => {
  const serializedIndexName = index.toLowerCase();
  await esClient.indices.putMapping({
    index: serializedIndexName,
    body: mapping.mappings,
  });
};

(async () => {
  try {
    await client.indices.delete({ index: 'donor_centric' });
  } catch (err) {
    console.log(err);
  }
  await client.indices.create({ index: 'donor_centric' }).catch(err => console.log('create'));
  await initIndexMapping('donor_centric', client).catch(err => console.log('mapping'));
  await Promise.all(
    donors.map((donor: any) =>
      client.index({
        index: 'donor_centric',
        body: {
          ...donor,
          createdAt: new Date(donor.createdAt),
          updatedAt: new Date(donor.updatedAt),
        },
      }),
    ),
  ).catch(err => console.log('index'));
})();
