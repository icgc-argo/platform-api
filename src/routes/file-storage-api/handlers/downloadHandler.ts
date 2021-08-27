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

import { Request, Response, Handler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';
import { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import {
  hasSufficientDacoAccess,
  hasSufficientProgramMembershipAccess,
} from 'routes/utils/accessValidations';
import { Client } from '@elastic/elasticsearch';
import { getEsFileDocumentByObjectId } from '../utils';
import { getDataCenter } from 'services/dataCenterRegistry';
import { ScoreAuthClient } from 'services/ego/scoreAuthClient';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

const downloadHandler = ({
  rootPath,
  esClient,
  scoreAuthClient,
  proxyMiddlewareFactory = createProxyMiddleware,
}: {
  rootPath: string;
  esClient: Client;
  scoreAuthClient: ScoreAuthClient;
  proxyMiddlewareFactory: typeof createProxyMiddleware;
}): Handler => async (req: AuthenticatedRequest, res, next) => {
  const { fileObjectId } = req.params;
  const esFileObject = await getEsFileDocumentByObjectId(esClient)(fileObjectId);

  if (!esFileObject) {
    return res.status(404).end();
  }

  const isAuthorized =
    hasSufficientProgramMembershipAccess({
      scopes: req.auth.scopes,
      file: esFileObject,
    }) &&
    hasSufficientDacoAccess({
      scopes: req.auth.scopes,
      file: esFileObject,
    });

  if (isAuthorized) {
    const repositoryCode = esFileObject.repositories[0].code;
    const dataCenter = await getDataCenter(repositoryCode);
    const scoreProxyJwt = await scoreAuthClient.getAuth();

    if (dataCenter) {
      const scoreUrl = dataCenter.scoreUrl;
      const handleRequest = proxyMiddlewareFactory({
        target: scoreUrl,
        pathRewrite: normalizePath(rootPath),
        onError: (err: Error, req: Request, res: Response) => {
          logger.error('Score Router Error - ' + err);
          return res.status(500).end();
        },
        headers: {
          Authorization: `Bearer ${scoreProxyJwt}`,
        },
        changeOrigin: true,
      });
      handleRequest(req, res, next);
    } else {
      res
        .status(500)
        .json({ error: 'File repository unavailable' })
        .end();
    }
  } else {
    if (req.auth.authenticated) {
      res
        .status(403)
        .send('Insufficient data access permissions.')
        .end();
    } else {
      res
        .status(401)
        .send('Invalid Authorization token')
        .end();
    }
  }
};

export default downloadHandler;
