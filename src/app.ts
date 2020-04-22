import 'babel-polyfill'; // needed for arranger imported functions
import express from 'express';
import cors from 'cors';
import { Client } from '@elastic/elasticsearch';
import { ApolloServer } from 'apollo-server-express';
import { mergeSchemas } from 'graphql-tools';
import * as swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';

import {
  PORT,
  NODE_ENV,
  GQL_MAX_COST,
  APP_DIR,
  PROGRAM_DASHBOARD_SUMMARY_ENABLED,
  ARRANGER_SCHEMA_ENABLED,
  ARRANGER_PROJECT_ID,
} from './config';

import clinical from './routes/clinical';
import kafkaProxyRoute from './routes/kafka-rest-proxy';

import UserSchema from './schemas/User';
import ProgramSchema from './schemas/Program';
import ClinicalSchema from './schemas/Clinical';
import ProgramDashboardSummarySchema from './schemas/ProgramDonorSummary';
import ArrangerSchema from './schemas/Arranger';

import { getEsClient } from 'services/elasticsearch';

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
  es?: Client; // needed for arranger schema
  projectId?: string; // needed for arranger schema
};

const init = async () => {
  const esClient = await getEsClient();

  const schemas = [
    UserSchema,
    ProgramSchema,
    ClinicalSchema,
    await ProgramDashboardSummarySchema(),
    ...(ARRANGER_SCHEMA_ENABLED ? [await ArrangerSchema()] : []),
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
      ...(ARRANGER_SCHEMA_ENABLED ? { es: esClient, projectId: ARRANGER_PROJECT_ID } : undefined),
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
