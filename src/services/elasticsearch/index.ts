import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_HOST } from 'config';

export const createClient = () => {
  const esClient = new Client({
    node: ELASTICSEARCH_HOST,
  });
  return esClient;
};
