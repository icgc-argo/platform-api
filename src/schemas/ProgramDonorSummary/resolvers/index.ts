import { IResolvers } from 'graphql-tools';
import { GlobalGqlContext } from 'app';
import { createEsClient } from 'services/elasticsearch';
import programDonorSummaryEntriesResolver from './summaryEntries';
import programDonorSummaryStatsResolver from './summaryStats';
import { GraphQLFieldResolver } from 'graphql';
import egoTokenUtils from 'utils/egoTokenUtils';
import { AuthenticationError, ApolloError } from 'apollo-server-express';

class UnauthorizedError extends ApolloError {
  extensions = {
    code: 'UNAUTHORIZED',
  };
}

const resolveWithProgramAuth = <ResolverType = GraphQLFieldResolver<any, any, any>>(
  context: GlobalGqlContext,
  args: { programShortName: string },
  resolver: ResolverType,
): ResolverType => {
  const { egoToken } = context;
  const {
    decodeToken,
    isExpiredToken,
    getPermissionsFromToken,
    isValidJwt,
    canReadProgramData,
    canReadProgram,
  } = egoTokenUtils;

  if (egoToken) {
    let decodedToken: ReturnType<typeof decodeToken>;
    try {
      decodedToken = decodeToken(egoToken);
    } catch (err) {
      throw new AuthenticationError(err);
    }

    const isExpired = isExpiredToken(decodedToken);
    const permissions = getPermissionsFromToken(egoToken);
    const hasPermission =
      canReadProgram({
        permissions,
        programId: args.programShortName,
      }) ||
      canReadProgramData({
        permissions,
        programId: args.programShortName,
      });

    const authorized =
      egoToken && isValidJwt(egoToken) && !isExpiredToken(decodedToken) && hasPermission;

    if (authorized) {
      return resolver;
    } else {
      if (isExpired) {
        throw new UnauthorizedError('expired jwt');
      } else {
        throw new UnauthorizedError('unauthorized');
      }
    }
  } else {
    throw new AuthenticationError('you must be logged in to access this data');
  }
};

const createResolvers = async (): Promise<IResolvers<unknown, GlobalGqlContext>> => {
  const esClient = await createEsClient();
  return {
    Query: {
      programDonorSummaryEntries: (_, args, context) =>
        resolveWithProgramAuth(context, args, programDonorSummaryEntriesResolver(esClient)),
      programDonorSummaryStats: (_, args, context) =>
        resolveWithProgramAuth(context, args, programDonorSummaryStatsResolver(esClient)),
    },
  };
};

export default createResolvers;
