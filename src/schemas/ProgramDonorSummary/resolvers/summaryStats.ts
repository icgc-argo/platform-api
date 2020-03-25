//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';
import esb from 'elastic-builder';

import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import {
  ProgramDonorSummaryStats,
  ProgramDonorSummaryFilter,
  ElasticsearchDonorDocument,
  ProgramDonorSummaryStatsGqlResponse,
  EsDonorDocumentField,
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
> = esClient => async (source, args, context): Promise<ProgramDonorSummaryStatsGqlResponse> => {
  const { programShortName, filters } = args;

  type AggregationName = keyof ProgramDonorSummaryStats;

  const filterAggregation = (name: AggregationName, filterQuery?: esb.Query | undefined) =>
    esb.filterAggregation(name, filterQuery);

  const esQuery = esb
    .requestBodySearch()
    .query(
      esb.boolQuery().must([esb.matchQuery('programId' as EsDonorDocumentField, programShortName)]),
    )
    .aggs([
      filterAggregation(
        'fullyReleasedDonorsCount',
        esb.termsQuery(
          'releaseStatus' as EsDonorDocumentField,
          ['FULLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][],
        ),
      ),
      filterAggregation(
        'partiallyReleasedDonorsCount',
        esb.termsQuery(
          'releaseStatus' as EsDonorDocumentField,
          ['PARTIALLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][],
        ),
      ),
      filterAggregation(
        'noReleaseDonorsCount',
        esb.termsQuery(
          'releaseStatus' as EsDonorDocumentField,
          ['NO_RELEASE', ''] as ElasticsearchDonorDocument['releaseStatus'][],
        ),
      ),
      filterAggregation(
        'donorsProcessingMolecularDataCount',
        esb.termsQuery(
          'processingStatus' as EsDonorDocumentField,
          ['PROCESSING'] as ElasticsearchDonorDocument['processingStatus'][],
        ),
      ),
      filterAggregation(
        'donorsWithReleasedFilesCount',
        esb.termsQuery(
          'processingStatus' as EsDonorDocumentField,
          ['COMPLETE'] as ElasticsearchDonorDocument['processingStatus'][],
        ),
      ),
    ]);

  const esResponseBody = await esClient
    .search({
      index: 'donor_centric',
      track_total_hits: true,
      size: 0, // number of hits to retrieve, we're not interested in hits
      body: esQuery,
    })
    .then(
      response =>
        response.body as {
          hits: {
            total: { value: number; relation: string };
          };
          aggregations: {
            [key in AggregationName]: {
              doc_count: number;
            };
          };
        },
    );

  console.log('esQuery: ', JSON.stringify(esQuery.toJSON()));

  return {
    id: () => `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    allFilesCount: 0,
    registeredDonorsCount: esResponseBody.hits.total.value,
    fullyReleasedDonorsCount: esResponseBody.aggregations.fullyReleasedDonorsCount.doc_count,
    partiallyReleasedDonorsCount:
      esResponseBody.aggregations.partiallyReleasedDonorsCount.doc_count,
    noReleaseDonorsCount: esResponseBody.aggregations.noReleaseDonorsCount.doc_count,
    donorsProcessingMolecularDataCount:
      esResponseBody.aggregations.donorsProcessingMolecularDataCount.doc_count,
    donorsWithReleasedFilesCount:
      esResponseBody.aggregations.donorsWithReleasedFilesCount.doc_count,
    percentageCoreClinical: 0,
    percentageTumourAndNormal: 0,
    filesToQcCount: 0,
  };
};

export default programDonorSummaryStatsResolver;
