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
import flatMap from 'lodash/flatMap';
import logger from 'utils/logger';
import { ELASTICSEARCH_CLIENT_TRUST_SSL_CERT, ELASTICSEARCH_HOST } from 'config';

import {
  EsScalarFieldMapping,
  EsNestedFieldMapping,
  EsObjectFieldMapping,
  EsFieldMapping,
  EsIndexMapping,
} from './types';
export {
  EsScalarFieldMapping,
  EsNestedFieldMapping,
  EsObjectFieldMapping,
  EsFieldMapping,
  EsIndexMapping,
} from './types';

export const isObjectFieldMapping = (obj: object): obj is EsObjectFieldMapping =>
  Object.keys(obj).includes('properties') && !Object.keys(obj).includes('type');

export const isScalarFieldMapping = (obj: object): obj is EsScalarFieldMapping =>
  // @ts-ignore This is doing run-time type check so it's ok
  Object.keys(obj).includes('type') && obj.type !== 'nested';

export const isNestedFieldMapping = (obj: object): obj is EsNestedFieldMapping =>
  // @ts-ignore This is doing run-time type check so it's ok
  Object.keys(obj).includes('type') && obj.type === 'nested';

export const getNestedFields = (fieldMapping: EsFieldMapping, parentField?: string): string[] => {
  /**
   * @TODO maybe tail-call optimize this function
   */
  if (isNestedFieldMapping(fieldMapping) || isObjectFieldMapping(fieldMapping)) {
    const { properties } = fieldMapping;
    const currentFields = Object.keys(properties);
    const nestedOrObjectFieldKey = currentFields.filter(
      field => isNestedFieldMapping(properties[field]) || isObjectFieldMapping(properties[field]),
    );
    const nestedFieldKey = nestedOrObjectFieldKey.filter(field =>
      isNestedFieldMapping(properties[field]),
    );
    return flatMap([
      ...(parentField ? nestedFieldKey.map(field => `${parentField}.${field}`) : nestedFieldKey),
      ...nestedOrObjectFieldKey.map(field =>
        getNestedFields(properties[field], parentField ? `${parentField}.${field}` : field),
      ),
    ]);
  } else {
    return [];
  }
};

export type EsSecret = {
  user: string;
  pass: string;
};
const isEsSecret = (data: { [k: string]: any }): data is EsSecret => {
  return typeof data['user'] === 'string' && typeof data['pass'] === 'string';
};

export const createEsClient = async ({
  node = ELASTICSEARCH_HOST,
  auth,
}: { node?: string; auth?: EsSecret } = {}): Promise<Client> => {
  let esClient: Client;
  esClient = new Client({
    node,
    ssl: {
      rejectUnauthorized: !ELASTICSEARCH_CLIENT_TRUST_SSL_CERT,
    },
    auth: auth
      ? {
          username: auth.user,
          password: auth.pass,
        }
      : undefined,
  });
  try {
    logger.info(`attempting to ping elasticsearch at ${ELASTICSEARCH_HOST}`);
    await esClient.ping();
  } catch (err) {
    logger.error(`esClient failed to connect to cluster`);
    throw err;
  }
  logger.info(`successfully created Elasticsearch client for ${ELASTICSEARCH_HOST}`);
  return esClient;
};

export type EsHits<T = {}> = {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: 'eq' | 'gte';
    };
    max_score: number;
    hits: {
      _index: string;
      _type: string;
      _id: string;
      _score: number;
      _source: T;
    }[];
  };
};
