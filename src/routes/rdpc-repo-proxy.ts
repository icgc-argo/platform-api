import { Client } from '@elastic/elasticsearch';
import express, { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';

const validateAccessibility = async (egoJwt?: string) => {
  console.log(`egoJwt: `, egoJwt ? 1 : undefined);
};

const getRdpcUrls = ({
  authorization,
}: {
  authorization?: string;
}): Promise<{ song: string; score: string }> => {
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

  router.use('/entities', async (req, res, next) => {
    const {
      headers: { authorization },
    } = req;
    await validateAccessibility(authorization);
    const handleRequest = createProxyMiddleware({
      target: (await getRdpcUrls({ authorization })).song,
      pathRewrite: normalizePath,
      onError: (err: Error, req: Request, res: Response) => {
        logger.error('Song Router Error - ' + err);
        return res.status(500).send('Internal Server Error');
      },
      changeOrigin: true,
    });
    handleRequest(req, res, next);
  });
  router.use('/download', async (req, res, next) => {
    const {
      headers: { authorization },
    } = req;
    await validateAccessibility(authorization);
    const handleRequest = createProxyMiddleware({
      target: (await getRdpcUrls({ authorization })).score,
      pathRewrite: normalizePath,
      onError: (err: Error, req: Request, res: Response) => {
        logger.error('Score Router Error - ' + err);
        return res.status(500).send('Internal Server Error');
      },
      changeOrigin: true,
    });
    handleRequest(req, res, next);
  });

  return router;
};
