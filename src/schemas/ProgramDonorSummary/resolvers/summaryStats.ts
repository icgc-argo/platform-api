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
        esb
          .termsQuery()
          .field('releaseStatus' as EsDonorDocumentField)
          .values(['FULLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation(
        'partiallyReleasedDonorsCount',
        esb
          .termsQuery()
          .field('releaseStatus' as EsDonorDocumentField)
          .values(['PARTIALLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation(
        'noReleaseDonorsCount',
        esb
          .termsQuery()
          .field('releaseStatus' as EsDonorDocumentField)
          .values(['NO_RELEASE', ''] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation(
        'donorsProcessingMolecularDataCount',
        esb
          .termsQuery()
          .field('processingStatus' as EsDonorDocumentField)
          .values(['PROCESSING'] as ElasticsearchDonorDocument['processingStatus'][]),
      ),
      filterAggregation(
        'donorsWithReleasedFilesCount',
        esb
          .termsQuery()
          .field('processingStatus' as EsDonorDocumentField)
          .values(['COMPLETE'] as ElasticsearchDonorDocument['processingStatus'][]),
      ),
      esb.filterAggregation(
        'donorsWithRegisteredNormalAndTumourSamples',
        esb.boolQuery().must([
          esb
            .rangeQuery()
            .field('registeredNormalSamples' as EsDonorDocumentField)
            .gt(0),
          esb
            .rangeQuery()
            .field('registeredTumourSamples' as EsDonorDocumentField)
            .gt(0),
        ]),
      ),
      esb.filterAggregation(
        'donorsWithAllCoreClinicalData',
        esb
          .rangeQuery()
          .field('submittedCoreDataPercent' as EsDonorDocumentField)
          .gte(1),
      ),
      esb
        .sumAggregation('allFilesCount' as AggregationName)
        .field('filesCount' as EsDonorDocumentField),
    ]);

  type FilterAggregationResult = { doc_count: number };
  type NumbericAggregationResult = { value: number };
  const {
    aggregations,
    hits,
  }: {
    hits: {
      total: { value: number; relation: string };
    };
    aggregations: {
      fullyReleasedDonorsCount: FilterAggregationResult;
      partiallyReleasedDonorsCount: FilterAggregationResult;
      noReleaseDonorsCount: FilterAggregationResult;
      donorsProcessingMolecularDataCount: FilterAggregationResult;
      donorsWithReleasedFilesCount: FilterAggregationResult;
      donorsWithRegisteredNormalAndTumourSamples: FilterAggregationResult;
      donorsWithAllCoreClinicalData: FilterAggregationResult;
      allFilesCount: NumbericAggregationResult;
    };
  } = await esClient
    .search({
      index: 'donor_centric',
      track_total_hits: true,
      size: 0, // number of hits to retrieve, we're not interested in hits
      body: esQuery,
    })
    .then(response => {
      return response.body;
    });

  console.log('esQuery: ', JSON.stringify(esQuery.toJSON()));

  return {
    id: () => `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    registeredDonorsCount: hits.total.value,
    fullyReleasedDonorsCount: aggregations.fullyReleasedDonorsCount.doc_count,
    partiallyReleasedDonorsCount: aggregations.partiallyReleasedDonorsCount.doc_count,
    noReleaseDonorsCount: aggregations.noReleaseDonorsCount.doc_count,
    donorsProcessingMolecularDataCount: aggregations.donorsProcessingMolecularDataCount.doc_count,
    donorsWithReleasedFilesCount: aggregations.donorsWithReleasedFilesCount.doc_count,
    percentageTumourAndNormal:
      aggregations.donorsWithRegisteredNormalAndTumourSamples.doc_count / hits.total.value,
    percentageCoreClinical: aggregations.donorsWithAllCoreClinicalData.doc_count / hits.total.value,
    allFilesCount: aggregations.allFilesCount.value,
    filesToQcCount: 0,
  };
};

export default programDonorSummaryStatsResolver;
