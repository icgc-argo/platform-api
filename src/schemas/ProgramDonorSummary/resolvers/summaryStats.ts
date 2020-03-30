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
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';

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

  type AggregationName = keyof ProgramDonorSummaryStats | 'donorsWithAllCoreClinicalData';

  const filterAggregation = (name: AggregationName, filterQuery?: esb.Query | undefined) =>
    esb.filterAggregation(name, filterQuery);

  const esQuery = esb
    .requestBodySearch()
    .query(esb.boolQuery().must([esb.matchQuery(EsDonorDocumentField.programId, programShortName)]))
    .aggs([
      filterAggregation('fullyReleasedDonorsCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values(['FULLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation('partiallyReleasedDonorsCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values(['PARTIALLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation('noReleaseDonorsCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values(['NO_RELEASE', ''] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation('donorsProcessingMolecularDataCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.processingStatus)
          .values(['PROCESSING'] as ElasticsearchDonorDocument['processingStatus'][]),
      ),
      filterAggregation('donorsWithReleasedFilesCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.processingStatus)
          .values(['COMPLETE'] as ElasticsearchDonorDocument['processingStatus'][]),
      ),
      filterAggregation('donorsWithRegisteredNormalAndTumourSamples' as AggregationName).filter(
        esb.boolQuery().must([
          esb
            .rangeQuery()
            .field(EsDonorDocumentField.registeredNormalSamples)
            .gt(0),
          esb
            .rangeQuery()
            .field(EsDonorDocumentField.registeredTumourSamples)
            .gt(0),
        ]),
      ),
      filterAggregation('donorsWithAllCoreClinicalData').filter(
        esb
          .rangeQuery()
          .field(EsDonorDocumentField.submittedCoreDataPercent)
          .gte(1),
      ),
      esb
        .sumAggregation('allFilesCount' as AggregationName)
        .field(EsDonorDocumentField.totalFilesCount),
      esb
        .sumAggregation('filesToQcCount' as AggregationName)
        .field(EsDonorDocumentField.filesToQcCount),
    ]);

  type FilterAggregationResult = { doc_count: number };
  type NumericAggregationResult = { value: number };
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
      allFilesCount: NumericAggregationResult;
      filesToQcCount: NumericAggregationResult;
    };
  } = await esClient
    .search({
      index: ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX,
      track_total_hits: true,
      size: 0, // number of hits to retrieve, we're not interested in hits
      body: esQuery,
    })
    .then(response => response.body);

  return {
    id: () => `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    registeredDonorsCount: hits.total.value,
    fullyReleasedDonorsCount: aggregations.fullyReleasedDonorsCount.doc_count,
    partiallyReleasedDonorsCount: aggregations.partiallyReleasedDonorsCount.doc_count,
    noReleaseDonorsCount: aggregations.noReleaseDonorsCount.doc_count,
    donorsProcessingMolecularDataCount: aggregations.donorsProcessingMolecularDataCount.doc_count,
    donorsWithReleasedFilesCount: aggregations.donorsWithReleasedFilesCount.doc_count,
    percentageTumourAndNormal: hits.total.value
      ? aggregations.donorsWithRegisteredNormalAndTumourSamples.doc_count / hits.total.value
      : 0,
    percentageCoreClinical: hits.total.value
      ? aggregations.donorsWithAllCoreClinicalData.doc_count / hits.total.value
      : 0,
    allFilesCount: aggregations.allFilesCount.value,
    filesToQcCount: aggregations.filesToQcCount.value,
  };
};

export default programDonorSummaryStatsResolver;
