import { Client } from '@elastic/elasticsearch';
import { Request, Handler } from 'express';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';
import { AuthenticatedRequest, hasSufficientProgramMembershipAccess } from '../accessValidations';
import { getEsFileDocumentByObjectId, toSongEntity } from '../utils';

const createEntitiesIdHandler = ({ esClient }: { esClient: Client }): Handler => {
  return async (req: AuthenticatedRequest<{ fileObjectId: string }>, res, next) => {
    const file = await getEsFileDocumentByObjectId(esClient)(req.params.fileObjectId);
    const isAuthorized = hasSufficientProgramMembershipAccess({
      scopes: req.userScopes,
      file,
    });
    if (isAuthorized) {
      res.status(200).send(toSongEntity(file as EsFileCentricDocument));
    } else {
      res.status(403).end();
    }
  };
};

export default createEntitiesIdHandler;
