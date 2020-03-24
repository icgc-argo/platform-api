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

  const esQuery = esb
    .requestBodySearch()
    .query(esb.boolQuery().must([esb.matchQuery('programId', programShortName)]))
    .aggs([
      esb.filterAggregation(
        'fullyReleasedDonorsCount' as keyof ProgramDonorSummaryStats,
        esb.termsQuery(
          'releaseStatus' as keyof ElasticsearchDonorDocument,
          ['FULLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][],
        ),
      ),
      esb.filterAggregation(
        'partiallyReleasedDonorsCount' as keyof ProgramDonorSummaryStats,
        esb.termsQuery(
          'releaseStatus' as keyof ElasticsearchDonorDocument,
          ['PARTIALLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][],
        ),
      ),
      esb.filterAggregation(
        'donorsProcessingMolecularDataCount' as keyof ProgramDonorSummaryStats,
        esb.termsQuery(
          'processingStatus' as keyof ElasticsearchDonorDocument,
          ['PROCESSING'] as ElasticsearchDonorDocument['processingStatus'][],
        ),
      ),
      esb.filterAggregation(
        'donorsWithReleasedFilesCount' as keyof ProgramDonorSummaryStats,
        esb.termsQuery(
          'processingStatus' as keyof ElasticsearchDonorDocument,
          ['COMPLETE'] as ElasticsearchDonorDocument['processingStatus'][],
        ),
      ),
    ]);

  const body: {
    hits: {
      total: { value: number; relation: string };
    };
    aggregations: {
      fullyReleasedDonorsCount: {
        doc_count: number;
      };
      partiallyReleasedDonorsCount: {
        doc_count: number;
      };
      donorsProcessingMolecularDataCount: {
        doc_count: number;
      };
      donorsWithReleasedFilesCount: {
        doc_count: number;
      };
    };
  } = await esClient
    .search({
      index: 'donor_centric',
      track_total_hits: true,
      size: 0, // we're not interested in hits
      body: esQuery,
    })
    .then(response => response.body);

  console.log('esQuery: ', JSON.stringify(esQuery.toJSON()));

  return {
    id: () => `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    allFilesCount: 0,
    registeredDonorsCount: body.hits.total.value,
    fullyReleasedDonorsCount: body.aggregations.fullyReleasedDonorsCount.doc_count,
    partiallyReleasedDonorsCount: body.aggregations.partiallyReleasedDonorsCount.doc_count,
    donorsProcessingMolecularDataCount:
      body.aggregations.donorsProcessingMolecularDataCount.doc_count,
    donorsWithReleasedFilesCount: body.aggregations.donorsWithReleasedFilesCount.doc_count,
    filesToQcCount: 0,
    percentageCoreClinical: 0,
    percentageTumourAndNormal: 0,
    noReleaseDonorsCount: 0,
  };
};

export default programDonorSummaryStatsResolver;
