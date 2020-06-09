import logger from 'utils/logger';
import { Client } from '@elastic/elasticsearch';

// @ts-ignore
import { buildQuery } from '@arranger/middleware/dist';

export const parseFilterString = (filterString: string): {} => {
  try {
    return JSON.parse(filterString) as {};
  } catch (err) {
    logger.error(`${filterString} is not a valid filter`);
    throw err;
  }
};

export const createFilterStringToEsQueryParser = (esClient: Client, nestedFields: string[]) => {
  return async (filterStr: string): Promise<{}> => {
    const filter = filterStr ? parseFilterString(filterStr) : null;
    const esQuery = filter
      ? buildQuery({
          filters: filter,
          nestedFields: nestedFields,
        })
      : undefined;
    const {
      body: { valid },
    }: { body: { valid: boolean } } = await esClient.indices.validateQuery({
      body: {
        query: esQuery,
      },
    });
    if (!valid) {
      throw new Error(
        `invalid Elasticsearch query ${JSON.stringify(esQuery)} generated from ${filterStr}`,
      );
    }
    return esQuery;
  };
};
