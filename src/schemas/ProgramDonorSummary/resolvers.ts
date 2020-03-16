import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats } from './types';

const programDonorSummaryEntriesResolver: GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programId: string;
    first: number;
    last: number;
  }
> = (source, args, context): DonorSummaryEntry[] => {
  const { programId } = args;

  return [];
};

const programDonorSummaryVersionResolver: GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programId: string;
  }
> = (source, args, context): string => {
  const { programId } = args;

  return 'something';
};

const programDonorSummaryStatsResolver: GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programId: string;
  }
> = (source, args, context): ProgramDonorSummaryStats => {
  const { programId } = args;

  return {
    allFilesCount: 1,
    donorsProcessingMolecularDataCount: 3,
    donorsWithReleasedFilesCount: 3,
    filesToQcCount: 5,
    percentageCoreClinical: 6,
    percentageTumorAndNormal: 5,
    registeredDonorsCount: 7,
  };
};

const resolvers: IResolvers<unknown, GlobalGqlContext> = {
  Query: {
    programDonorSummaryVersion: programDonorSummaryVersionResolver,
    programDonorSummaryEntries: programDonorSummaryEntriesResolver,
    programDonorSummaryStats: programDonorSummaryStatsResolver,
  },
};

export default resolvers;
