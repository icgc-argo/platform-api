import { IFieldResolver, IResolvers } from 'apollo-server-express';
import { GraphQLFieldResolver } from 'graphql';

const donorSummaryEntriesResolver: GraphQLFieldResolver<unknown, unknown> = () => {
  return [];
};

const resolvers = {
  donorSummaryEntries: donorSummaryEntriesResolver,
};

export default resolvers;
