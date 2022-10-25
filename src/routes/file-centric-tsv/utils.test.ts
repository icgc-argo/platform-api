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
import {
  createEsDocumentStream,
  createFilterToEsQueryConverter,
  FilterStringParser,
  writeTsvStreamToWritableTarget,
} from './utils';
import esb from 'elastic-builder';

describe('createEsDocumentStream', () => {
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
      node: `http://${esContainer.getContainerIpAddress()}:${esContainer.getMappedPort(
        9200,
      )}`,
    });
    esClient.indices.create({
      index: testIndex,
      body: mockMapping,
    });
    await Promise.all(
      testData.map((entry) =>
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
    it('must stop when terminated', async () => {
      let chunkCount = 0;
      let docCount = 0;
      let terminated = false;
      const chunkSize = 2;
      const stream = createEsDocumentStream<MockDocument>({
        sortField: 'object_id',
        esClient,
        esIndex: testIndex,
        shouldContinue: () => !terminated,
        pageSize: chunkSize,
      });
      for await (const chunk of stream) {
        terminated = true;
        chunkCount++;
        docCount += chunk.length;
      }
      expect(chunkCount).toBe(1);
      expect(docCount).toBe(chunkSize);
    });
  });

  describe('query string parser (createFilterStringToEsQueryParser)', () => {
    let parseFilterString: FilterStringParser;
    beforeAll(async () => {
      parseFilterString = await createFilterToEsQueryConverter(
        esClient,
        testIndex,
      );
    });
    it('must accept valid sqon', async () => {
      const parsed = await parseFilterString({
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'study_id',
              value: 'study_1',
            },
          },
        ],
      });
      expect(parsed).toBeDefined();
    });
    it('must reject invalid sqons', async () => {
      await expect(
        parseFilterString(
          JSON.stringify({
            op: 'wut?!',
            content: [
              {
                op: 'huh?!!!',
                content: {
                  field: 'bogus',
                  value: 'value',
                },
              },
            ],
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('writeTsvStreamToWritableTarget', () => {
    it('must generate a proper tsv', async () => {
      const stream = (async function*() {
        for (const entry of testData) {
          yield [entry];
        }
      })();

      let tsvString = '';
      const expectedTsvStr = `${[
        'Study ID\tObject ID',
        'study_1\tobject_1',
        'study_2\tobject_2',
        'study_3\tobject_3',
      ].join('\n')}\n`;

      await writeTsvStreamToWritableTarget<typeof testData[0]>(
        stream,
        {
          write: (str) => {
            tsvString = `${tsvString}${str}`;
          },
        },
        [
          { header: 'Study ID', getter: (e) => e.study_id || '' },
          { header: 'Object ID', getter: (e) => e.object_id || '' },
        ],
      );
      expect(tsvString).toBe(expectedTsvStr);
    });
  });
});
