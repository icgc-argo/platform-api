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

const PROTO_PATH = __dirname + '/Ego.proto';
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

const getEgoAccessKeys = async (userId, Authorization) => {
  const url = `${EGO_ROOT_REST}/o/token?user_id=${userId}`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const generateEgoAccessKey = async (userId, scopes, Authorization) => {
  const url = `${EGO_ROOT_REST}/o/token?user_id=${userId}&scopes=${encodeURIComponent(
    scopes.join(),
  )}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

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

const deleteKeys = async (keys, Authorization) => {
  const accessKeys = keys.map(k => k.accessToken);
  const ps = accessKeys.map(async key => {
    const url = `${EGO_ROOT_REST}/o/token?token=${encodeURIComponent(key)}`;
    const promise = fetch(url, {
      method: 'delete',
      headers: { Authorization },
    })
      .then(resp => ({ key, success: true }))
      .catch(err => {
        logger.error(err);
        return { key, success: false };
      });
    return promise;
  });

  return Promise.all(ps);
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
    const cloudQueryUrl = queryUrl + 'cloud';

    // query param will search descriptions too, so filter on name also
    // TOOD: One query?
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

export default {
  getUser,
  listUsers,
  generateEgoAccessKey,
  getScopes,
  getEgoAccessKeys,
  deleteKeys,
  getDacoIds,
};
