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
import initArrangerMetadata, {
  ARRANGER_PROJECT_METADATA_INDEX,
  ARRANGER_PROJECTS_INDEX,
  harmonizedFileCentricConfig,
} from '../initArrangerMetadata';
import { createEsClient } from 'services/elasticsearch';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';
import { Client } from '@elastic/elasticsearch';
import getArrangerGqlSchema from '..';
import { ARRANGER_FILE_CENTRIC_INDEX, ARRANGER_PROJECT_ID } from 'config';
import metadata from 'resources/arranger_es_metadata.json';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EsFileCentricDocument, FILE_RELEASE_STAGE } from 'utils/commonTypes/EsFileCentricDocument';
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { createTestClient } from 'apollo-server-testing';
import {
  getAllIndexedDocuments,
  MOCK_API_KEYS,
  MOCK_API_KEY_SCOPES,
} from 'routes/file-storage-api/handlers/test/utils';
import { fileDocumentStream, reduceToFileHits } from './utils';
import _ from 'lodash';

const asyncExec = promisify(exec);

describe('Arranger schema', () => {
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
  }, 120000);
  afterAll(async () => {
    await esContainer.stop();
  }, 120000);

  describe('initArrangerMetadata', () => {
    it('indices must exist after run', async () => {
      await initArrangerMetadata(esClient);
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECT_METADATA_INDEX })).body).toBe(
        true,
      );
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX })).body).toBe(true);
    });

    it('must handle another run without failing', async () => {
      expect(initArrangerMetadata(esClient)).resolves.toBeDefined();
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECT_METADATA_INDEX })).body).toBe(
        true,
      );
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX })).body).toBe(true);
    });

    it('must index data properly', async () => {
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
        })).body._source,
      ).toEqual(metadata.projectManifest);
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })).body._source,
      ).toEqual(harmonizedFileCentricConfig);
    });

    it('must handle parallel runs without failing', async () => {
      // simulates horizontal scale
      expect(
        Promise.all([
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
        ]),
      ).resolves.toBeDefined();
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
        })).body._source,
      ).toEqual(metadata.projectManifest);
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })).body._source,
      ).toEqual(harmonizedFileCentricConfig);
    });

    it('must index data using ARRANGER_FILE_CENTRIC_INDEX config', async () => {
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })).body._source.index,
      ).toEqual(ARRANGER_FILE_CENTRIC_INDEX);
    });
  });

  describe('getArrangerGqlSchema', () => {
    it('generates arranger schema with "file" type', async () => {
      try {
        const arrangerSchema = await getArrangerGqlSchema(esClient);
        expect(arrangerSchema.getType(harmonizedFileCentricConfig.name)?.toString()).toBe(
          harmonizedFileCentricConfig.name,
        );
      } catch (err) {
        throw err;
      }
    });
  });

  describe.only('metadata access control', () => {
    let allIndexedDocuments: { [objectId: string]: EsFileCentricDocument } = {};

    beforeAll(async () => {
      const { stdout, stderr } = await asyncExec(`ES_HOST=${esHost} npm run releaseStageEsInit`);
      if (stderr.length) {
        throw stderr;
      }
      await new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 10000);
      });

      allIndexedDocuments = _(await getAllIndexedDocuments(esClient)).reduce(
        (acc, doc) => {
          acc[doc.object_id] = doc;
          return acc;
        },
        {} as typeof allIndexedDocuments,
      );
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
      }, 240000);

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
          doc => doc.release_stage === FILE_RELEASE_STAGE.PUBLIC,
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

      it('returns and all the right data for program members', async () => {
        const apiKey = MOCK_API_KEYS.FULL_PROGRAM_MEMBER;
        const userScopes = MOCK_API_KEY_SCOPES[apiKey];
        const responseStream = fileDocumentStream({ esClient, apiKey: apiKey });
        const allRetrievedEntities = await reduceToFileHits(responseStream);
        const equivalentIndexedDocuments = allRetrievedEntities.map(
          retrievedObject => allIndexedDocuments[retrievedObject.node.object_id || ''],
        );
        const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.PUBLIC,
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.PUBLIC_QUEUE,
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.FULL_PROGRAMS,
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS,
          ({ study_id, release_stage }) =>
            release_stage === FILE_RELEASE_STAGE.OWN_PROGRAM &&
            userScopes.some(scope => scope.includes(study_id)),
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
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.PUBLIC,
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.PUBLIC_QUEUE,
          ({ release_stage }) => release_stage === FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS,
          ({ study_id, release_stage }) =>
            release_stage === FILE_RELEASE_STAGE.FULL_PROGRAMS &&
            userScopes.some(scope => scope.includes(study_id)),
          ({ study_id, release_stage }) =>
            release_stage === FILE_RELEASE_STAGE.OWN_PROGRAM &&
            userScopes.some(scope => scope.includes(study_id)),
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
});
