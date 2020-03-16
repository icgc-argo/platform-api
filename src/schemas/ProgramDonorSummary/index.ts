import createEsClient from 'services/elasticsearch';
import typedef from './typedefs';

const createExecutableSchema = () => {
  const esClient = createEsClient();
};

export default createExecutableSchema;
