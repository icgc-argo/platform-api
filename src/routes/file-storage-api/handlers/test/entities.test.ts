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
import { createEsClient } from 'services/elasticsearch';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';
import { exec } from 'child_process';
import { promisify } from 'util';
import express from 'express';
import createFileStorageApi from '../../index';
import { EgoClient } from 'services/ego';
import chai from 'chai';
import chaiHttp from 'chai-http';
import { reduce } from 'axax/es5/reduce';
import {
  createMockEgoClient,
  entitiesStream,
  getAllIndexedDocuments,
  MockApiKey,
  MOCK_API_KEYS,
  MOCK_API_KEY_SCOPES,
  reduceToEntityList,
  TEST_PROGRAM,
} from './utils';
import _ from 'lodash';
import {
  EsFileCentricDocument,
  FILE_ACCESS,
  FILE_EMBARGO_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import { SongEntity } from 'routes/file-storage-api/utils';

const asyncExec = promisify(exec);

chai.use(chaiHttp);

describe('storage-api/entities', () => {
  let esContainer: StartedTestContainer;
  let esClient: Client;
  const app = express();
  const mockEgoClient = createMockEgoClient() as EgoClient;
  let allIndexedDocuments: { [objectId: string]: EsFileCentricDocument } = {};

  beforeAll(async () => {
    esContainer = await new GenericContainer('elasticsearch', '7.5.0')
      .withExposedPorts(9200)
      .withEnv('discovery.type', 'single-node')
      .withStartupTimeout(new Duration(120, TemporalUnit.SECONDS))
      .start();
    const esHost = `http://${esContainer.getContainerIpAddress()}:${esContainer.getMappedPort(
      9200,
    )}`;
    esClient = await createEsClient({
      node: esHost,
    });
    const { stdout, stderr } = await asyncExec(
      `ES_HOST=${esHost} npm run embargoStageEsInit`,
    );
    if (stderr.length) {
      throw stderr;
    }
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
    app.use(
      '/',
      await createFileStorageApi({
        egoClient: mockEgoClient,
        rootPath: '/',
        esClient,
        downloadProxyMiddlewareFactory: () => (req, res, next) => {
          res.send('ok');
        },
      }),
    );
    allIndexedDocuments = _(await getAllIndexedDocuments(esClient)).reduce(
      (acc, doc) => {
        acc[doc.object_id] = doc;
        return acc;
      },
      {} as typeof allIndexedDocuments,
    );
  }, 120000);

  afterAll(async () => {
    await esContainer.stop();
  }, 120000);

  describe('/entities endpoint', () => {
    it('returns unique entities', async () => {
      const responseStream = entitiesStream({
        app,
        apiKey: MOCK_API_KEYS.PUBLIC,
      });
      const allRetrievedEntities = await reduceToEntityList(responseStream);
      expect(
        _(allRetrievedEntities)
          .uniqBy((e) => e.id)
          .size(),
      ).toBe(allRetrievedEntities.length);
    });

    it('returns and all the right data for public users', async () => {
      const responseStream = entitiesStream({
        app,
        apiKey: MOCK_API_KEYS.PUBLIC,
      });
      const allEntityIdsFromApi = (
        await reduceToEntityList(responseStream)
      ).map((e) => e.id);
      const equivalentIndexedDocuments = allEntityIdsFromApi.map(
        (id) => allIndexedDocuments[id || ''],
      );
      const allDocumentsThatQualify = Object.values(allIndexedDocuments).filter(
        (doc) => doc.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
      );
      expect(equivalentIndexedDocuments.length).toBe(
        allDocumentsThatQualify.length,
      );
      expect(
        allDocumentsThatQualify.every((doc) =>
          equivalentIndexedDocuments.includes(doc),
        ),
      ).toBe(true);
      expect(
        equivalentIndexedDocuments.every((doc) =>
          allDocumentsThatQualify.includes(doc),
        ),
      ).toBe(true);
    });

    it('returns all data for DCC', async () => {
      const responseStream = entitiesStream({ app, apiKey: MOCK_API_KEYS.DCC });
      const allRetrievedEntities = await reduceToEntityList(responseStream);
      expect(allRetrievedEntities.length).toBe(
        Object.entries(allIndexedDocuments).length,
      );
    });

    it('returns and all the right data for program members', async () => {
      const apiKey = MOCK_API_KEYS.FULL_PROGRAM_MEMBER;
      const userScopes = MOCK_API_KEY_SCOPES[apiKey];
      const responseStream = entitiesStream({ app, apiKey: apiKey });
      const allRetrievedEntities = await reduceToEntityList(responseStream);
      const equivalentIndexedDocuments = allRetrievedEntities.map(
        (retrievedObject) => allIndexedDocuments[retrievedObject.id || ''],
      );
      const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
        ({ embargo_stage }) => embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
        ({ embargo_stage }) =>
          embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS,
        ({ embargo_stage }) =>
          embargo_stage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
        ({ study_id, embargo_stage }) =>
          embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
          userScopes.some((scope) => scope.includes(study_id)),
      ];
      const allDocumentsThatQualify = Object.values(
        allIndexedDocuments,
      ).filter((doc) => validators.some((validate) => validate(doc)));
      expect(equivalentIndexedDocuments.length).toBe(
        allDocumentsThatQualify.length,
      );
      expect(
        equivalentIndexedDocuments.every((doc) =>
          allDocumentsThatQualify.includes(doc),
        ),
      ).toBe(true);
      expect(
        allDocumentsThatQualify.every((doc) =>
          equivalentIndexedDocuments.includes(doc),
        ),
      ).toBe(true);
    });

    it('returns and all the right data for associate program members', async () => {
      const apiKey = MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER;
      const userScopes = MOCK_API_KEY_SCOPES[apiKey];
      const responseStream = entitiesStream({ app, apiKey: apiKey });
      const allRetrievedEntities = await reduceToEntityList(responseStream);
      const equivalentIndexedDocuments = allRetrievedEntities.map(
        (retrievedObject) => allIndexedDocuments[retrievedObject.id || ''],
      );
      const validators: ((doc: EsFileCentricDocument) => boolean)[] = [
        ({ embargo_stage }) => embargo_stage === FILE_EMBARGO_STAGE.PUBLIC,
        ({ embargo_stage }) =>
          embargo_stage === FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
        ({ study_id, embargo_stage }) =>
          embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS &&
          userScopes.some((scope) => scope.includes(study_id)),
        ({ study_id, embargo_stage }) =>
          embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
          userScopes.some((scope) => scope.includes(study_id)),
      ];
      const allDocumentsThatQualify = Object.values(
        allIndexedDocuments,
      ).filter((doc) => validators.some((validate) => validate(doc)));
      expect(equivalentIndexedDocuments.length).toBe(
        allDocumentsThatQualify.length,
      );
      expect(
        equivalentIndexedDocuments.every((doc) =>
          allDocumentsThatQualify.includes(doc),
        ),
      ).toBe(true);
      expect(
        allDocumentsThatQualify.every((doc) =>
          equivalentIndexedDocuments.includes(doc),
        ),
      ).toBe(true);
    });
  });
});
