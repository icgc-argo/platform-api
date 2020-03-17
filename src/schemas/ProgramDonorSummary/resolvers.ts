import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';

const programDonorSummaryEntriesResolver: GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programId: string;
    first: number;
    last: number;
    filters: ProgramDonorSummaryFilter[];
  }
> = (source, args, context): DonorSummaryEntry[] => {
  const { programId } = args;

  console.log('args: ', args.filters);

  return [];
};

const totalDonorsCountResolver: GraphQLFieldResolver<
  ProgramDonorSummaryStats,
  GlobalGqlContext
> = () => {
  return 0;
};
const fullyReleasedDonorsCountResolver: GraphQLFieldResolver<
  ProgramDonorSummaryStats,
  GlobalGqlContext
> = () => {
  return 0;
};
const partiallyReleasedDonorsCountResolver: GraphQLFieldResolver<
  ProgramDonorSummaryStats,
  GlobalGqlContext
> = () => {
  return 0;
};
const noReleaseDonorsCountResolver: GraphQLFieldResolver<
  ProgramDonorSummaryStats,
  GlobalGqlContext
> = () => {
  return 0;
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
    programId: programId,
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
  ProgramDonorSummaryStats: {
    totalDonorsCount: totalDonorsCountResolver,
    fullyReleasedDonorsCount: fullyReleasedDonorsCountResolver,
    partiallyReleasedDonorsCount: partiallyReleasedDonorsCountResolver,
    noReleaseDonorsCount: noReleaseDonorsCountResolver,
  },
  Query: {
    programDonorSummaryEntries: programDonorSummaryEntriesResolver,
    programDonorSummaryStats: programDonorSummaryStatsResolver,
  },
};

export default resolvers;
