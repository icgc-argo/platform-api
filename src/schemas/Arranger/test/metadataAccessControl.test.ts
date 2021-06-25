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
import { exec } from 'child_process';
import { promisify } from 'util';
import { EsFileCentricDocument, FILE_EMBARGO_STAGE } from 'utils/commonTypes/EsFileCentricDocument';
import {
  getAllIndexedDocuments,
  MOCK_API_KEYS,
  MOCK_API_KEY_SCOPES,
  TEST_PROGRAM
} from 'routes/file-storage-api/handlers/test/utils';
import { aggregateAllObjectIds, fileDocumentStream, reduceToFileHits } from './utils';
import _ from 'lodash';

const asyncExec = promisify(exec);

describe('Arranger metadata access control', () => {
  let allIndexedDocuments: { [objectId: string]: EsFileCentricDocument } = {};

  const mockMapping = {
    aliases: {
      file_centric: {},
    },
    mappings: {
      dynamic: false,
      date_detection: false,
      properties: {
        study_id: {
          type: 'keyword',
        },
        file: {
          properties: {
            file_id: {
              type: 'keyword',
            },
          },
        },
      },
    },
  };
  let esContainer: StartedTestContainer;
  let esClient: Client;
  let esHost: string;
  beforeAll(async () => {
    esContainer = await new GenericContainer('elasticsearch', '7.5.0')
      .withExposedPorts(9200)
      .withEnv('discovery.type', 'single-node')
      .withStartupTimeout(new Duration(120, TemporalUnit.SECONDS))
      .start();
    esHost = `http://${esContainer.getContainerIpAddress()}:${esContainer.getMappedPort(9200)}`;
    esClient = await createEsClient({
      node: esHost,
    });
    esClient.indices.create({
      index: 'test',
      body: mockMapping,
    });

    const { stdout, stderr } = await asyncExec(`ES_HOST=${esHost} npm run embargoStageEsInit`);
    if (stderr.length) {
      throw stderr;
    }
    console.log('embargoStageEsInit stdout: ', stdout);
    await new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 30000);
    });
    allIndexedDocuments = (await getAllIndexedDocuments(esClient)).reduce(
      (acc, doc) => {
        acc[doc.object_id] = doc;
        return acc;
      },
      {} as typeof allIndexedDocuments,
    );
  });
  afterAll(async () => {
    await esContainer.stop();
  });


  describe('hits query', () => {
    it('returns unique entities', async () => {
      const responseStream = fileDocumentStream({
        esClient,
        apiKey: MOCK_API_KEYS.PUBLIC,
      });
      const allRetrievedEntities = await reduceToFileHits(responseStream);
      expect(
        _(allRetrievedEntities)
          .uniqBy(e => e.node.object_id)
          .size(),
      ).toBe(allRetrievedEntities.length);
    });

    it('returns and all the right data for public users', async () => {
      const responseStream = fileDocumentStream({
        esClient,
        apiKey: MOCK_API_KEYS.PUBLIC,
      });
      const allEntityIdsFromApi = (await reduceToFileHits(responseStream)).map(
        e => e.node.object_id,
      );
      const equivalentIndexedDocuments = allEntityIdsFromApi.map(
        id => allIndexedDocuments[id || ''],
      );
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(
        doc => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
      );
      expect(equivalentIndexedDocuments.length).toBe(allDocumentsThatQualify.length);
      expect(allDocumentsThatQualify.every(doc => equivalentIndexedDocuments.includes(doc))).toBe(
        true,
      );
      expect(equivalentIndexedDocuments.every(doc => allDocumentsThatQualify.includes(doc))).toBe(
        true,
      );
    });

    it('returns all data for DCC', async () => {
      const responseStream = fileDocumentStream({
        esClient,
        apiKey: MOCK_API_KEYS.DCC,
      });
      const allRetrievedEntities = await reduceToFileHits(responseStream);
      expect(allRetrievedEntities.length).toBe(Object.entries(allIndexedDocuments).length);
    });

    it('returns correct data for program members', async () => {
      const apiKey = MOCK_API_KEYS.FULL_PROGRAM_MEMBER;
      const userScopes = MOCK_API_KEY_SCOPES[apiKey];
      const responseStream = fileDocumentStream({ esClient, apiKey: apiKey });
      const allRetrievedEntities = (await reduceToFileHits(responseStream)).map(
        e => e.node.object_id,
      );
      const equivalentIndexedDocuments = allRetrievedEntities.map(
        id => allIndexedDocuments[id || ''],
      );
      const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS,
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
        (doc) =>
          doc.meta.embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
          doc.meta.study_id === TEST_PROGRAM,
      ];
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(doc =>
        validators.some(validate => validate(doc)),
      );
      expect(equivalentIndexedDocuments.length).toBe(allDocumentsThatQualify.length);
      expect(equivalentIndexedDocuments.every(doc => allDocumentsThatQualify.includes(doc))).toBe(
        true,
      );
      expect(allDocumentsThatQualify.every(doc => equivalentIndexedDocuments.includes(doc))).toBe(
        true,
      );
    });

    it('returns and all the right data for associate program members', async () => {
      const apiKey = MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER;
      const userScopes = MOCK_API_KEY_SCOPES[apiKey];
      const responseStream = fileDocumentStream({ esClient, apiKey: apiKey });
      const allRetrievedEntities = await reduceToFileHits(responseStream);
      const equivalentIndexedDocuments = allRetrievedEntities.map(
        retrievedObject => allIndexedDocuments[retrievedObject.node.object_id || ''],
      );
      const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
        (doc) =>
          doc.meta.embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS &&
          userScopes.some(scope => scope.includes(doc.meta.study_id)),
        (doc) =>
        doc.meta.embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
          userScopes.some(scope => scope.includes(doc.meta.study_id)),
      ];
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(doc =>
        validators.some(validate => validate(doc)),
      );
      expect(equivalentIndexedDocuments.length).toBe(allDocumentsThatQualify.length);
      expect(equivalentIndexedDocuments.every(doc => allDocumentsThatQualify.includes(doc))).toBe(
        true,
      );
      expect(allDocumentsThatQualify.every(doc => equivalentIndexedDocuments.includes(doc))).toBe(
        true,
      );
    });
  });

  describe('aggregation query', () => {
    it('returns and all the right data for public users', async () => {
      const aggregationResult = await aggregateAllObjectIds({
        apiKey: MOCK_API_KEYS.PUBLIC,
        esClient,
      });
      const allEntityIdsFromApi =
        aggregationResult?.file.aggregations.object_id.buckets.map(({ key }) => key) || [];
      const equivalentIndexedDocuments = allEntityIdsFromApi.map(
        id => allIndexedDocuments[id || ''],
      );
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(
        doc => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
      );
      expect(equivalentIndexedDocuments.length).toBe(allDocumentsThatQualify.length);
      expect(allDocumentsThatQualify.every(doc => equivalentIndexedDocuments.includes(doc))).toBe(
        true,
      );
      expect(equivalentIndexedDocuments.every(doc => allDocumentsThatQualify.includes(doc))).toBe(
        true,
      );
    });

    it('returns all data for DCC', async () => {
      const aggregationResult = await aggregateAllObjectIds({
        apiKey: MOCK_API_KEYS.DCC,
        esClient,
      });
      const allEntityIdsFromApi =
        aggregationResult?.file.aggregations.object_id.buckets.map(({ key }) => key) || [];
      expect(allEntityIdsFromApi.length).toBe(Object.entries(allIndexedDocuments).length);
    });

    it('returns only and all the right data for program members', async () => {
      const apiKey = MOCK_API_KEYS.FULL_PROGRAM_MEMBER;
      const userScopes = MOCK_API_KEY_SCOPES[apiKey];
      const aggregationResult = await aggregateAllObjectIds({ apiKey, esClient });
      const allObjectIdsFromApi =
        aggregationResult?.file.aggregations.object_id.buckets.map(({ key }) => key) || [];
      const equivalentIndexedDocuments = allObjectIdsFromApi.map(
        objectId => allIndexedDocuments[objectId],
      );
      const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS,
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
        (doc) =>
        doc.meta.embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
          userScopes.some(scope => scope.includes(doc.meta.study_id)),
      ];
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(doc =>
        validators.some(validate => validate(doc)),
      );
      expect(equivalentIndexedDocuments.length).toBe(allDocumentsThatQualify.length);
      expect(equivalentIndexedDocuments.every(doc => allDocumentsThatQualify.includes(doc))).toBe(
        true,
      );
      expect(allDocumentsThatQualify.every(doc => equivalentIndexedDocuments.includes(doc))).toBe(
        true,
      );
    });

    it('returns and all the right data for associate program members', async () => {
      const apiKey = MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER;
      const userScopes = MOCK_API_KEY_SCOPES[apiKey];
      const aggregationResult = await aggregateAllObjectIds({ apiKey, esClient });
      const allObjectIdsFromApi =
        aggregationResult?.file.aggregations.object_id.buckets.map(({ key }) => key) || [];
      const equivalentIndexedDocuments = allObjectIdsFromApi.map(
        objectId => allIndexedDocuments[objectId],
      );
      const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
        (doc) => doc.meta.embargo_stage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
        (doc) =>
        doc.meta.embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS &&
          userScopes.some(scope => scope.includes(doc.meta.study_id)),
        (doc) =>
        doc.meta.embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
          userScopes.some(scope => scope.includes(doc.meta.study_id)),
      ];
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(doc =>
        validators.some(validate => validate(doc)),
      );
      expect(equivalentIndexedDocuments.length).toBe(allDocumentsThatQualify.length);
      expect(equivalentIndexedDocuments.every(doc => allDocumentsThatQualify.includes(doc))).toBe(
        true,
      );
      expect(allDocumentsThatQualify.every(doc => equivalentIndexedDocuments.includes(doc))).toBe(
        true,
      );
    });
  });
});
