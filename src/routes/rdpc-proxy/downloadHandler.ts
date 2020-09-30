import { Request, Response, Handler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';
import validateFileAccess from './validateFileAccess';
import { Client } from '@elastic/elasticsearch';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

export default ({ rootPath, esClient }: { rootPath: string; esClient: Client }): Handler => async (
  req: Request<{ fileObjectId: string }>,
  res,
  next,
) => {
  const {
    headers: { authorization },
  } = req;
  const egoJwtOrApiKey = (authorization || "")?.split('Bearer ').join('')
  const isAuthorized = await validateFileAccess({
    egoJwtOrApiKey,
    file: undefined,
  });
  /** @todo: use esClient to retrieve file to locate rdpc url for proxy */
  const { fileObjectId } = req.params;
  if (isAuthorized) {
    const handleRequest = createProxyMiddleware({
      target: 'https://score.rdpc-dev.cancercollaboratory.org',
      pathRewrite: normalizePath(rootPath),
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
};
