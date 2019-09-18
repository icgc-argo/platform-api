import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { mergeSchemas } from 'graphql-tools';
import costAnalysis from 'graphql-cost-analysis';
import * as swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import userSchema from './schemas/User';
import programSchema from './schemas/Program';
import path from 'path';

import { PORT, NODE_ENV, GQL_MAX_COST } from './config';
import clinicalSchema from './schemas/Clinical';

import config from './package.json';
import logger from './utils/logger';
const clinical = require('./routes/clinical');

const { version } = config;

ApolloServer.prototype._createGraphQLServerOptions =
  ApolloServer.prototype.createGraphQLServerOptions;

ApolloServer.prototype.createGraphQLServerOptions = async function(req, res) {
  const options = await this._createGraphQLServerOptions(req, res);

  return {
    ...options,
    validationRules: [
      ...(options.validationRules || []),
      costAnalysis({
        variables: req.body.variables,
        maximumCost: GQL_MAX_COST,
        // logs out complexity so we can later on come back and decide on appropriate limit
        onComplete: cost => logger.info(`QUERY_COST: ${cost}`),
      }),
    ],
  };
};

const init = async () => {
  const schemas = [userSchema, programSchema, clinicalSchema];

  const server = new ApolloServer({
    schema: mergeSchemas({
      schemas,
    }),
    context: ({ req }) => ({
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

init();
