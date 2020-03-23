import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';

const programDonorSummaryEntriesResolver: GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programShortName: string;
    first: number;
    last: number;
    filters: ProgramDonorSummaryFilter[];
  }
> = (source, args, context): DonorSummaryEntry[] => {
  const { programShortName } = args;

  console.log('args: ', args.filters);

  return [];
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
    programShortName: string;
    filters: ProgramDonorSummaryFilter[];
  }
> = (source, args, context): ProgramDonorSummaryStats => {
  const { programShortName, filters } = args;

  return {
    programShortName: programShortName,
    allFilesCount: 0,
    donorsProcessingMolecularDataCount: 0,
    donorsWithReleasedFilesCount: 0,
    filesToQcCount: 0,
    percentageCoreClinical: 0,
    percentageTumourAndNormal: 0,
    registeredDonorsCount: 0,
    fullyReleasedDonorsCount: 0,
    partiallyReleasedDonorsCount: 0,
    noReleaseDonorsCount: 0,
  };
};

const resolvers: IResolvers<unknown, GlobalGqlContext> = {
  Query: {
    programDonorSummaryEntries: programDonorSummaryEntriesResolver,
    programDonorSummaryStats: programDonorSummaryStatsResolver,
  },
};

export default resolvers;
