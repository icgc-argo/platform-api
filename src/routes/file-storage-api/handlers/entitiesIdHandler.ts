import { Client } from '@elastic/elasticsearch';
import { Request, Handler } from 'express';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';
import { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import { hasSufficientProgramMembershipAccess } from 'routes/utils/accessValidations';
import { getEsFileDocumentByObjectId, toSongEntity } from '../utils';

const createEntitiesIdHandler = ({ esClient }: { esClient: Client }): Handler => {
  return async (req: AuthenticatedRequest, res, next) => {
    const file = await getEsFileDocumentByObjectId(esClient)(req.params.fileObjectId);
    const isAuthorized = hasSufficientProgramMembershipAccess({
      scopes: req.auth.scopes,
      file,
    });
    if (isAuthorized) {
      res.status(200).send(toSongEntity(file as EsFileCentricDocument));
    } else {
      res.status(req.auth.authenticated ? 403 : 401).end();
    }
  };
};

export default createEntitiesIdHandler;
