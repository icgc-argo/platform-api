/*
 * This file dynamically generates a gRPC client from Ego.proto.
 * The content of Ego.proto is copied directly from: https://github.com/overture-stack/ego/blob/develop/src/main/proto/Ego.proto
 */
import grpc from 'grpc';
import * as loader from '@grpc/proto-loader';
import { EGO_ROOT_GRPC, EGO_ROOT_REST } from '../../config';
import { getAuthMeta, withRetries, defaultPromiseCallback } from '../../utils/grpcUtils';
import fetch, { Response } from 'node-fetch';
import { restErrorResponseHandler } from '../../utils/restUtils';
import logger from '../../utils/logger';
import memoize from 'lodash/memoize';
import chunk from 'lodash/chunk';
import range from 'lodash/range';
import urlJoin from 'url-join';

const PROTO_PATH = __dirname + '/Ego.proto';
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
 * @param {string} userId
 * @param {string} Authorization
 * @returns {Promise<Array<EgoAccessKeyResponse>>}
 */
const getEgoAccessKeys = async (userId, Authorization) => {
  const RESULT_SET_KEY = 'resultSet';
  const COUNT_KEY = 'count';

  const pageSize = 10;
  const firstResponse = await fetch(urlJoin(EGO_API_KEY_ENDPOINT, `?user_id=${userId}`), {
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  const totalCount = firstResponse[COUNT_KEY];
  const firstResult = firstResponse[RESULT_SET_KEY];
  const remainingPageIndices = chunk(range(firstResult.length, totalCount), pageSize).map(
    ([pageIndex]) => pageIndex,
  );
  const remainingResponses = await Promise.all(
    remainingPageIndices.map(async pageIndex => {
      const data = await fetch(
        urlJoin(EGO_API_KEY_ENDPOINT, `?user_id=${userId}&limit=${pageSize}&offset=${pageIndex}`),
        {
          headers: { Authorization },
        },
      )
        .then(restErrorResponseHandler)
        .then(response => response.json());
      return data;
    }),
  );
  const remainingResults = remainingResponses
    .map(x => x[RESULT_SET_KEY]) // x[RESULT_SET_KEY] is an array, hence reducing to flatmap
    .reduce((acc, keyObjs) => [...acc, ...keyObjs], []);

  return [firstResult, ...remainingResults].filter(({ isRevoked }) => !isRevoked);
};

/**
 * @param {string} userId
 * @param {Array<string>} scopes
 * @param {string} Authorization
 * @returns {Promise<EgoAccessKeyResponse>}
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
 * @param { EgoAccessKeyResponse[] } keys
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

export default {
  getUser,
  listUsers,
  generateEgoAccessKey,
  getScopes,
  getEgoAccessKeys,
  deleteKeys,
  getDacoIds,
  toTimestamp,
};
