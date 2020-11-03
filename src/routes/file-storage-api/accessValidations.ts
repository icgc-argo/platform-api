/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { Handler, Request } from 'express';
import egoTokenUtils from 'utils/egoTokenUtils';
import {
  EsFileCentricDocument,
  FILE_ACCESS,
  FILE_RELEASE_STAGE,
} from 'utils/commonTypes/EsFileCentricDocument';
import { EgoClient } from 'services/ego';

/**
 * duplication from ego-token-utils
 * import isn't working from `@icgc-argo/ego-token-utils`
 */
export const PERMISSIONS: {
  READ: string;
  WRITE: string;
  ADMIN: string;
  DENY: string;
} = {
  READ: 'READ',
  WRITE: 'WRITE',
  ADMIN: 'ADMIN',
  DENY: 'DENY',
};

export type PermissionScopeObj = {
  policy: string;
  permission: keyof typeof PERMISSIONS;
};

enum UserProgramMembershipAccessLevel {
  DCC_MEMBER = 'DCC_MEMBER',
  FULL_PROGRAM_MEMBER = 'FULL_PROGRAM_MEMBER',
  ASSOCIATE_PROGRAM_MEMBER = 'ASSOCIATE_PROGRAM_MEMBER',
  PUBLIC_MEMBER = 'PUBLIC_MEMBER',
}
/**
 * End duplication
 */

export const hasSufficientProgramMembershipAccess = (config: {
  scopes: PermissionScopeObj[];
  file?: EsFileCentricDocument;
}): boolean => {
  if (config.scopes && config.file) {
    const { scopes, file } = config;
    const releaseStage = file.release_stage;

    const serializedScopes = scopes.map(egoTokenUtils.serializeScope);
    const accessLevel = egoTokenUtils.getProgramMembershipAccessLevel({
      permissions: serializedScopes,
    });

    const programId = file.study_id;

    if (releaseStage === FILE_RELEASE_STAGE.OWN_PROGRAM) {
      return (
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({ permissions: serializedScopes, programId })
      );
    }

    if (releaseStage === FILE_RELEASE_STAGE.FULL_PROGRAMS) {
      return (
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({ permissions: serializedScopes, programId }) ||
        accessLevel === UserProgramMembershipAccessLevel.FULL_PROGRAM_MEMBER
      );
    }

    if (releaseStage === FILE_RELEASE_STAGE.ASSOCIATE_PROGRAMS) {
      return (
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({ permissions: serializedScopes, programId }) ||
        accessLevel === UserProgramMembershipAccessLevel.FULL_PROGRAM_MEMBER ||
        accessLevel === UserProgramMembershipAccessLevel.ASSOCIATE_PROGRAM_MEMBER
      );
    }

    if (releaseStage === FILE_RELEASE_STAGE.PUBLIC) {
      const hasAccess =
        accessLevel === UserProgramMembershipAccessLevel.DCC_MEMBER ||
        egoTokenUtils.canReadProgramData({ permissions: serializedScopes, programId }) ||
        accessLevel === UserProgramMembershipAccessLevel.FULL_PROGRAM_MEMBER ||
        accessLevel === UserProgramMembershipAccessLevel.ASSOCIATE_PROGRAM_MEMBER ||
        accessLevel === UserProgramMembershipAccessLevel.PUBLIC_MEMBER;

      return file.file_access === FILE_ACCESS.CONTROLLED
        ? hasAccess && hasSufficientDacoAccess({ scopes })
        : hasAccess;
    }
  }
  return false;
};

export const hasSufficientDacoAccess = (config: { scopes: PermissionScopeObj[] }): boolean => {
  const dacoScope = config.scopes.find(({ policy }) => policy === 'DACO');
  return dacoScope && dacoScope.permission === PERMISSIONS.READ ? true : false;
};

export type AuthenticatedRequest<Params = {}, T1 = any, T2 = any, Query = {}> = Request<
  Params,
  T1,
  T2,
  Query
> & { userScopes: PermissionScopeObj[] };

const extractUserScopes = async (config: {
  authHeader?: string;
  egoClient: EgoClient;
}): Promise<{ scopes: string[]; errorCode?: number }> => {
  const { authHeader, egoClient } = config;
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
      return egoClient
        .checkApiKey({ apiKey: token })
        .then(data => ({ scopes: data.scope as string[] }))
        .catch(err => ({ scopes: [], errorCode: AUTH_ERROR_CODE }));
    }
  } else {
    return { scopes: [], errorCode: AUTH_ERROR_CODE };
  }
};

type AuthenticationMiddleware = (config: { egoClient: EgoClient; required: boolean }) => Handler;
export const storageApiAuthenticationMiddleware: AuthenticationMiddleware = ({
  egoClient,
  required,
}) => {
  return async (req: Request, res, next) => {
    const { authorization } = req.headers;
    const userScope = await extractUserScopes({
      egoClient,
      authHeader: authorization,
    });
    if (userScope.errorCode && required) {
      res.status(userScope.errorCode).end();
    } else {
      (req as AuthenticatedRequest).userScopes = userScope.scopes.map(egoTokenUtils.parseScope);
      next();
    }
  };
};
