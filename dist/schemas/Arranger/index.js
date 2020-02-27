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
const graphql_tools_1 = require("graphql-tools");
const apollo_link_context_1 = require("apollo-link-context");
const apollo_link_http_1 = require("apollo-link-http");
const node_fetch_1 = __importDefault(require("node-fetch"));
const url_join_1 = __importDefault(require("url-join"));
const config_1 = require("../../config");
const apiRoot = url_join_1.default(config_1.ARRANGER_ROOT, config_1.ARRANGER_PROJECT_ID, 'graphql');
exports.default = () => __awaiter(void 0, void 0, void 0, function* () {
    const link = apollo_link_context_1.setContext((request, { graphqlContext = {} } = {}) => ({
        headers: {
            Authorization: graphqlContext.isUserRequest
                ? `Bearer ${graphqlContext.egoToken}`
                : `Bearer ${config_1.EGO_JWT_SECRET}`,
        },
    })).concat(new apollo_link_http_1.HttpLink({
        uri: apiRoot,
        fetch: node_fetch_1.default,
    }));
    const schema = yield graphql_tools_1.introspectSchema(link);
    const executableSchema = graphql_tools_1.makeRemoteExecutableSchema({
        schema: schema,
        link,
    });
    const transformedSchema = graphql_tools_1.transformSchema(executableSchema, [
        new graphql_tools_1.FilterRootFields((operation, rootField) => !['viewer', 'saveAggsState', 'saveColumnsState', 'saveMatchBoxState'].includes(rootField)),
    ]);
    return transformedSchema;
});
//# sourceMappingURL=index.js.map