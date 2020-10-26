import { Client } from '@elastic/elasticsearch';
import { Request, Response, Handler } from 'express';
import { AuthenticatedRequest } from '../accessValidations';

const normalizePath = (rootPath: string) => (pathName: string, req: Request) =>
  pathName.replace(rootPath, '').replace('//', '/');

const createEntitiesHandler = ({ esClient }: { esClient: Client }): Handler => {
  return async (
    req: AuthenticatedRequest<{}, any, any, { gnosId: string; size: string; page: string }>,
    res,
    next,
  ) => {
    const userScopes = req.userScopes;
  };
};

export default createEntitiesHandler;
