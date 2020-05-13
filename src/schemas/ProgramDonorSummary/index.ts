import { makeExecutableSchema } from 'graphql-tools';

import resolvers from './resolvers';
import typeDefs from './gqlTypeDefs';
import { Client } from '@elastic/elasticsearch';

export default async (esClient: Client) =>
  makeExecutableSchema({
    typeDefs,
    resolvers: await resolvers(esClient),
  });
