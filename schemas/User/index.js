import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import DataLoader from 'dataloader';
import { get } from 'lodash';

import egoService from '../../services/ego';

import createEgoUtils from '@icgc-argo/ego-token-utils/dist/lib/ego-token-utils';

import { EGO_PUBLIC_KEY } from '../../config';
const TokenUtils = createEgoUtils(EGO_PUBLIC_KEY);

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

  type AccessKeyResp {
    key: String
    error: String
    exp: Int
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
    profile: String
  }

  type Mutation {
    """
    Generate Ego access key
    """
    generateAccessKey: AccessKeyResp!
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
    /*
    accessKey: async (obj, args, context, info) => {
      const { Authorization, egoToken } = context;
      const decodedToken = TokenUtils.decodeToken(egoToken);
      const userId = decodedToken.sub;

      const errorMsg = 'An error has been found with your API key. Please generate a new API key';
      const keys = await egoService.getEgoAccessKeys(userId, Authorization);

      const errorResponse = { key: null, exp: null, error: errorMsg };

      // a user should have only one key
      if (keys.length === 1) {
        const key = keys[0];
        return { key: key.accessToken, exp: key.exp, error: '' };
      } else if (keys.length === 0) {
        return null;
      } else {
        return errorResponse;
      }
    },*/
    profile: async (obj, args, context, info) => {
      const { Authorization, egoToken } = context;
      const decodedToken = TokenUtils.decodeToken(egoToken);
      const userId = decodedToken.sub;
      // Retrieve DACO and CLOUD group ids
      const x = await egoService.getDACOIds(userId, Authorization);
      console.log('daco id', x);
      return '';
    },
  },
  Mutation: {
    generateAccessKey: async (obj, args, context, info) => {
      const { Authorization, egoToken } = context;
      const decodedToken = TokenUtils.decodeToken(egoToken);
      const userName = decodedToken.context.user.name;
      const userId = decodedToken.sub;

      // delete old keys
      const keys = await egoService.getEgoAccessKeys(userId, Authorization);
      const deletions = await egoService.deleteKeys(keys, Authorization);

      // get scopes for new token
      const { scopes } = await egoService.getScopes(userName, Authorization);

      const response = await egoService.generateEgoAccessKey(userId, scopes, Authorization);
      return { exp: response.exp, key: response.accessToken, error: '' };
    },
  },
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
