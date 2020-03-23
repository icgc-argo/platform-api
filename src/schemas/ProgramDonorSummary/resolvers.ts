//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';

import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';
import { createEsClient } from 'services/elasticsearch';
import { Client } from '@elastic/elasticsearch';
import { toEsFilter } from './utils';

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
> = esClient => async (source, args, context): Promise<DonorSummaryEntry[]> => {
  const { programShortName, filters } = args;

  console.log('programShortName: ', programShortName);

  // const esFilter = toEsFilter(filters);

  const x = await esClient.search({
    index: 'donor_centric',
    body: {
      query: {
        bool: {
          must: [
            {
              match: {
                programId: programShortName,
              },
            },
          ],
        },
      },
    },
  });
  const output = x.body.hits.hits.map(({ _source }: { _source: {} }) => _source);

  console.log('output: ', output);
  return output;
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
