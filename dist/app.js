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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const apollo_server_express_1 = require("apollo-server-express");
const graphql_tools_1 = require("graphql-tools");
const graphql_cost_analysis_1 = __importDefault(require("graphql-cost-analysis"));
const swaggerUi = __importStar(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const User_1 = __importDefault(require("./schemas/User"));
const Program_1 = __importDefault(require("./schemas/Program"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const Clinical_1 = __importDefault(require("./schemas/Clinical"));
const package_json_1 = __importDefault(require("./package.json"));
const logger_1 = __importDefault(require("./utils/logger"));
const clinical = require('./routes/clinical');
const kafkaProxyRoute = require('./routes/kafka-rest-proxy');
const { version } = package_json_1.default;
apollo_server_express_1.ApolloServer.prototype._createGraphQLServerOptions =
    apollo_server_express_1.ApolloServer.prototype.createGraphQLServerOptions;
apollo_server_express_1.ApolloServer.prototype.createGraphQLServerOptions = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield this._createGraphQLServerOptions(req, res);
        logger_1.default.debug(`
==== gql request ====
query: ${req.body.query}
variables: ${JSON.stringify(req.body.variables)}
=====================
    `);
        return Object.assign(Object.assign({}, options), { validationRules: [
                ...(options.validationRules || []),
                graphql_cost_analysis_1.default({
                    variables: req.body.variables,
                    maximumCost: config_1.GQL_MAX_COST,
                    // logs out complexity so we can later on come back and decide on appropriate limit
                    onComplete: cost => logger_1.default.info(`QUERY_COST: ${cost}`),
                }),
            ] });
    });
};
const init = () => __awaiter(void 0, void 0, void 0, function* () {
    const schemas = [User_1.default, Program_1.default, Clinical_1.default];
    const server = new apollo_server_express_1.ApolloServer({
        schema: graphql_tools_1.mergeSchemas({
            schemas,
        }),
        context: ({ req }) => ({
            isUserRequest: true,
            egoToken: (req.headers.authorization || '').split('Bearer ').join(''),
            Authorization: `Bearer ${(req.headers.authorization || '').replace(/^Bearer[\s]*/, '')}` || '',
            dataLoaders: {},
        }),
        introspection: true,
        tracing: config_1.NODE_ENV !== 'production',
    });
    const app = express_1.default();
    app.use(cors_1.default());
    server.applyMiddleware({ app, path: '/graphql' });
    app.get('/status', (req, res) => {
        res.json(version);
    });
    app.use('/kafka', kafkaProxyRoute);
    app.use('/clinical', clinical);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(yamljs_1.default.load(path_1.default.join(__dirname, './resources/swagger.yaml'))));
    app.listen(config_1.PORT, () => logger_1.default.info(`🚀 Server ready at http://localhost:${config_1.PORT}${server.graphqlPath}`));
});
exports.default = init;
//# sourceMappingURL=app.js.map