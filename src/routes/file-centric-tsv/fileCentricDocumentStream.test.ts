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

import { createEsClient } from 'services/elasticsearch';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';
import { Client } from '@elastic/elasticsearch';
import { EsFileDocument } from './types';
import { createEsDocumentStream } from './utils';
import esb from 'elastic-builder';

describe('Arranger schema', () => {
  const mockMapping = {
    mappings: {
      properties: {
        study_id: {
          type: 'keyword',
        },
        object_id: {
          type: 'keyword',
        },
      },
    },
  };
  type MockDocument = Partial<EsFileDocument>;
  const testData: MockDocument[] = [
    {
      study_id: 'study_1',
      object_id: 'object_1',
    },
    {
      study_id: 'study_2',
      object_id: 'object_2',
    },
    {
      study_id: 'study_3',
      object_id: 'object_3',
    },
  ];
  const testIndex = 'test';
  let esContainer: StartedTestContainer;
  let esClient: Client;
  beforeAll(async () => {
    esContainer = await new GenericContainer('elasticsearch', '7.5.0')
      .withExposedPorts(9200)
      .withEnv('discovery.type', 'single-node')
      .withStartupTimeout(new Duration(120, TemporalUnit.SECONDS))
      .start();
    esClient = await createEsClient({
      node: `http://${esContainer.getContainerIpAddress()}:${esContainer.getMappedPort(9200)}`,
    });
    esClient.indices.create({
      index: testIndex,
      body: mockMapping,
    });
    await Promise.all(
      testData.map(entry =>
        esClient.index({
          index: testIndex,
          body: entry,
          refresh: 'wait_for',
        }),
      ),
    );
  }, 120000);
  afterAll(async () => {
    await esContainer.stop();
  }, 120000);

  describe('createEsDocumentStream', () => {
    it('must create a stream of all documents', async () => {
      let chunkCount = 0;
      let docCount = 0;
      const chunkSize = 2;
      const stream = createEsDocumentStream<MockDocument>({
        sortField: 'object_id',
        esClient,
        esIndex: testIndex,
        shouldContinue: () => true,
        pageSize: chunkSize,
      });
      for await (const chunk of stream) {
        chunkCount++;
        docCount += chunk.length;
      }
      expect(chunkCount).toBe(Math.ceil(testData.length / chunkSize));
      expect(docCount).toBe(testData.length);
    });
    it('must handle elasticsearch query', async () => {
      let chunkCount = 0;
      let docCount = 0;
      const chunkSize = 2;
      const stream = createEsDocumentStream<MockDocument>({
        sortField: 'object_id',
        esClient,
        esIndex: testIndex,
        shouldContinue: () => true,
        pageSize: chunkSize,
        esQuery: esb
          .requestBodySearch()
          .query(esb.boolQuery().must(esb.matchQuery('object_id', 'object_1')))
          //@ts-ignore
          .toJSON().query,
      });
      for await (const chunk of stream) {
        chunkCount++;
        docCount += chunk.length;
      }
      expect(chunkCount).toBe(1);
      expect(docCount).toBe(1);
    });
  });
});
