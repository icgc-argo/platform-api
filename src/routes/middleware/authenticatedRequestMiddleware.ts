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
import { EgoClient } from 'services/ego';
import { PermissionScopeObj } from '@icgc-argo/ego-token-utils';

export type AuthenticatedRequest<Params = {}, T1 = any, T2 = any, Query = {}> = Request<
  Params,
  T1,
  T2,
  Query
> & { userScopes: PermissionScopeObj[]; authenticated: boolean };

const extractUserScopes = async (config: {
  authHeader?: string;
  egoClient: EgoClient;
}): Promise<{ scopes: string[]; authenticated: boolean }> => {
  const { authHeader, egoClient } = config;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const jwtData = egoTokenUtils.decodeToken(token);
      const valid = egoTokenUtils.isValidJwt(token);
      if (!valid) {
        return { scopes: [], authenticated: false };
      }
      return {
        scopes: jwtData.context.scope,
        authenticated: true,
      };
    } catch (err) {
      // The best way to identify if we have an API Key or a JWT is to try to decode it as a JWT and parse it accordingly.
      // If it is not the JWT then it will throw an error and arriver here, where we can attempt to treat it as the API Key
      // If it is also not an API Key then the final .catch block will handle setting authenticated to false.
      return egoClient
        .checkApiKey({ apiKey: token })
        .then(data => ({ scopes: data.scope as string[], authenticated: true }))
        .catch(err => ({ scopes: [], authenticated: false }));
    }
  } else {
    return { scopes: [], authenticated: false };
  }
};

type AuthenticationMiddleware = (config: { egoClient: EgoClient }) => Handler;
const authenticatedRequestMiddleware: AuthenticationMiddleware = ({ egoClient }) => {
  return async (req: Request, res, next) => {
    const { authorization } = req.headers;
    const userScope = await extractUserScopes({
      egoClient,
      authHeader: authorization,
    });
    (req as AuthenticatedRequest).userScopes = userScope.scopes.map(egoTokenUtils.parseScope);
    (req as AuthenticatedRequest).authenticated = userScope.authenticated;
    next();
  };
};

export default authenticatedRequestMiddleware;
