import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';

const programDonorSummaryEntriesResolver: GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    progrmShortName: string;
    first: number;
    last: number;
    filters: ProgramDonorSummaryFilter[];
  }
> = (source, args, context): DonorSummaryEntry[] => {
  const { progrmShortName } = args;

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
    progrmShortName: string;
  }
> = (source, args, context): ProgramDonorSummaryStats => {
  const { progrmShortName } = args;

  return {
    progrmShortName: progrmShortName,
    allFilesCount: 0,
    donorsProcessingMolecularDataCount: 0,
    donorsWithReleasedFilesCount: 0,
    filesToQcCount: 0,
    percentageCoreClinical: 0,
    percentageTumorAndNormal: 0,
    registeredDonorsCount: 0,
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
