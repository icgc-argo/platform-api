//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';

import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';
import { Client } from '@elastic/elasticsearch';

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

export default programDonorSummaryStatsResolver;
