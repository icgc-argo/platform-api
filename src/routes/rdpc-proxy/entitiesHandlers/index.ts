import { Client } from '@elastic/elasticsearch';
import { Request, Response, Handler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

export default ({
  esClient,
  rootPath,
}: {
  esClient: Client;
  rootPath: string;
}): {
  entitiesHandler: Handler;
  entitiesIdHandler: Handler;
} => {
  return {
    entitiesHandler: async (
      req: Request<{}, any, any, { gnosId: string; size: string; page: string }>,
      res,
      next,
    ) => {
      /**
       * @todo: actually implement the API
       */
      const handleRequest = createProxyMiddleware({
        target: 'https://song.rdpc-dev.cancercollaboratory.org',
        pathRewrite: normalizePath(rootPath),
        onError: (err: Error, req: Request, res: Response) => {
          logger.error('Song Router Error - ' + err);
          return res.status(500).send('Internal Server Error');
        },
        changeOrigin: true,
      });
      handleRequest(req, res, next);
    },
    entitiesIdHandler: async (req: Request<{ fileObjectId: string }>, res, next) => {
      /**
       * @todo: actually implement the API
       */
      const handleRequest = createProxyMiddleware({
        target: 'https://song.rdpc-dev.cancercollaboratory.org',
        pathRewrite: normalizePath(rootPath),
        onError: (err: Error, req: Request, res: Response) => {
          logger.error('Song Router Error - ' + err);
          return res.status(500).send('Internal Server Error');
        },
        changeOrigin: true,
      });
      handleRequest(req, res, next);
    },
  };
};
