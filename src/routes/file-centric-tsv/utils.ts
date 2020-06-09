import logger from 'utils/logger';
import { Client } from '@elastic/elasticsearch';

// @ts-ignore
import { buildQuery } from '@arranger/middleware/dist';
import { DEFAULT_TSV_STREAM_CHUNK_SIZE, ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import esb from 'elastic-builder';
import { TsvFileSchema } from './types';
import { Response } from 'express';

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

export const createEsDocumentStream = async function*<DocumentType>(configs: {
  esClient: Client;
  shouldContinue: () => boolean;
  sortField: string;
  esQuery?: object;
  pageSize?: number;
  esIndex?: string;
}) {
  const {
    esClient,
    shouldContinue,
    esQuery,
    sortField,
    pageSize = DEFAULT_TSV_STREAM_CHUNK_SIZE,
    esIndex = ARRANGER_FILE_CENTRIC_INDEX,
  } = configs;
  let currentPage = 0;
  let completed = false;
  while (!completed && shouldContinue()) {
    const {
      body: { hits },
    } = await esClient.search({
      index: esIndex,
      body: {
        query: esQuery,
        ...esb
          .requestBodySearch()
          .from(currentPage * pageSize)
          .size(pageSize)
          .sort(esb.sort(sortField))
          .toJSON(),
      },
    });
    if (hits.hits.length) {
      currentPage++;
      yield hits.hits.map(({ _source }: { _source: DocumentType }) => _source) as DocumentType[];
    } else {
      completed = true;
    }
  }
};

export const writeTsvStreamToResponse = async <Document>(
  stream: AsyncGenerator<Document[], void, unknown>,
  res: Response,
  tsvSchema: TsvFileSchema<Document>,
) => {
  res.write(tsvSchema.map(({ header }) => header).join('\t'));
  res.write('\n');
  let documentCount = 0; // for logging
  let chunkCount = 0; // for logging
  for await (const chunk of stream) {
    res.write(
      chunk
        .map((fileObj): string => tsvSchema.map(({ getter }) => getter(fileObj)).join('\t'))
        .join('\n'),
    );
    documentCount += chunk.length;
    chunkCount++;
  }
  logger.info(`streamed ${documentCount} documents to tsv over ${chunkCount} chunks`);
};
