import { Client } from '@elastic/elasticsearch';

export default ({ esClient }: { esClient: Client }) => async (config: {
  egoJwt?: string;
  fileObjectId?: string;
}): Promise<boolean> => {
  /**
   * @todo: actually implement this function
   */
  if (config.egoJwt && config.fileObjectId) {
    return true;
  } else {
    return true;
  }
};
