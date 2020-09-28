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
import express, { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';
import urljoin from 'url-join';
import { ADVERTISED_HOST } from 'config';

const validateAccessibility = async (egoJwt?: string, fileObjectId?: string): Promise<boolean> => {
  if (egoJwt && fileObjectId) {
    return true;
  } else {
    return true;
  }
};

const getRdpcUrlsByFileObjectId = ({
  fileObjectId,
}: {
  fileObjectId?: string;
}): Promise<{ song: string; score: string }> => {
  console.log('fileObjectId: ', fileObjectId);
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        score: 'https://score.rdpc-dev.cancercollaboratory.org',
        song: 'https://song.rdpc-dev.cancercollaboratory.org',
      });
    }, 0);
  });
};

const getRdpcUrlsByAnalyisId = ({
  analysisId,
}: {
  analysisId: string;
}): Promise<{ song: string; score: string }> => {
  console.log('analysisId: ', analysisId);
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        score: 'https://score.rdpc-dev.cancercollaboratory.org',
        song: 'https://song.rdpc-dev.cancercollaboratory.org',
      });
    }, 0);
  });
};

export default ({ rootPath }: { rootPath: string; esClient: Client }): Router => {
  const router = express.Router();

  const normalizePath = (pathName: string, req: Request) =>
    pathName.replace(rootPath, '').replace('//', '/');

  /****************************************************************
   * Score client uses this to validate server availability.
   * It really doesn't matter what's returned.
   ****************************************************************/
  router.get('/download/ping', async (req, res, next) => {
    res.send(urljoin(ADVERTISED_HOST, rootPath, '/yeehaw'));
  });
  router.get('/yeehaw', (req, res) => {
    res.send('yeehaw');
  });
  /****************************************************************/

  router.get(
    '/entities',
    async (
      req: Request<{}, any, any, { gnosId: string; size: string; page: string }>,
      res,
      next,
    ) => {
      const {
        headers: { authorization },
      } = req;
      const isAuthorized = await validateAccessibility(authorization);
      const { gnosId: analysisId } = req.query;
      if (isAuthorized) {
        const handleRequest = createProxyMiddleware({
          target: (await getRdpcUrlsByAnalyisId({ analysisId })).song,
          pathRewrite: normalizePath,
          onError: (err: Error, req: Request, res: Response) => {
            logger.error('Song Router Error - ' + err);
            return res.status(500).send('Internal Server Error');
          },
          changeOrigin: true,
        });
        handleRequest(req, res, next);
      } else {
        res.status(403);
      }
    },
  );

  router.get(
    '/entities/:fileObjectId',
    async (req: Request<{ fileObjectId: string }>, res, next) => {
      const {
        headers: { authorization },
      } = req;
      const isAuthorized = await validateAccessibility(authorization);
      const { fileObjectId } = req.params;
      if (isAuthorized) {
        const handleRequest = createProxyMiddleware({
          target: (await getRdpcUrlsByFileObjectId({ fileObjectId })).song,
          pathRewrite: normalizePath,
          onError: (err: Error, req: Request, res: Response) => {
            logger.error('Song Router Error - ' + err);
            return res.status(500).send('Internal Server Error');
          },
          changeOrigin: true,
        });
        handleRequest(req, res, next);
      } else {
        res.status(403);
      }
    },
  );

  router.get(
    '/download/:fileObjectId',
    async (req: Request<{ fileObjectId: string }>, res, next) => {
      const {
        headers: { authorization },
      } = req;
      const isAuthorized = await validateAccessibility(authorization);
      console.log('/download/:fileObjectId req.params: ', req.params);
      const { fileObjectId } = req.params;
      if (isAuthorized) {
        const handleRequest = createProxyMiddleware({
          target: (await getRdpcUrlsByFileObjectId({ fileObjectId })).score,
          pathRewrite: normalizePath,
          onError: (err: Error, req: Request, res: Response) => {
            logger.error('Score Router Error - ' + err);
            return res.status(500).send('Internal Server Error');
          },
          changeOrigin: true,
        });
        handleRequest(req, res, next);
      } else {
        res.status(403);
      }
    },
  );

  return router;
};
