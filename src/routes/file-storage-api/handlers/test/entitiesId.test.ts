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

describe('storage-api/entities/{id}', () => {
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
    const { stdout, stderr } = await asyncExec(`ES_HOST=${esHost} npm run embargoStageEsInit`);
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

  describe('/entities/{id} endpoint', () => {
    const fetchEntity = ({ apiKey, objectId }: { apiKey?: MockApiKey; objectId: string }) => {
      const requestPromise = chai.request(app).get(`/entities/${objectId}`);
      return (apiKey
        ? requestPromise.set('authorization', `Bearer ${MOCK_API_KEYS[apiKey]}`)
        : requestPromise
      ).then(response => {
        if (!response.body.id) {
          throw response.error;
        }
        return response.body as SongEntity;
      });
    };
    const retrievableObjectStream = async function*({
      apiKey,
      objectIds,
    }: {
      apiKey?: MockApiKey;
      objectIds: string[];
    }) {
      for await (const chunk of _.chunk(objectIds, 5)) {
        const data = await Promise.all(
          chunk.map(objectId => fetchEntity({ apiKey, objectId }).catch(err => null)),
        );
        yield data.filter(entry => !!entry) as SongEntity[];
      }
    };
    const reduceToEntityList = (stream: ReturnType<typeof retrievableObjectStream>) =>
      reduce<(SongEntity)[], (SongEntity)[]>((acc, r) => {
        r.forEach(entity => acc.push(entity));
        return acc;
      }, [])(stream);

    describe('for DCC users', () => {
      it('returns all data for dcc members', async () => {
        const allEntitiesRetrievable = await reduceToEntityList(
          retrievableObjectStream({
            apiKey: MOCK_API_KEYS.DCC,
            objectIds: Object.keys(allIndexedDocuments),
          }),
        );
        expect(allEntitiesRetrievable.length).toBe(_.size(allIndexedDocuments));
        expect(
          allEntitiesRetrievable
            .map(obj => (obj as SongEntity).id)
            .every(id => Object.keys(allIndexedDocuments).includes(id)),
        );
      });
    });

    describe('for public users', () => {
      // this is a function because `describe` callback happens before test run
      const getExpectedRetrievableIds = () =>
        Object.values(allIndexedDocuments)
          .filter(obj => obj.embargo_stage === FILE_EMBARGO_STAGE.PUBLIC)
          .map(doc => doc.object_id);

      it('returns all the publicly released data for authenticated users', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToEntityList(
          retrievableObjectStream({
            apiKey: MOCK_API_KEYS.PUBLIC,
            objectIds: Object.keys(allIndexedDocuments),
          }),
        );
        const allRetrievedIds = allEntitiesRetrievable.map(obj => (obj as SongEntity).id);
        expect(allRetrievedIds.every(id => expectedRetrievableIds.includes(id))).toBe(true);
        expect(expectedRetrievableIds.every(id => allRetrievedIds.includes(id))).toBe(true);
      });

      it('throws the right error when unauthenticated user requests unauthorized file', async () => {
        let error;
        try {
          await fetchEntity({
            objectId: '82232d81-7960-5eca-8b3c-1cf4d403b128',
          });
        } catch (err) {
          error = err;
        }
        expect(error).toBeTruthy();
        expect(error.status).toBe(401);
      });

      it('returns all the publicly released data for unauthenticated users', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToEntityList(
          retrievableObjectStream({ objectIds: Object.keys(allIndexedDocuments) }),
        );
        const allRetrievedIds = allEntitiesRetrievable.map(obj => (obj as SongEntity).id);
        expect(allRetrievedIds.every(id => expectedRetrievableIds.includes(id))).toBe(true);
        expect(expectedRetrievableIds.every(id => allRetrievedIds.includes(id))).toBe(true);
      });

      it('throws the right error when authenticated user requests unauthorized file', async () => {
        let error;
        try {
          await fetchEntity({
            objectId: '82232d81-7960-5eca-8b3c-1cf4d403b128',
            apiKey: MOCK_API_KEYS.PUBLIC,
          });
        } catch (err) {
          error = err;
        }
        expect(error).toBeTruthy();
        expect(error.status).toBe(403);
      });
    });

    describe('for full program members', () => {
      // this is a function because `describe` callback happens before test run
      const getExpectedRetrievableIds = () =>
        Object.values(allIndexedDocuments)
          .filter(
            obj =>
              [
                FILE_EMBARGO_STAGE.FULL_PROGRAMS,
                FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS,
                FILE_EMBARGO_STAGE.PUBLIC,
              ].includes(obj.embargo_stage) ||
              (obj.embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
                obj.study_id === TEST_PROGRAM),
          )
          .map(doc => doc.object_id);
      it('returns all and only the file the user can access', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToEntityList(
          retrievableObjectStream({
            apiKey: MOCK_API_KEYS.FULL_PROGRAM_MEMBER,
            objectIds: Object.keys(allIndexedDocuments),
          }),
        );
        const allRetrievedIds = allEntitiesRetrievable.map(obj => (obj as SongEntity).id);
        expect(allRetrievedIds.every(id => expectedRetrievableIds.includes(id))).toBe(true);
        expect(expectedRetrievableIds.every(id => allRetrievedIds.includes(id))).toBe(true);
      });

      it('throws the right error when user access an unreleased file from another program', async () => {
        let error;
        try {
          await fetchEntity({
            objectId: '82232d81-7960-5eca-8b3c-1cf4d403b128',
            apiKey: MOCK_API_KEYS.PUBLIC,
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
              [FILE_EMBARGO_STAGE.ASSOCIATE_PROGRAMS, FILE_EMBARGO_STAGE.PUBLIC].includes(
                obj.embargo_stage,
              ) ||
              (obj.embargo_stage === FILE_EMBARGO_STAGE.OWN_PROGRAM &&
                obj.study_id === TEST_PROGRAM) ||
              (obj.embargo_stage === FILE_EMBARGO_STAGE.FULL_PROGRAMS &&
                obj.study_id === TEST_PROGRAM),
          )
          .map(doc => doc.object_id);
      it('returns all and only the file the user can access', async () => {
        const expectedRetrievableIds = getExpectedRetrievableIds();
        const allEntitiesRetrievable = await reduceToEntityList(
          retrievableObjectStream({
            apiKey: MOCK_API_KEYS.ASSOCIATE_PROGRAM_MEMBER,
            objectIds: Object.keys(allIndexedDocuments),
          }),
        );
        const allRetrievedIds = allEntitiesRetrievable.map(obj => (obj as SongEntity).id);
        expect(allRetrievedIds.length).toBe(expectedRetrievableIds.length);
        expect(allRetrievedIds.every(id => expectedRetrievableIds.includes(id))).toBe(true);
        expect(expectedRetrievableIds.every(id => allRetrievedIds.includes(id))).toBe(true);
      });

      it('throws the right error when user access an unreleased file from another program', async () => {
        let error;
        try {
          await fetchEntity({
            objectId: '82232d81-7960-5eca-8b3c-1cf4d403b128',
            apiKey: MOCK_API_KEYS.PUBLIC,
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
