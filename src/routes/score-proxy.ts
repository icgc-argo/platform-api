import { Client } from '@elastic/elasticsearch';
import express, { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';

const validateAccessibility = async (req: Request) => {
  console.log(req.headers.authorization);
};

export default ({ rootPath }: { rootPath: string; esClient: Client }): Router => {
  const router = express.Router();

  const normalizePath = (pathName: string, req: Request) =>
    pathName.replace(rootPath, '').replace('//', '/');

  const getSongUrl = (): Promise<string> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve('https://song.rdpc-dev.cancercollaboratory.org');
      }, 1000);
    });
  };
  const getScoreUrl = (): Promise<string> => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve('https://score.rdpc-dev.cancercollaboratory.org');
      }, 1000);
    });
  };

  router.use('/entities', async (req, res, next) => {
    await validateAccessibility(req);
    createProxyMiddleware({
      target: await getSongUrl(),
      pathRewrite: normalizePath,
      onError: (err: Error, req: Request, res: Response) => {
        logger.error('Song Router Error - ' + err);
        return res.status(500).send('Internal Server Error');
      },
      changeOrigin: true,
    })(req, res, next);
  });
  router.use('/download', async (req, res, next) => {
    await validateAccessibility(req);
    createProxyMiddleware({
      target: await getScoreUrl(),
      pathRewrite: normalizePath,
      onError: (err: Error, req: Request, res: Response) => {
        logger.error('Score Router Error - ' + err);
        return res.status(500).send('Internal Server Error');
      },
      changeOrigin: true,
    })(req, res, next);
  });

  return router;
};
