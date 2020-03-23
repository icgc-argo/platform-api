//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';

import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';
import { createEsClient } from 'services/elasticsearch';
import { Client } from '@elastic/elasticsearch';

const programDonorSummaryEntriesResolver: (
  esClient: Client,
) => GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programShortName: string;
    first: number;
    last: number;
    filters: ProgramDonorSummaryFilter[];
  }
> = esClient => (source, args, context): DonorSummaryEntry[] => {
  const { programShortName } = args;

  console.log('args: ', args.filters);

  return [];
};

const programDonorSummaryStatsResolver: (
  esClient: Client,
) => GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programShortName: string;
    filters: ProgramDonorSummaryFilter[];
  }
> = esClient => (source, args, context): ProgramDonorSummaryStats => {
  const { programShortName, filters } = args;

  return {
    id: () => `${programShortName}::${stringify(filters)}`,
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

const resolvers = async (): Promise<IResolvers<unknown, GlobalGqlContext>> => {
  const esClient = await createEsClient();
  return {
    Query: {
      programDonorSummaryEntries: programDonorSummaryEntriesResolver(esClient),
      programDonorSummaryStats: programDonorSummaryStatsResolver(esClient),
    },
  };
};

export default resolvers;
