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
    accessKey: String
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
    self
    """
    self: AccessKeyResp
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
  User: {},
  Query: {
    user: async (obj, args, context, info) => {
      const { egoToken } = context;

      const egoUser = await egoService.getUser(args.id, egoToken);
      return egoUser === null ? null : convertEgoUser(egoUser);
    },
    users: async (obj, args, context, info) => {
      console.log('context', context);

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
      const decodedToken = TokenUtils.decodeToken(egoToken);
      const userId = decodedToken.sub;

      const errorMsg = 'An error has been found with your API key. Please generate a new API key';
      const response = await egoService.getApiToken(userId, Authorization);
      const { accessToken: accessKey, exp } = response[0];

      return {
        accessKey: accessKey.length === 1 ? accessKey[0] : '',
        error: !accessKey || accessKey.length !== 1 ? errorMsg : '',
        exp: exp,
      };
    },
  },
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
