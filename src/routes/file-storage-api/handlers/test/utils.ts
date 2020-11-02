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

import { Express } from 'express';
import { EgoClient } from 'services/ego';
import chai from 'chai';
import chaiHttp from 'chai-http';
import { EntitiesPageResponseBody } from '../entitiesHandler';
import { Client } from '@elastic/elasticsearch';
import esb from 'elastic-builder';
import { FILE_METADATA_FIELDS } from 'utils/commonTypes/EsFileCentricDocument';
import { EsHits } from 'services/elasticsearch';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument.ts';
import { reduce } from 'axax/es5/reduce';
import _ from 'lodash';

chai.use(chaiHttp);

export const entitiesStream = async function*({
  app,
  apiKey,
}: {
  app: Express;
  apiKey: MockApiKey;
}) {
  let currentPage = 0;
  const pageSize = 1000;
  cycle: while (true) {
    const pageData = await chai
      .request(app)
      .get(`/entities?page=${currentPage}&size=${pageSize}`)
      .set('authorization', `Bearer ${MOCK_API_KEYS[apiKey]}`)
      .then(response => response.body as EntitiesPageResponseBody);

    if (!pageData.content) {
      console.log('no pageData.content: ', pageData);
      throw new Error('boo');
    }
    if (pageData.content.length > 0) {
      currentPage++;
      yield pageData;
    } else {
      break cycle;
    }
  }
};

export const reduceToEntityList = (stream: ReturnType<typeof entitiesStream>) =>
  reduce<EntitiesPageResponseBody, EntitiesPageResponseBody['content']>((acc, r) => {
    r.content.forEach(e => {
      acc.push(e);
    });
    return acc;
  }, [])(stream);

const esDocumentStream = async function*({ esClient }: { esClient: Client }) {
  let currentIndex = 0;
  const pageSize = 1000;
  cycle: while (true) {
    const pageData = await esClient
      .search({
        index: 'file_centric',
        body: esb
          .requestBodySearch()
          .sorts([esb.sort(FILE_METADATA_FIELDS['object_id'])])
          .from(currentIndex)
          .size(pageSize),
      })
      .then(r => r.body as EsHits<EsFileCentricDocument>);
    if (pageData.hits.hits.length > 0) {
      yield pageData.hits.hits.map(h => h._source);
      currentIndex += pageSize;
    } else {
      break cycle;
    }
  }
};

export const getAllIndexedDocuments = (esClient: Client) =>
  reduce<EsFileCentricDocument[], EsFileCentricDocument[]>((acc, chunk) => {
    chunk.forEach(doc => acc.push(doc));
    return acc;
  }, [])(esDocumentStream({ esClient }));

export const MOCK_API_KEYS = {
  PUBLIC: 'PUBLIC' as 'PUBLIC',
  FULL_PROGRAM_MEMBER: 'FULL_PROGRAM_MEMBER' as 'FULL_PROGRAM_MEMBER',
  ASSOCIATE_PROGRAM_MEMBER: 'ASSOCIATE_PROGRAM_MEMBER' as 'ASSOCIATE_PROGRAM_MEMBER',
  DCC: 'DCC' as 'DCC',
};
export type MockApiKey = keyof typeof MOCK_API_KEYS;
export const MOCK_API_KEY_SCOPES: {
  [k in MockApiKey]: string[];
} = {
  PUBLIC: [],
  FULL_PROGRAM_MEMBER: ['PROGRAMMEMBERSHIP-FULL.READ', 'PROGRAMDATA-DASH-CA.READ'],
  ASSOCIATE_PROGRAM_MEMBER: ['PROGRAMMEMBERSHIP-ASSOCIATE.READ', 'PROGRAMDATA-DASH-CA.READ'],
  DCC: [
    'song.WRITE',
    'score.WRITE',
    'PROGRAMSERVICE.WRITE',
    'FILES-SVC.WRITE',
    'DICTIONARY.WRITE',
    'CLINICALSERVICE.WRITE',
  ],
};

export const createMockEgoClient = (): Partial<EgoClient> => {
  const mockEgoClient = {
    checkApiKey: ({ apiKey }: { apiKey: MockApiKey }) =>
      Promise.resolve({
        client_id: 'test',
        exp: Infinity,
        scope: MOCK_API_KEY_SCOPES[apiKey],
        user_name: 'yup',
      }),
  };
  return mockEgoClient;
};
