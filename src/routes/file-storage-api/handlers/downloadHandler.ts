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

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

const downloadHandler = ({
  rootPath,
  esClient,
  proxyMiddlewareFactory = createProxyMiddleware,
}: {
  rootPath: string;
  esClient: Client;
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
    const repositoryUrl = esFileObject.repositories[0].url;
    const handleRequest = proxyMiddlewareFactory({
      target: repositoryUrl,
      pathRewrite: normalizePath(rootPath),
      onError: (err: Error, req: Request, res: Response) => {
        logger.error('Score Router Error - ' + err);
        return res.status(500).end();
      },
      changeOrigin: true,
    });
    handleRequest(req, res, next);
  } else {
    res.status(req.auth.authenticated ? 403 : 401).end();
  }
};

export default downloadHandler;
