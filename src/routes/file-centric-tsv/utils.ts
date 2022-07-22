/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import logger from 'utils/logger';
import { Client } from '@elastic/elasticsearch';

// @ts-ignore
import { buildQuery } from '@arranger/middleware/dist';
import {
  DEFAULT_TSV_STREAM_CHUNK_SIZE,
  ARRANGER_FILE_CENTRIC_INDEX,
} from 'config';
import esb from 'elastic-builder';
import { TsvFileSchema } from './types';
import { Response } from 'express';
import { EsIndexMapping, getNestedFields } from 'services/elasticsearch';

export const parseFilterString = (filterString: string): {} => {
  try {
    return JSON.parse(filterString) as {};
  } catch (err) {
    logger.error(`${filterString} is not a valid filter`);
    throw err;
  }
};

export type FilterStringParser = (filterStr: {}) => Promise<{}>;
export const createFilterToEsQueryConverter = async (
  esClient: Client,
  index: string,
) => {
  const { body }: { body: EsIndexMapping } = await esClient.indices.getMapping({
    index,
  });
  const [indexMapping] = Object.values(body);
  const nestedFields = getNestedFields(indexMapping.mappings);

  return (async (filter: {}) => {
    const esQuery = filter
      ? buildQuery({
          filters: filter,
          nestedFields: nestedFields,
        })
      : undefined;
    const {
      body: { valid },
    }: { body: { valid: boolean } } = await esClient.indices.validateQuery({
      index,
      body: {
        query: esQuery,
      },
    });
    if (!valid) {
      throw new Error(
        `invalid Elasticsearch query ${JSON.stringify(
          esQuery,
        )} generated from ${JSON.stringify(filter)}`,
      );
    }
    return esQuery;
  }) as FilterStringParser;
};

export const createEsDocumentStream = async function* <DocumentType>(configs: {
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
      yield hits.hits.map(
        ({ _source }: { _source: DocumentType }) => _source,
      ) as DocumentType[];
    } else {
      completed = true;
    }
  }
};

type WritableTarget = {
  // this is basically a subset of Express Response type, but this is easier to mock for testing
  write: (str: string) => any;
};

export const writeTsvStreamToWritableTarget = async <Document>(
  stream: AsyncGenerator<Document[], void, unknown>,
  writableTarget: WritableTarget,
  tsvSchema: TsvFileSchema<Document>,
) => {
  writableTarget.write(tsvSchema.map(({ header }) => header).join('\t'));
  writableTarget.write('\n');
  let documentCount = 0; // for logging
  let chunkCount = 0; // for logging
  for await (const chunk of stream) {
    writableTarget.write(
      chunk
        .map((fileObj): string =>
          tsvSchema.map(({ getter }) => getter(fileObj)).join('\t'),
        )
        .join('\n'),
    );
    writableTarget.write('\n');
    documentCount += chunk.length;
    chunkCount++;
  }
  logger.info(
    `streamed ${documentCount} documents to tsv over ${chunkCount} chunks`,
  );
};
