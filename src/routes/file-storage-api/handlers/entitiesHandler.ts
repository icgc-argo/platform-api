import { Client } from '@elastic/elasticsearch';
import { Request, Response, Handler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';
import { AuthenticatedRequest } from '../accessValidations';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

const createEntitiesHandler = ({
  esClient,
  rootPath,
}: {
  esClient: Client;
  rootPath: string;
}): Handler => {
  return async (
    req: AuthenticatedRequest<{}, any, any, { gnosId: string; size: string; page: string }>,
    res,
    next,
  ) => {
    /**
     * @todo: actually implement the API at https://song.rdpc-dev.cancercollaboratory.org/swagger-ui.html#/
     */
    const userScopes = req.userScopes;
    // this is just a placeholder logic for demo
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
  };
};

export default createEntitiesHandler;
