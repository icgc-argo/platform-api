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

import { Client } from '@elastic/elasticsearch';
import express, { Router } from 'express';
import urljoin from 'url-join';
import { ADVERTISED_HOST } from 'config';
import downloadProxy from './handlers/downloadHandler';
import createEntitiesHandler from './handlers/entitiesHandler';
import createEntitiesIdHandler from './handlers/entitiesIdHandler';
import authenticatedRequestMiddleware from 'routes/middleware/authenticatedRequestMiddleware';
import { EgoClient } from 'services/ego';
import { createProxyMiddleware } from 'http-proxy-middleware';

export default ({
  rootPath,
  esClient,
  egoClient,
  downloadProxyMiddlewareFactory = createProxyMiddleware,
}: {
  rootPath: string;
  esClient: Client;
  egoClient: EgoClient;
  downloadProxyMiddlewareFactory?: typeof createProxyMiddleware;
}): Router => {
  const router = express.Router();

  /****************************************************************
   * Score client uses this to validate server availability.
   * It really doesn't matter what's returned.
   ****************************************************************/
  router.get('/download/ping', async (req, res, next) => {
    res.send(urljoin(ADVERTISED_HOST, rootPath, '/heliograph'));
  });
  router.get('/heliograph', (req, res) => {
    res.send('heliograph');
  });
  /****************************************************************/

  router.get(
    '/entities',
    authenticatedRequestMiddleware({ egoClient }),
    createEntitiesHandler({
      esClient,
    }),
  );
  router.get(
    '/entities/:fileObjectId',
    authenticatedRequestMiddleware({ egoClient }),
    createEntitiesIdHandler({
      esClient,
    }),
  );
  router.get(
    '/download/:fileObjectId',
    authenticatedRequestMiddleware({ egoClient }),
    downloadProxy({
      rootPath,
      esClient,
      proxyMiddlewareFactory: downloadProxyMiddlewareFactory,
    }),
  );

  return router;
};
