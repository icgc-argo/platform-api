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

/*
 * This file dynamically generates a gRPC client from Ego.proto.
 * The content of Ego.proto is copied directly from: https://github.com/overture-stack/ego/blob/develop/src/main/proto/Ego.proto
 */
import grpc from 'grpc';
import * as loader from '@grpc/proto-loader';
import { EGO_ROOT_GRPC, EGO_ROOT_REST, APP_DIR } from '../../config';
import { getAuthMeta, withRetries, defaultPromiseCallback } from '../../utils/grpcUtils';
import fetch from 'node-fetch';
import { restErrorResponseHandler } from '../../utils/restUtils';
import logger from '../../utils/logger';
import memoize from 'lodash/memoize';
import urlJoin from 'url-join';
import path from 'path';

const PROTO_PATH = path.join(APP_DIR, '/resources/Ego.proto');

const EGO_API_KEY_ENDPOINT = urlJoin(EGO_ROOT_REST, '/o/api_key');
const packageDefinition = loader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition).bio.overture.ego.grpc;

const userService = withRetries(
  new proto.UserService(EGO_ROOT_GRPC, grpc.credentials.createInsecure()),
);

let memoizedGetDacoIds = null;
let dacoIdsCalled = new Date();
const dacoGroupIdExpiry = 86400000; // 24hours

const getUser = async (id, jwt = null) => {
  return await new Promise((resolve, reject) => {
    userService.getUser(
      { id },
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'Ego.getUser'),
    );
  });
};

const listUsers = async ({ pageNum, limit, sort, groups, query } = {}, jwt = null) => {
  const payload = {
    page: { page_number: pageNum, page_size: limit, sort },
    group_ids: groups,
    query: { value: query },
  };

  return await new Promise((resolve, reject) => {
    userService.listUsers(
      payload,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'Ego.listUsers'),
    );
  });
};

/**
 * @typedef {{ name: string; expiryDate: string; description: string; scope: string[], isRevoked: boolean, issueDate: string }} EgoAccessKeyObj
 * @param {string} userId
 * @param {string} Authorization
 * @returns {Promise<Array<EgoAccessKeyObj>>}
 */
const getEgoAccessKeys = async (userId, Authorization) => {
  const RESULT_SET_KEY = 'resultSet';
  const COUNT_KEY = 'count';
  const firstResponse = await fetch(urlJoin(EGO_API_KEY_ENDPOINT, `?user_id=${userId}`), {
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  const totalCount = firstResponse[COUNT_KEY];
  const firstResults = firstResponse[RESULT_SET_KEY];
  const remainingPageIndex = firstResults.length;
  const remainingResponse = await fetch(
    urlJoin(
      EGO_API_KEY_ENDPOINT,
      `?user_id=${userId}&limit=${totalCount - remainingPageIndex}&offset=${remainingPageIndex}`,
    ),
    {
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response.json());

  const remainingResults = remainingResponse[RESULT_SET_KEY];

  return [...firstResults, ...remainingResults].filter(({ isRevoked }) => !isRevoked);
};

/**
 * @param {string} userId
 * @param {Array<string>} scopes
 * @param {string} Authorization
 * @returns {Promise<EgoAccessKeyObj>}
 */
const generateEgoAccessKey = async (userId, scopes, Authorization) => {
  const url = urlJoin(
    EGO_API_KEY_ENDPOINT,
    `?user_id=${userId}&scopes=${encodeURIComponent(scopes.join())}`,
  );
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

/**
 *
 * @param {string} userName
 * @param {string} Authorization
 * @returns {Promise<{scopes: string[]}>}
 */
const getScopes = async (userName, Authorization) => {
  const url = `${EGO_ROOT_REST}/o/scopes?userName=${userName}`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

/**
 * @param { EgoAccessKeyObj[] } keys
 * @param {string} Authorization
 * @returns {Promise<{key: string; success: boolean}[]> | null}
 */
const deleteKeys = async (keys, Authorization) => {
  const accessKeys = keys.map(k => k.name);
  const ps = await Promise.all(
    accessKeys.map(async key => {
      const url = urlJoin(EGO_API_KEY_ENDPOINT, `?apiKey=${encodeURIComponent(key)}`);
      return fetch(url, {
        method: 'delete',
        headers: { Authorization },
      })
        .then(resp => ({ key, success: true }))
        .catch(err => {
          logger.error(err);
          return { key, success: false };
        });
    }),
  );
  return ps;
};

// check for new group id over 24hours otherwise use memo func
const getDacoIds = (userId, Authorization) => {
  const checkIdExpiry = new Date() - dacoIdsCalled >= dacoGroupIdExpiry;
  if (!memoizedGetDacoIds || checkIdExpiry) {
    memoizedGetDacoIds = getMemoizedDacoIds();
    dacoIdsCalled = new Date();
  }

  return memoizedGetDacoIds(userId, Authorization);
};

const getMemoizedDacoIds = () =>
  memoize(async (userId, Authorization) => {
    const queryUrl = `${EGO_ROOT_REST}/groups?query=`;
    const dacoQueryUrl = queryUrl + 'daco';

    // query param will search descriptions too, so filter on name also
    const response = await fetch(dacoQueryUrl, {
      method: 'get',
      headers: { Authorization },
    })
      .then(resp => resp.json())
      .then(({ resultSet = [] }) => resultSet.filter(data => data.name === 'DACO'))
      .then(group => {
        if (group.length === 0) {
          throw new Error('DACO group id not found');
        } else {
          return group[0].id;
        }
      })
      .catch(err => {
        logger.error(err);
        return null;
      });
    return response;
  });

/**
 * @param {string} str
 */
const toTimestamp = str => Math.round(new Date(str).getTime() / 1000);

/**
 * @param {EgoAccessKeyObj} accessKeyObj
 * @returns {number}
 */
const getTimeToExpiry = accessKeyObj => {
  return toTimestamp(accessKeyObj.expiryDate) - Math.round(Date.now() / 1000);
};

export default {
  getUser,
  listUsers,
  generateEgoAccessKey,
  getScopes,
  getEgoAccessKeys,
  deleteKeys,
  getDacoIds,
  getTimeToExpiry,
};
