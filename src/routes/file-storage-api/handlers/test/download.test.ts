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
  FILE_RELEASE_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import { SongEntity } from 'routes/file-storage-api/utils';

const asyncExec = promisify(exec);

chai.use(chaiHttp);

describe('storage-api/download', () => {
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
    const { stdout, stderr } = await asyncExec(`ES_HOST=${esHost} npm run releaseStageEsInit`);
    if (stderr.length) {
      throw stderr;
    }
    await new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
    app.use(
      '/',
      createFileStorageApi({
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

  describe('/download endpoint', () => {
    const fetchDownload = ({ apiKey, objectId }: { apiKey?: MockApiKey; objectId: string }) => {
      const requestPromise = chai.request(app).get(`/download/${objectId}`);
      return (apiKey
        ? requestPromise.set('authorization', `Bearer ${MOCK_API_KEYS[apiKey]}`)
        : requestPromise
      ).then(response => {
        if (response.body !== 'ok') {
          throw response.error;
        }
        return response.body as 'ok';
      });
    };
    const downloadableStream = async function*({
      apiKey,
      objectIds,
    }: {
      apiKey?: MockApiKey;
      objectIds: string[];
    }) {
      for await (const chunk of _.chunk(objectIds, 5)) {
        const data = await Promise.all(
          chunk.map(objectId => fetchDownload({ apiKey, objectId }).catch(err => null)),
        );
        yield data.filter(entry => !!entry) as ('ok' | null)[];
      }
    };
    const reduceToList = (stream: ReturnType<typeof downloadableStream>) =>
      reduce<('ok' | null)[], ('ok' | null)[]>((acc, r) => {
        r.forEach(entity => acc.push(entity));
        return acc;
      }, [])(stream);

    describe('for unauthenticated users', () => {
      it('allows downloading publicly released file with open access', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments)
          .filter(
            doc =>
              doc.release_stage === FILE_RELEASE_STAGE.PUBLIC &&
              doc.file_access === FILE_ACCESS.OPEN,
          )
          .map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
          }),
        );
        expect(downloadResults.every(result => result === 'ok')).toBe(true);
      });
      it('does not allow download of files that are not publicly released', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments)
          .filter(doc => doc.release_stage !== FILE_RELEASE_STAGE.PUBLIC)
          .map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
          }),
        );
        expect(downloadResults.every(result => result === null)).toBe(true);
      });
      it('does not allow download of files that have controlled access', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments)
          .filter(doc => doc.file_access === FILE_ACCESS.CONTROLLED)
          .map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
          }),
        );
        expect(downloadResults.every(result => result === null)).toBe(true);
      });
      it('throws the right error for publicly released controlled files', async () => {
        let error = null;
        try {
          await fetchDownload({
            objectId: 'dcfcd6ed-7d8c-57b1-8d85-d75cf8f4a301',
          });
        } catch (err) {
          error = err;
        }
        expect(error).toBeTruthy();
        expect(error.status).toBe(401);
      });
    });

    describe('for authenticated public users', () => {
      it('allows downloading publicly released file with open access', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments)
          .filter(
            doc =>
              doc.release_stage === FILE_RELEASE_STAGE.PUBLIC &&
              doc.file_access === FILE_ACCESS.OPEN,
          )
          .map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
            apiKey: MOCK_API_KEYS.PUBLIC,
          }),
        );
        expect(downloadResults.every(result => result === 'ok')).toBe(true);
      });
      it('does not allow download of files that are not publicly released', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments)
          .filter(doc => doc.release_stage !== FILE_RELEASE_STAGE.PUBLIC)
          .map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
            apiKey: MOCK_API_KEYS.PUBLIC,
          }),
        );
        expect(downloadResults.every(result => result === null)).toBe(true);
      });
      it('does not allow download of files that have controlled access', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments)
          .filter(doc => doc.file_access === FILE_ACCESS.CONTROLLED)
          .map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
            apiKey: MOCK_API_KEYS.PUBLIC,
          }),
        );
        expect(downloadResults.every(result => result === null)).toBe(true);
      });
      it('throws the right error for publicly released controlled files', async () => {
        let error = null;
        try {
          await fetchDownload({
            objectId: 'dcfcd6ed-7d8c-57b1-8d85-d75cf8f4a301',
            apiKey: MOCK_API_KEYS.PUBLIC,
          });
        } catch (err) {
          error = err;
        }
        expect(error).toBeTruthy();
        expect(error.status).toBe(403);
      });
    });

    describe('for dcc users', () => {
      it('allows downloading everything', async () => {
        const expectedRetrieableIds = Object.values(allIndexedDocuments).map(doc => doc.object_id);
        const downloadResults = await reduceToList(
          downloadableStream({
            objectIds: expectedRetrieableIds,
            apiKey: MOCK_API_KEYS.DCC,
          }),
        );
        expect(downloadResults.every(result => result === 'ok')).toBe(true);
      });
    });

    describe('for full program members', () => {
      // this is a function because `describe` callback happens before test run
      const getExpectedRetrievableIds = () =>
        Object.values(allIndexedDocuments)
          .filter(
            obj =>
              [
                FILE_RELEASE_STAGE.FULL_PROGRAMS,
                FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS,
                FILE_RELEASE_STAGE.PUBLIC,
                FILE_RELEASE_STAGE.PUBLIC_QUEUE,
              ].includes(obj.release_stage) ||
              (obj.release_stage === FILE_RELEASE_STAGE.OWN_PROGRAM &&
                obj.study_id === TEST_PROGRAM),
          )
          .map(doc => doc.object_id);
      it('returns all the file the user can access', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToList(
          downloadableStream({
            apiKey: MOCK_API_KEYS.FULL_PROGRAM_MEMBER,
            objectIds: Object.keys(expectedRetrievableIds),
          }),
        );
        expect(allEntitiesRetrievable.every(response => response === 'ok')).toBe(true);
      });
      it('does not return the files users cannot access', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToList(
          downloadableStream({
            apiKey: MOCK_API_KEYS.FULL_PROGRAM_MEMBER,
            objectIds: Object.keys(allIndexedDocuments).filter(
              id => !expectedRetrievableIds.includes(id),
            ),
          }),
        );
        expect(allEntitiesRetrievable.every(response => response === null)).toBe(true);
      });

      it('throws the right error when user access an unreleased file from another program', async () => {
        let error;
        try {
          await fetchDownload({
            objectId: '82232d81-7960-5eca-8b3c-1cf4d403b128',
            apiKey: MOCK_API_KEYS.FULL_PROGRAM_MEMBER,
          });
        } catch (err) {
          error = err;
        }
        expect(error).toBeTruthy();
        expect(error.status).toBe(403);
      });
    });

    describe('for associate program members', () => {
      // this is a function because `describe` callback happens before test run
      const getExpectedRetrievableIds = () =>
        Object.values(allIndexedDocuments)
          .filter(
            obj =>
              [
                FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS,
                FILE_RELEASE_STAGE.PUBLIC_QUEUE,
                FILE_RELEASE_STAGE.PUBLIC,
              ].includes(obj.release_stage) ||
              (obj.release_stage === FILE_RELEASE_STAGE.OWN_PROGRAM &&
                obj.study_id === TEST_PROGRAM) ||
              (obj.release_stage === FILE_RELEASE_STAGE.FULL_PROGRAMS &&
                obj.study_id === TEST_PROGRAM),
          )
          .map(doc => doc.object_id);
      it('returns all the file the user can access', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToList(
          downloadableStream({
            apiKey: MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER,
            objectIds: Object.keys(expectedRetrievableIds),
          }),
        );
        expect(allEntitiesRetrievable.every(response => response === 'ok')).toBe(true);
      });
      it('does not return the files users cannot access', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToList(
          downloadableStream({
            apiKey: MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER,
            objectIds: Object.keys(allIndexedDocuments).filter(
              id => !expectedRetrievableIds.includes(id),
            ),
          }),
        );
        expect(allEntitiesRetrievable.every(response => response === null)).toBe(true);
      });

      it('throws the right error when user access an unreleased file from another program', async () => {
        let error;
        try {
          await fetchDownload({
            objectId: '82232d81-7960-5eca-8b3c-1cf4d403b128',
            apiKey: MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER,
          });
        } catch (err) {
          error = err;
        }
        expect(error).toBeTruthy();
        expect(error.status).toBe(403);
      });
    });
  });
});
