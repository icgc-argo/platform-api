import { makeExecutableSchema } from 'graphql-tools';

import resolvers from './resolvers';
import typeDefs from './gqlTypeDefs';

export default async () =>
  makeExecutableSchema({
    typeDefs,
    resolvers: await resolvers(),
  });
