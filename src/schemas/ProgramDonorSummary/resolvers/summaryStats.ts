//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';
import esb from 'elastic-builder';

import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import {
  ProgramDonorSummaryStats,
  ProgramDonorSummaryFilter,
  ElasticsearchDonorDocument,
} from './types';
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
> = esClient => async (source, args, context): Promise<ProgramDonorSummaryStats> => {
  const { programShortName, filters } = args;

  const hits: {
    hits: {
      total: { value: number; relation: string };
      hits: Array<{
        _index: string;
        _source: ElasticsearchDonorDocument;
      }>;
    };
  } = await esClient
    .search({
      index: 'donor_centric',
      body: esb
        .requestBodySearch()
        .query(esb.boolQuery().must([esb.matchQuery('programId', programShortName)])),
    })
    .then(response => response.body);

  return {
    id: () => `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    allFilesCount: 0,
    donorsProcessingMolecularDataCount: 0,
    donorsWithReleasedFilesCount: 0,
    filesToQcCount: 0,
    percentageCoreClinical: 0,
    percentageTumourAndNormal: 0,
    registeredDonorsCount: hits.hits.total.value,
    fullyReleasedDonorsCount: 0,
    partiallyReleasedDonorsCount: 0,
    noReleaseDonorsCount: 0,
  };
};

export default programDonorSummaryStatsResolver;
