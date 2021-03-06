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

import grpc from 'grpc';
import retry from 'retry';
import mapKeys from 'lodash/mapKeys';
import camelCase from 'lodash/camelCase';
import transform from 'lodash/transform';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import keys from 'lodash/keys';
import has from 'lodash/has';
import logger from './logger';

/* When building gRPC requests we frequently need to provide a value as:
 * { value: "asdf" }
 */
export const wrapValue = value => ({
  value,
});

export const getAuthMeta = jwt => {
  const meta = new grpc.Metadata();

  if (jwt) {
    meta.add('jwt', jwt);
  }

  return meta;
};

export const defaultPromiseCallback = (resolve, reject, serviceName) => (err, response) => {
  if (err) {
    logger.error(`GRPC error - ${serviceName}: ${err}`);
    reject(err);
  }
  resolve(response);
};

export const getGrpcMethodsNames = grpcService =>
  Object.getOwnPropertyNames(grpcService.__proto__).filter(
    name => !(name.search(/^\$/) > -1 || name === 'constructor'),
  );

export const withRetries = (
  grpcClient,
  retryConfig = {
    retries: 5,
    factor: 3,
    minTimeout: 1 * 1000,
    maxTimeout: 60 * 1000,
    randomize: true,
  },
  errorCodes = [],
) => {
  const STREAM_REMOVED_CODE = 2;
  const STREAM_REMOVED_DETAILS = 'Stream removed';
  const methodNames = getGrpcMethodsNames(grpcClient).reduce(
    //converts to a hasmap for run-time performance
    (acc, methodName) => ({
      ...acc,
      [methodName]: methodName,
    }),
    {},
  );
  const methodWithRetry = (methodName, originalMethod) => (payload, metadata, cb) => {
    const operation = retry.operation(retryConfig);
    operation.attempt(currentAttempt => {
      originalMethod(payload, metadata, (err, response) => {
        if (
          err &&
          err.code === STREAM_REMOVED_CODE &&
          err.details === STREAM_REMOVED_DETAILS &&
          operation.retry(err)
        ) {
          logger.warn(
            `grpc method ${methodName} failed with errorCode ${err.code}. Full error: ${err}. Retrying after ${currentAttempt} attempt(s).`,
          );
          return;
        }
        cb(err, response);
      });
    });
  };
  return new Proxy(grpcClient, {
    get: (client, methodName) => {
      const originalValue = client[methodName];
      if (typeof originalValue === 'function') {
        const originalMethod = originalValue.bind(client);
        if (methodNames[methodName]) {
          return methodWithRetry(methodName, originalMethod);
        } else {
          return originalMethod;
        }
      } else {
        return originalValue;
      }
    },
  });
};

// Convert nested grpc object to gql object. Make sure your gql definitions matches proto definitions
export function grpcToGql(obj) {
  return transform(
    obj,
    (result, value, key) => {
      let v = value;
      // Unwrap value
      if (keys(value).length === 1 && has(value, 'value')) {
        v = value.value;
      }
      // Flatten timestamp
      v = timestampToDateTime(v);
      if (v instanceof Date) {
        result[camelCase(key)] = v;
        return;
      }
      // Convert key name to camelCase and recursively convert value
      result[camelCase(key)] = isObject(v) && !isArray(v) ? grpcToGql(v) : v;
    },
    {},
  );
}

// Convert a Timestamp object to ISO datetime string, or return the same one if it's not a Timestamp
function timestampToDateTime(maybeTimestamp) {
  const isTimestamp =
    keys(maybeTimestamp).length === 2 &&
    has(maybeTimestamp, 'seconds') &&
    has(maybeTimestamp, 'nanos');
  if (isTimestamp) {
    const { seconds, nanos } = maybeTimestamp;
    return new Date(seconds * 1000 + nanos / 1000000);
  }
  return maybeTimestamp;
}
