import {
  ELASTICSEARCH_HOST,
  VAULT_ES_SECRET_PATH,
  USE_VAULT,
  ES_CLIENT_TRUST_SSL_CERT,
} from 'config';
import flatMap from 'lodash/flatMap';
import { Client, Transport } from '@elastic/elasticsearch';

import logger from 'utils/logger';
import { loadVaultSecret } from 'services/vault';

type EsSecret = {
  user: string;
  pass: string;
};

const isEsSecret = (data: { [k: string]: any }): data is EsSecret => {
  return typeof data['user'] === 'string' && typeof data['pass'] === 'string';
};

export const createEsClient = async (): Promise<Client> => {
  let esClient: Client;
  if (USE_VAULT) {
    const secretData = await loadVaultSecret()(VAULT_ES_SECRET_PATH).catch(err => {
      logger.error(`could not read Elasticsearch secret at path ${VAULT_ES_SECRET_PATH}`);
      throw err;
    });
    if (isEsSecret(secretData)) {
      esClient = new Client({
        node: ELASTICSEARCH_HOST,
        ssl: {
          rejectUnauthorized: !ES_CLIENT_TRUST_SSL_CERT,
        },
        auth: {
          username: secretData.user,
          password: secretData.pass,
        },
      });
    } else {
      throw new Error(`vault secret at ${VAULT_ES_SECRET_PATH} could not be read`);
    }
  } else {
    esClient = new Client({
      node: ELASTICSEARCH_HOST,
    });
  }
  try {
    await esClient.ping();
  } catch (err) {
    logger.error(`esClient failed to connect to cluster`);
    throw err;
  }
  logger.info(`successfully created Elasticsearch client for ${ELASTICSEARCH_HOST}`);
  return esClient;
};
