import { Request, Response, Handler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from 'utils/logger';
import {
  AuthenticatedRequest,
  hasSufficientDacoAccess,
  hasSufficientProgramMembershipAccess,
} from '../accessValidations';
import { Client } from '@elastic/elasticsearch';
import { ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import esb from 'elastic-builder';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

const getEsFileDocumentByObjectId = (esClient: Client) => (objectId: string) =>
  esClient
    .search({
      index: ARRANGER_FILE_CENTRIC_INDEX,
      body: esb
        .requestBodySearch()
        .query(
          esb
            .boolQuery()
            .must(esb.matchQuery('object_id' as keyof EsFileCentricDocument, objectId)),
        ),
    })
    .then(res => res.body.hits.hits[0]?._source as EsFileCentricDocument | undefined);

const downloadHandler = ({
  rootPath,
  esClient,
}: {
  rootPath: string;
  esClient: Client;
}): Handler => async (req: AuthenticatedRequest<{ fileObjectId: string }>, res, next) => {
  const { fileObjectId } = req.params;
  const esFileObject = await getEsFileDocumentByObjectId(esClient)(fileObjectId);

  if (!esFileObject) {
    return res.status(404).end();
  }

  const isAuthorized = (await Promise.all([
    hasSufficientProgramMembershipAccess({
      scopes: req.userScopes,
      file: esFileObject,
    }),
    hasSufficientDacoAccess({
      scopes: req.userScopes,
      file: esFileObject,
    }),
  ])).every(conditionMet => conditionMet);

  if (isAuthorized) {
    const repositoryUrl = esFileObject.repositories[0].url;
    const handleRequest = createProxyMiddleware({
      target: repositoryUrl,
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

export default downloadHandler;
