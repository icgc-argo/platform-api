import { Client as EsClient, ClientOptions } from '@elastic/elasticsearch';
import { ELASTICSEARCH_ROOT } from 'config';

const createClient = ({ node = ELASTICSEARCH_ROOT, ...rest }: ClientOptions = {}) => {
  const client = new EsClient({
    node: node || ELASTICSEARCH_ROOT,
    ...rest,
  });
  return client;
};

export default createClient;
