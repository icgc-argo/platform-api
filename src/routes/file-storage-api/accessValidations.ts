import { Handler, Request } from 'express';
import egoTokenUtils from 'utils/egoTokenUtils';
import fetch from 'node-fetch';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';
import { PermissionScopeObj } from '@icgc-argo/ego-token-utils/dist/common';
import { EGO_ROOT_REST } from 'config';

export const hasSufficientProgramMembershipAccess = async (config: {
  scopes: PermissionScopeObj[];
  file?: EsFileCentricDocument;
}): Promise<boolean> => {
  /**
   * @todo: actually implement this function
   */
  if (config.scopes && config.file) {
    return true;
  } else {
    return true;
  }
};

export const hasSufficientDacoAccess = async (config: {
  scopes: PermissionScopeObj[];
  file?: EsFileCentricDocument;
}): Promise<boolean> => {
  return true;
};

export type AuthenticatedRequest<Params = {}, T1 = any, T2 = any, Query = {}> = Request<
  Params,
  T1,
  T2,
  Query
> & { userScopes: PermissionScopeObj[] };
const extractUserScopes = async (
  authHeader?: string,
): Promise<{ scopes: string[]; errorCode?: number }> => {
  const AUTH_ERROR_CODE = 401;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const jwtData = egoTokenUtils.decodeToken(token);
      const expired = egoTokenUtils.isExpiredToken(jwtData);
      if (expired) {
        return { scopes: [], errorCode: AUTH_ERROR_CODE };
      }
      return {
        scopes: jwtData.context.scope,
      };
    } catch (err) {
      return fetch(`${EGO_ROOT_REST}/o/check_api_key?apiKey=${token}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',

          /** @Todo replace this guy */
          Authorization: `Basic ...`,
        },
      })
        .then(res => res.json())
        .then(data => ({ scopes: data.scope as string[] }))
        .catch(err => ({ scopes: [], errorCode: AUTH_ERROR_CODE }));
    }
  } else {
    return { scopes: [], errorCode: AUTH_ERROR_CODE };
  }
};
export const storageApiAuthenticationMiddleware: Handler = async (req: Request, res, next) => {
  const { authorization } = req.headers;
  const userScope = await extractUserScopes(authorization);
  if (userScope.errorCode) {
    res.status(userScope.errorCode).end();
  } else {
    (req as AuthenticatedRequest).userScopes = userScope.scopes.map(egoTokenUtils.parseScope);
    next();
  }
};
