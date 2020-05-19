import { Client } from '@elastic/elasticsearch';

import logger from 'utils/logger';
import {
  USE_VAULT,
  ELASTICSEARCH_VAULT_SECRET_PATH,
  ELASTICSEARCH_CLIENT_TRUST_SSL_CERT,
  ELASTICSEARCH_HOST,
} from 'config';
import { loadVaultSecret } from 'services/vault';

type EsSecret = {
  user: string;
  pass: string;
};

const isEsSecret = (data: { [k: string]: any }): data is EsSecret => {
  return typeof data['user'] === 'string' && typeof data['pass'] === 'string';
};

export const createEsClient = async ({ node = ELASTICSEARCH_HOST } = {}): Promise<Client> => {
  let esClient: Client;
  if (USE_VAULT) {
    const secretData = await loadVaultSecret()(ELASTICSEARCH_VAULT_SECRET_PATH).catch(err => {
      logger.error(
        `could not read Elasticsearch secret at path ${ELASTICSEARCH_VAULT_SECRET_PATH}`,
      );
      throw err;
    });
    if (isEsSecret(secretData)) {
      esClient = new Client({
        node,
        ssl: {
          rejectUnauthorized: !ELASTICSEARCH_CLIENT_TRUST_SSL_CERT,
        },
        auth: {
          username: secretData.user,
          password: secretData.pass,
        },
      });
    } else {
      throw new Error(`vault secret at ${ELASTICSEARCH_VAULT_SECRET_PATH} is malformed`);
    }
  } else {
    esClient = new Client({
      node,
      ssl: {
        rejectUnauthorized: !ELASTICSEARCH_CLIENT_TRUST_SSL_CERT,
      },
    });
  }
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
