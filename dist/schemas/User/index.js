"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
const graphql_tools_1 = require("graphql-tools");
const ego_1 = __importDefault(require("../../services/ego"));
const ego_token_utils_1 = __importDefault(require("@icgc-argo/ego-token-utils/dist/lib/ego-token-utils"));
const config_1 = require("../../config");
const TokenUtils = ego_token_utils_1.default(config_1.EGO_PUBLIC_KEY);
// Construct a schema, using GraphQL schema language
const typeDefs = apollo_server_express_1.gql `
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
        user: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const egoUser = yield ego_1.default.getUser(args.id, egoToken);
            return egoUser === null ? null : convertEgoUser(egoUser);
        }),
        users: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const options = Object.assign({}, args);
            const response = yield ego_1.default.listUsers(options, egoToken);
            const egoUserList = get(response, 'users', []);
            return egoUserList.map(egoUser => convertEgoUser(egoUser));
        }),
        self: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization, egoToken } = context;
            const decodedToken = TokenUtils.decodeToken(egoToken);
            const userId = decodedToken.sub;
            const userGroups = decodedToken.context.user.groups;
            // Retrieve DACO group ids
            const dacoGroupId = yield ego_1.default.getDacoIds(userId, Authorization);
            const isDacoApproved = userGroups.includes(dacoGroupId);
            // API access keys
            const keys = yield ego_1.default.getEgoAccessKeys(userId, Authorization);
            let apiKey = null;
            if (keys.length === 1) {
                const egoApiKeyObj = keys[0];
                const { name: accessToken } = egoApiKeyObj;
                apiKey = { key: accessToken, exp: ego_1.default.getTimeToExpiry(egoApiKeyObj), error: '' };
            }
            else {
                const errorMsg = 'An error has been found with your API key. Please generate a new API key';
                apiKey = { key: null, exp: null, error: errorMsg };
            }
            return createProfile({ apiKey, isDacoApproved });
        }),
    },
    Mutation: {
        generateAccessKey: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { Authorization, egoToken } = context;
            const decodedToken = TokenUtils.decodeToken(egoToken);
            const userName = decodedToken.context.user.name;
            const userId = decodedToken.sub;
            // delete old keys
            const keys = yield ego_1.default.getEgoAccessKeys(userId, Authorization);
            if (keys) {
                yield ego_1.default.deleteKeys(keys, Authorization);
            }
            // get scopes for new token
            const { scopes } = yield ego_1.default.getScopes(userName, Authorization);
            const egoApiKeyObj = yield ego_1.default.generateEgoAccessKey(userId, scopes, Authorization);
            return {
                exp: ego_1.default.getTimeToExpiry(egoApiKeyObj),
                key: egoApiKeyObj.name,
                error: '',
            };
        }),
    },
};
exports.default = graphql_tools_1.makeExecutableSchema({
    typeDefs,
    resolvers,
});
//# sourceMappingURL=index.js.map