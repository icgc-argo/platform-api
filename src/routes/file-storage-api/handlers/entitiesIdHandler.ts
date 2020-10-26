import { Client } from '@elastic/elasticsearch';
import { fil } from 'date-fns/locale';
import { Request, Response, Handler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';
import logger from 'utils/logger';
import { AuthenticatedRequest, hasSufficientProgramMembershipAccess } from '../accessValidations';
import { getEsFileDocumentByObjectId } from '../utils';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

const toSongEntity = (
  file: EsFileCentricDocument,
): {
  id: string;
  gnosId: string;
  fileName: string;
  projectCode: string;
  access: 'controlled' | 'public';
} => ({
  access: file.file_access,
  fileName: file.file.name,
  id: file.object_id,
  gnosId: file.analysis.analysis_id,
  projectCode: file.program_id,
});

const createEntitiesIdHandler = ({
  esClient,
  rootPath,
}: {
  esClient: Client;
  rootPath: string;
}): Handler => {
  return async (req: AuthenticatedRequest<{ fileObjectId: string }>, res, next) => {
    const file = await getEsFileDocumentByObjectId(esClient)(req.params.fileObjectId);
    const isAuthorized = hasSufficientProgramMembershipAccess({
      scopes: req.userScopes,
      file,
    });
    if (isAuthorized) {
      res.send(toSongEntity(file as EsFileCentricDocument)).status(200);
    } else {
      res.status(403);
    }
  };
};

export default createEntitiesIdHandler;
