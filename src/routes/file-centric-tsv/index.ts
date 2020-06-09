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

import express, { Response, RequestHandler, Request } from 'express';
import { Client } from '@elastic/elasticsearch';
import { ARRANGER_FILE_CENTRIC_INDEX, DEFAULT_TSV_STREAM_CHUNK_SIZE } from 'config';
import esb from 'elastic-builder';
import logger from 'utils/logger';
import { EsFileDocument, TsvFileSchema } from './types';
import { format } from 'date-fns';
import { getNestedFields, EsIndexMapping } from 'services/elasticsearch';
import { createFilterStringToEsQueryParser } from './utils';

import scoreManifestTsvSchema from './tsvSchemas/scoreManifest';
import demoTsvSchema from './tsvSchemas/demo';

const createFileCentricDocumentStream = async function*(configs: {
  esClient: Client;
  shouldContinue: () => boolean;
  esQuery?: object;
  pageSize?: number;
}) {
  const { esClient, shouldContinue, esQuery, pageSize = DEFAULT_TSV_STREAM_CHUNK_SIZE } = configs;
  let currentPage = 0;
  let completed = false;
  while (!completed && shouldContinue()) {
    const {
      body: { hits },
    } = await esClient.search({
      index: ARRANGER_FILE_CENTRIC_INDEX,
      body: {
        query: esQuery,
        ...esb
          .requestBodySearch()
          .from(currentPage * pageSize)
          .size(pageSize)
          .sort(esb.sort('object_id' as keyof EsFileDocument))
          .toJSON(),
      },
    });
    if (hits.hits.length) {
      currentPage++;
      yield hits.hits.map(
        ({ _source }: { _source: EsFileDocument }) => _source,
      ) as EsFileDocument[];
    } else {
      completed = true;
    }
  }
};

const writeTsvStreamToResponse = async <Document>(
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

const createDownloadHandler = ({
  defaultFileName,
  tsvSchema,
  parseFilterStringToEsQuery,
  esClient,
}: {
  defaultFileName: (req: Request) => string;
  tsvSchema: TsvFileSchema<EsFileDocument>;
  parseFilterStringToEsQuery: ReturnType<typeof createFilterStringToEsQueryParser>;
  esClient: Client;
}): RequestHandler => {
  return async (req, res) => {
    const { filter: filterStr, fileName }: { filter?: string; fileName?: string } = req.query;
    let esQuery: object | undefined;
    try {
      esQuery = filterStr ? await parseFilterStringToEsQuery(filterStr) : undefined;
    } catch (err) {
      res.status(400).send(`${filterStr} is not a valid filter`);
      logger.error(err);
      throw err;
    }
    const fileCentricDocumentStream = createFileCentricDocumentStream({
      esClient,
      shouldContinue: () => !req.aborted,
      esQuery,
    });
    res.setHeader(
      'Content-disposition',
      `attachment; filename=${
        fileName ? `${fileName.split('.tsv')[0]}.tsv` : defaultFileName(req)
      }`,
    );
    await writeTsvStreamToResponse(fileCentricDocumentStream, res, tsvSchema);
    res.end();
  };
};

const createFileCentricTsvRouter = async (esClient: Client) => {
  /**
   * All this stuff gets initialized once at application start-up
   */
  const router = express.Router();
  const { body }: { body: EsIndexMapping } = await esClient.indices.getMapping({
    index: ARRANGER_FILE_CENTRIC_INDEX,
  });
  const [indexMapping] = Object.values(body);
  const nestedFields = getNestedFields(indexMapping.mappings);
  const parseFilterStringToEsQuery = createFilterStringToEsQueryParser(esClient, nestedFields);

  router.use(
    '/score-manifest',
    createDownloadHandler({
      esClient,
      parseFilterStringToEsQuery,
      defaultFileName: req => `score-manifest.${format(Date.now(), 'yyyyMMdd')}.tsv`,
      tsvSchema: scoreManifestTsvSchema,
    }),
  );
  router.use(
    /** This guy is just a demo for adding future tsv downloads */
    '/demo',
    createDownloadHandler({
      esClient,
      parseFilterStringToEsQuery,
      defaultFileName: req => 'demo',
      tsvSchema: demoTsvSchema,
    }),
  );

  return router;
};

export default createFileCentricTsvRouter;
