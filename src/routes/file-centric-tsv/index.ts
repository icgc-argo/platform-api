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

import express, { Response, RequestHandler } from 'express';
import { Client } from '@elastic/elasticsearch';
import { ARRANGER_FILE_CENTRIC_INDEX, DEFAULT_TSV_STREAM_CHUNK_SIZE } from 'config';
import esb from 'elastic-builder';
import logger from 'utils/logger';
import { EsFileDocument, TsvFileSchema } from './types';

// @ts-ignore
import { buildQuery } from '@arranger/middleware/dist';
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
          .from(currentPage)
          .size(pageSize)
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

const parseFilterString = (filterString: unknown): {} => {
  try {
    if (typeof filterString === 'string') {
      return JSON.parse(filterString) as {};
    } else {
      throw new Error(`expected ${filterString} to be a string`);
    }
  } catch (err) {
    logger.error(`${filterString} is not a valid filter`);
    throw err;
  }
};

const writeTsvStreamToResponse = async <Document>(
  stream: AsyncGenerator<Document[], void, unknown>,
  res: Response,
  tsvSchema: TsvFileSchema<Document>,
) => {
  res.write(tsvSchema.map(({ header }) => header).join('\t'));
  res.write('\n');
  for await (const chunk of stream) {
    res.write(
      chunk
        .map((fileObj): string => tsvSchema.map(({ getter }) => getter(fileObj)).join('\t'))
        .join('\n'),
    );
  }
};

const createFileCentricTsvRouter = (esClient: Client) => {
  const router = express.Router();

  const createDownloadRoute = (
    fileName: string,
    tsvSchema: TsvFileSchema<EsFileDocument>,
  ): RequestHandler => {
    return async (req, res) => {
      const { filter: filterStr } = req.query;
      const filter = parseFilterString(filterStr);
      let esQuery: object;
      try {
        esQuery = buildQuery({
          filters: filter,
          nestedFields: [],
        });
      } catch (err) {
        res.status(400).end();
        throw err;
      }
      const fileCentricDocumentStream = createFileCentricDocumentStream({
        esClient,
        shouldContinue: () => !req.aborted,
        esQuery,
      });

      /**
       * @TODO implement time in file name
       */
      res.setHeader('Content-disposition', `attachment; filename=${fileName}.20200520.tsv`);
      await writeTsvStreamToResponse(fileCentricDocumentStream, res, tsvSchema);
      res.end();
    };
  };

  router.use('/manifest', createDownloadRoute('score-manifest', scoreManifestTsvSchema));
  router.use('/demo', createDownloadRoute('demo', demoTsvSchema));

  return router;
};

export default createFileCentricTsvRouter;
