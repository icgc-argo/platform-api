import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { mergeSchemas } from 'graphql-tools';
import * as swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import userSchema from './schemas/User';
import programSchema from './schemas/Program';
import path from 'path';
import clinical from './routes/clinical';
import kafkaProxyRoute from './routes/kafka-rest-proxy';
import { PORT, NODE_ENV, GQL_MAX_COST, APP_DIR, PROGRAM_DASHBOARD_SUMMARY_ENABLED } from './config';
import clinicalSchema from './schemas/Clinical';
import ProgramDashboardSummarySchema from './schemas/ProgramDonorSummary';
import logger from './utils/logger';
// @ts-ignore
import costAnalysis from 'graphql-cost-analysis';

const config = require(path.join(APP_DIR, '../package.json'));

const { version } = config;

const _createGraphQLServerOptions = ApolloServer.prototype.createGraphQLServerOptions;

ApolloServer.prototype.createGraphQLServerOptions = async function(req, res) {
  const options = await _createGraphQLServerOptions.bind(this)(req, res);
  logger.debug(
    `
==== gql request ====
query: ${req.body.query}
variables: ${JSON.stringify(req.body.variables)}
=====================
    `,
  );

  return {
    ...options,
    validationRules: [
      ...(options.validationRules || []),
      costAnalysis({
        variables: req.body.variables,
        maximumCost: GQL_MAX_COST,
        // logs out complexity so we can later on come back and decide on appropriate limit
        onComplete: (cost: number) => logger.info(`QUERY_COST: ${cost}`),
      }),
    ],
  };
};

export type GlobalGqlContext = {
  isUserRequest: boolean;
  egoToken: string;
  Authorization: string;
  dataLoaders: {};
};

const init = async () => {
  const schemas = [
    userSchema,
    programSchema,
    clinicalSchema,
    ...(PROGRAM_DASHBOARD_SUMMARY_ENABLED ? [await ProgramDashboardSummarySchema()] : []),
  ];

  const server = new ApolloServer({
    schema: mergeSchemas({
      schemas,
    }),
    context: ({ req }): GlobalGqlContext => ({
      isUserRequest: true,
      egoToken: (req.headers.authorization || '').split('Bearer ').join(''),
      Authorization:
        `Bearer ${(req.headers.authorization || '').replace(/^Bearer[\s]*/, '')}` || '',
      dataLoaders: {},
    }),
    introspection: true,
    tracing: NODE_ENV !== 'production',
  });

  const app = express();
  app.use(cors());
  server.applyMiddleware({ app, path: '/graphql' });
  app.get('/status', (req, res) => {
    res.json(version);
  });

  app.use('/kafka', kafkaProxyRoute);
  app.use('/clinical', clinical);

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(yaml.load(path.join(__dirname, './resources/swagger.yaml'))),
  );

  app.listen(PORT, () =>
    logger.info(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`),
  );
};

export default init;
