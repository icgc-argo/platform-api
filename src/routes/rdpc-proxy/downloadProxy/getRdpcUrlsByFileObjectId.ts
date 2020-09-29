import { Client } from '@elastic/elasticsearch';

export default ({
  fileObjectId,
  esClient,
}: {
  fileObjectId: string;
  esClient: Client;
}): Promise<string> => {
  /**
   * @todo: actually implement this function
   */
  return Promise.resolve('https://song.rdpc-dev.cancercollaboratory.org');
};
