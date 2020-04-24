import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';

import egoService from '../../services/ego';
import { EGO_DACO_POLICY_NAME } from '../../config';
import egoTokenUtils from 'utils/egoTokenUtils';

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
    users(pageNum: Int, limit: Int, sort: String, groups: [String], query: String): [User]

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

const convertEgoUser = user => ({
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

const createProfile = ({ apiKey, isDacoApproved }) => ({
  apiKey,
  isDacoApproved,
});

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    user: async (obj, args, context, info) => {
      const { egoToken } = context;
      const egoUser = await egoService.getUser(args.id, egoToken);
      return egoUser === null ? null : convertEgoUser(egoUser);
    },
    users: async (obj, args, context, info) => {
      const { egoToken } = context;
      const options = {
        ...args,
      };
      const response = await egoService.listUsers(options, egoToken);
      const egoUserList = get(response, 'users', []);
      return egoUserList.map(egoUser => convertEgoUser(egoUser));
    },
    self: async (obj, args, context, info) => {
      const { Authorization, egoToken } = context;
      const decodedToken = egoTokenUtils.decodeToken(egoToken);
      const userId = decodedToken.sub;
      const userScopes = decodedToken.context.scope;
      const isDacoApproved =
        (userScopes || []).includes(`${EGO_DACO_POLICY_NAME}.WRITE`) ||
        (userScopes || []).includes(`${EGO_DACO_POLICY_NAME}.READ`);

      // API access keys
      const keys = await egoService.getEgoAccessKeys(userId, Authorization);
      let apiKey = null;

      if (keys.length === 1) {
        const egoApiKeyObj = keys[0];
        const { name: accessToken } = egoApiKeyObj;
        apiKey = { key: accessToken, exp: egoService.getTimeToExpiry(egoApiKeyObj), error: '' };
      } else {
        const errorMsg = 'An error has been found with your API key. Please generate a new API key';
        apiKey = { key: null, exp: null, error: errorMsg };
      }

      return createProfile({ apiKey, isDacoApproved });
    },
  },
  Mutation: {
    generateAccessKey: async (obj, args, context, info) => {
      const { Authorization, egoToken } = context;
      const decodedToken = egoTokenUtils.decodeToken(egoToken);
      const userName = decodedToken.context.user.name;
      const userId = decodedToken.sub;

      // delete old keys
      const keys = await egoService.getEgoAccessKeys(userId, Authorization);
      if (keys) {
        await egoService.deleteKeys(keys, Authorization);
      }
      // get scopes for new token
      const { scopes } = await egoService.getScopes(userName, Authorization);

      const egoApiKeyObj = await egoService.generateEgoAccessKey(userId, scopes, Authorization);
      return {
        exp: egoService.getTimeToExpiry(egoApiKeyObj),
        key: egoApiKeyObj.name,
        error: '',
      };
    },
  },
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
