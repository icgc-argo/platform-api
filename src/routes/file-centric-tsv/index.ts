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
import { ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import { get } from 'lodash';
import fileSize from 'filesize';
import logger from 'utils/logger';
import { EsFileDocument, TsvFileSchema } from './types';
import { format } from 'date-fns';
import {
  createFilterStringToEsQueryParser,
  createEsDocumentStream,
  writeTsvStreamToWritableTarget,
  FilterStringParser,
} from './utils';

import scoreManifestTsvSchema from './tsvSchemas/scoreManifest';
import demoTsvSchema from './tsvSchemas/demo';
import { FILE_METADATA_FIELDS } from 'utils/commonTypes/EsFileCentricDocument';

const specialColumnHeaders = {
  fileSize: ['Size'],
};

const createDownloadHandler = ({
  defaultFileName,
  tsvSchema,
  parseFilterStringToEsQuery,
  esClient,
}: {
  defaultFileName: (req: Request) => string;
  tsvSchema?: TsvFileSchema<EsFileDocument>;
  parseFilterStringToEsQuery: FilterStringParser;
  esClient: Client;
}): RequestHandler => {
  return async (req, res) => {
    const {
      columns,
      filter: filterStr,
      fileName,
    }: { columns?: string; filter?: string; fileName?: string } = req.query;
    
    if (!columns && !tsvSchema) {
      const err = 'No schema provided';
      res.status(400).send(err);
      logger.error(err);
      throw err;
    }

    let esQuery: object | undefined;
    try {
      esQuery = filterStr ? await parseFilterStringToEsQuery(filterStr) : undefined;
    } catch (err) {
      res.status(400).send(`${filterStr} is not a valid filter`);
      logger.error(err);
      throw err;
    }
    const fileCentricDocumentStream = createEsDocumentStream<EsFileDocument>({
      esClient,
      shouldContinue: () => !req.aborted,
      esQuery,
      sortField: FILE_METADATA_FIELDS['object_id'],
    });

    const columnsSchema =
      columns &&
      JSON.parse(decodeURIComponent(columns)).map(
        ({ header, getter }: { header: string; getter: string }) => ({
          header,
          getter: (source: EsFileDocument) => {
            const getSource = get(source, getter);
            return specialColumnHeaders.fileSize.includes(header)
              ? fileSize(getSource)
              : getSource;
          },
        }),
      );

    res.setHeader(
      'Content-disposition',
      `attachment; filename=${
        fileName ? `${fileName.split('.tsv')[0]}.tsv` : defaultFileName(req)
      }`,
    );
    await writeTsvStreamToWritableTarget(fileCentricDocumentStream, res, columnsSchema || tsvSchema);
    res.end();
  };
};

const createFileCentricTsvRouter = async (esClient: Client) => {
  /**
   * All this stuff gets initialized once at application start-up
   */
  const router = express.Router();
  const parseFilterStringToEsQuery = await createFilterStringToEsQueryParser(
    esClient,
    ARRANGER_FILE_CENTRIC_INDEX,
  );

  router.use(
    '/file-table',
    createDownloadHandler({
      esClient,
      parseFilterStringToEsQuery,
      defaultFileName: req => `file-table.${format(Date.now(), 'yyyyMMdd')}.tsv`,
    }),
  );
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
