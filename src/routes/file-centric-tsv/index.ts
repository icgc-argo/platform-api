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
import { EgoClient } from 'services/ego';
import { ARRANGER_FILE_CENTRIC_INDEX, FEATURE_METADATA_ACCESS_CONTROL } from 'config';
import { get } from 'lodash';
import fileSize from 'filesize';
import logger from 'utils/logger';
import { EsFileDocument, TsvFileSchema } from './types';
import { format } from 'date-fns';
import {
  createFilterToEsQueryConverter,
  createEsDocumentStream,
  writeTsvStreamToWritableTarget,
  FilterStringParser,
} from './utils';
import egoTokenUtils from 'utils/egoTokenUtils';

import authenticatedRequestMiddleware, {
  AuthenticatedRequest,
} from 'routes/middleware/authenticatedRequestMiddleware';
import getAccessControlFilter from '../../schemas/Arranger/getAccessControlFilter';

import scoreManifestTsvSchema from './tsvSchemas/scoreManifest';
import demoTsvSchema from './tsvSchemas/demo';
import { FILE_METADATA_FIELDS } from 'utils/commonTypes/EsFileCentricDocument';

const specialColumnHeaders = {
  fileSize: ['Size'],
};

function combineSqonFilters(filters: {}[]): {} {
  return {
    op: 'and',
    content: [...filters],
  };
}

const createDownloadHandler = ({
  defaultFileName,
  tsvSchema,
  convertFilterToEsQuery,
  esClient,
}: {
  defaultFileName: (req: Request) => string;
  tsvSchema?: TsvFileSchema<EsFileDocument>;
  convertFilterToEsQuery: FilterStringParser;
  esClient: Client;
}): RequestHandler => {
  return async (req: AuthenticatedRequest, res) => {
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

    const jwtData = req.auth.authenticated ? egoTokenUtils.decodeToken(req.auth.egoJwt) : null;

    let esQuery: object;
    try {
      let requestFilter = filterStr ? JSON.parse(filterStr) : undefined;
      if (FEATURE_METADATA_ACCESS_CONTROL) {
        const authFilter = getAccessControlFilter(jwtData);
        requestFilter = filterStr ? combineSqonFilters([requestFilter, authFilter]) : authFilter;
      }
      esQuery = await convertFilterToEsQuery(requestFilter);
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
            return specialColumnHeaders.fileSize.includes(header) ? fileSize(getSource) : getSource;
          },
        }),
      );

    res.setHeader(
      'content-disposition',
      `attachment; filename=${
        fileName ? `${fileName.split('.tsv')[0]}.tsv` : defaultFileName(req)
      }`,
    );
    await writeTsvStreamToWritableTarget(
      fileCentricDocumentStream,
      res,
      columnsSchema || tsvSchema,
    );
    res.end();
  };
};

const createFileCentricTsvRouter = async (esClient: Client, egoClient: EgoClient) => {
  /**
   * All this stuff gets initialized once at application start-up
   */
  const router = express.Router();

  router.use(authenticatedRequestMiddleware({ egoClient }));

  const convertFilterToEsQuery = await createFilterToEsQueryConverter(
    esClient,
    ARRANGER_FILE_CENTRIC_INDEX,
  );

  router.use(
    '/file-table',
    createDownloadHandler({
      esClient,
      convertFilterToEsQuery,
      defaultFileName: req => `file-table.${format(Date.now(), 'yyyyMMdd')}.tsv`,
    }),
  );
  router.use(
    '/score-manifest',
    createDownloadHandler({
      esClient,
      convertFilterToEsQuery,
      defaultFileName: req => `score-manifest.${format(Date.now(), 'yyyyMMddHHmmss')}.tsv`,
      tsvSchema: scoreManifestTsvSchema,
    }),
  );
  router.use(
    /** This guy is just a demo for adding future tsv downloads */
    '/demo',
    createDownloadHandler({
      esClient,
      convertFilterToEsQuery,
      defaultFileName: req => 'demo',
      tsvSchema: demoTsvSchema,
    }),
  );

  return router;
};

export default createFileCentricTsvRouter;
