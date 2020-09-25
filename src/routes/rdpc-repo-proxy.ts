import { Client } from '@elastic/elasticsearch';
import express, { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';
import urljoin from 'url-join';

const validateAccessibility = async (egoJwt?: string, fileObjectId?: string): Promise<boolean> => {
  console.log(`egoJwt: `, !!egoJwt);
  if (egoJwt && fileObjectId) {
    return true;
  } else {
    return true;
  }
};

const getRdpcUrls = ({
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

export default ({ rootPath }: { rootPath: string; esClient: Client }): Router => {
  const router = express.Router();

  const normalizePath = (pathName: string, req: Request) =>
    pathName.replace(rootPath, '').replace('//', '/');

  /****************************************************************
   * Score client uses this to validate server availability.
   * It really doesn't matter what's returned.
   ****************************************************************/
  router.get('/download/ping', async (req, res, next) => {
    res.send(urljoin('http://localhost:9000', rootPath, '/yeehaw'));
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
      const fileObjectId = '';
      if (isAuthorized) {
        const handleRequest = createProxyMiddleware({
          target: (await getRdpcUrls({ fileObjectId })).song,
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
          target: (await getRdpcUrls({ fileObjectId })).song,
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
          target: (await getRdpcUrls({ fileObjectId })).score,
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
