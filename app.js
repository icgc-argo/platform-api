import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { mergeSchemas } from 'graphql-tools';
import costAnalysis from 'graphql-cost-analysis';

import userSchema from './schemas/User';
import programSchema from './schemas/Program';
import {PORT, NODE_ENV, GQL_MAX_COST, SUBMISSION_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH} from './config';
import config from './package.json';
import costDirectiveTypeDef from './schemas/costDirectiveTypeDef';
import urlJoin from "url-join";
import fetch from "node-fetch";

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
        onComplete: cost => console.log(`QUERY_COST: ${cost}`),
      }),
    ],
  };
};

const init = async () => {
  const schemas = [userSchema, programSchema];

  const server = new ApolloServer({
    schema: mergeSchemas({
      schemas,
    }),
    context: ({ req }) => ({
      isUserRequest: true,
      egoToken: (req.headers.authorization || '').split('Bearer ').join(''),
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

  // Our specification download service can't use GraphQL because GraphQL specification requires the content-type
  // that it returns be json, and we want to be able to return other content types, such as tab-separated-values,
  // so that the user is automatically prompted to save the file from their browser.
  const apiRoot = urlJoin(SUBMISSION_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH);
  app.get('/downloads', async (req,res) => {
    const name = req.query.template;
    if (name == undefined) {
      res.json({error: "Invalid query: use parameter template to specify the desired template file."});
    } else {
      const data = fetch(urlJoin(apiRoot, name), {synchronous: true}).then( (r) => {
          res.status(r.status);
          res.headers = r.headers;
          // copying headers doesn't copy the content-type header...
          res.contentType(r.headers.get('content-type'));
          res.send(r.body.read());
      });
    }
  });

  app.listen(PORT, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`),
  );
};

init();
