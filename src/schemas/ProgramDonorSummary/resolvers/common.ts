import logger from 'utils/logger';
import { ApolloError } from 'apollo-server-express';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';

export const esAliasNotFound = async (esClient: Client) => {
  const aliasFound = await esClient.indices
    .existsAlias({ name: ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX })
    .then(res => res.body);
  logger.debug(`${ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX} alias exists: ${aliasFound}`);
  return !aliasFound;
};
