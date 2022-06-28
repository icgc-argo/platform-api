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

import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import get from 'lodash/get';

import {
  EgoClient,
  EgoGrpcUser,
  ListUserSortOptions,
} from '../../services/ego';
import { EGO_DACO_POLICY_NAME } from '../../config';
import egoTokenUtils from 'utils/egoTokenUtils';
import { GlobalGqlContext } from 'app';
import logger from '../../utils/logger';

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type User {
    id: String!
    email: String!
    firstName: String
    lastName: String
    name: String
    preferredLanguage: String
    status: String
    type: String
    applications: [String]
    groups: [String]
    scopes: [String]

    """
    ISO Formatted DateTime:
    """
    createdAt: String

    """
    ISO Formatted DateTime:
    """
    lastLogin: String
  }

  type AccessKey {
    key: String
    error: String

    """
    Time till expiry in milliseconds
    """
    exp: Int
  }

  type Profile {
    isDacoApproved: Boolean
    apiKey: AccessKey
  }

  type Query {
    """
    retrieve User data by id
    """
    user(id: String!): User

    """
    retrieve paginated list of user data
    """
    users(
      pageNum: Int
      limit: Int
      sort: String
      groups: [String]
      query: String
    ): [User]

    """
    retrive user profile data
    """
    self: Profile
  }

  type Mutation {
    """
    Generate Ego access key
    """
    generateAccessKey: AccessKey!
  }
`;

const convertEgoUser = (user: EgoGrpcUser) => ({
  id: get(user, 'id.value'),
  email: get(user, 'email.value'),
  firstName: get(user, 'first_name.value'),
  lastName: get(user, 'last_name.value'),
  createdAt: get(user, 'created_at.value'),
  lastLogin: get(user, 'last_login.value'),
  name: get(user, 'name.value'),
  preferredLanguage: get(user, 'preferred_language.value'),
  status: get(user, 'status.value'),
  type: get(user, 'type.value'),
  applications: get(user, 'applications'),
  groups: get(user, 'groups'),
  scopes: get(user, 'scopes'),
});

const createProfile = ({
  apiKey,
  isDacoApproved,
}: {
  apiKey: unknown;
  isDacoApproved: unknown;
}) => ({
  apiKey,
  isDacoApproved,
});

// Provide resolver functions for your schema fields
const createResolvers = (egoClient: EgoClient) => {
  return {
    Query: {
      user: async (
        obj: unknown,
        args: { id: string },
        context: GlobalGqlContext,
      ) => {
        const { egoToken } = context;
        const egoUser: EgoGrpcUser = await egoClient.getUser(args.id, egoToken);
        return egoUser === null ? null : convertEgoUser(egoUser);
      },
      users: async (
        obj: unknown,
        args: ListUserSortOptions,
        context: GlobalGqlContext,
      ) => {
        const { egoToken } = context;
        const options = {
          ...args,
        };
        const response = await egoClient.listUsers(options, egoToken);
        const egoUserList: EgoGrpcUser[] = get(response, 'users', []);
        return egoUserList.map((egoUser) => convertEgoUser(egoUser));
      },
      self: async (
        obj: unknown,
        args: undefined,
        context: GlobalGqlContext,
      ) => {
        const { Authorization, egoToken, userJwtData } = context;
        logger.info({ Authorization, egoToken, userJwtData });
        const jwt = egoToken.replace('Bearer ', '');
        const decodedToken = egoTokenUtils.decodeToken(jwt);
        const userId = decodedToken.sub;
        const userScopes = decodedToken.context.scope;
        const isDacoApproved =
          (userScopes || []).includes(`${EGO_DACO_POLICY_NAME}.WRITE`) ||
          (userScopes || []).includes(`${EGO_DACO_POLICY_NAME}.READ`);

        // API access keys
        const keys = await egoClient.getEgoAccessKeys(userId, Authorization);
        let apiKey = null;

        if (keys.length === 1) {
          const egoApiKeyObj = keys[0];
          const { name: accessToken } = egoApiKeyObj;
          apiKey = {
            key: accessToken,
            exp: egoClient.getTimeToExpiry(egoApiKeyObj),
            error: '',
          };
        } else {
          const errorMsg =
            'An error has been found with your API key. Please generate a new API key';
          apiKey = { key: null, exp: null, error: errorMsg };
        }

        return createProfile({ apiKey, isDacoApproved });
      },
    },
    Mutation: {
      generateAccessKey: async (
        obj: unknown,
        args: undefined,
        context: GlobalGqlContext,
      ) => {
        const { Authorization, egoToken } = context;
        const decodedToken = egoTokenUtils.decodeToken(
          egoToken.replace('Bearer ', ''),
        );
        const userId = decodedToken.sub;

        // delete old keys
        const keys = await egoClient.getEgoAccessKeys(userId, Authorization);
        if (keys) {
          await egoClient.deleteKeys(keys, Authorization);
        }
        // get scopes for new token
        const { scopes } = await egoClient.getScopes(userId, Authorization);

        const egoApiKeyObj = await egoClient.generateEgoAccessKey(
          userId,
          scopes,
          Authorization,
        );
        return {
          exp: egoClient.getTimeToExpiry(egoApiKeyObj),
          key: egoApiKeyObj.name,
          error: '',
        };
      },
    },
  };
};

export default (egoClient: EgoClient) =>
  makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers(egoClient),
  });
