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

  type AggregationName = keyof ProgramDonorSummaryStats | 'donorsWithAllCoreClinicalData';

  const filterAggregation = (name: AggregationName, filterQuery?: esb.Query | undefined) =>
    esb.filterAggregation(name, filterQuery);

  const esQuery = esb
    .requestBodySearch()
    .query(
      esb.boolQuery().must([esb.matchQuery('programId' as EsDonorDocumentField, programShortName)]),
    )
    .aggs([
      filterAggregation('fullyReleasedDonorsCount').filter(
        esb
          .termsQuery()
          .field('releaseStatus' as EsDonorDocumentField)
          .values(['FULLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation('partiallyReleasedDonorsCount').filter(
        esb
          .termsQuery()
          .field('releaseStatus' as EsDonorDocumentField)
          .values(['PARTIALLY_RELEASED'] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation('noReleaseDonorsCount').filter(
        esb
          .termsQuery()
          .field('releaseStatus' as EsDonorDocumentField)
          .values(['NO_RELEASE', ''] as ElasticsearchDonorDocument['releaseStatus'][]),
      ),
      filterAggregation('donorsProcessingMolecularDataCount').filter(
        esb
          .termsQuery()
          .field('processingStatus' as EsDonorDocumentField)
          .values(['PROCESSING'] as ElasticsearchDonorDocument['processingStatus'][]),
      ),
      filterAggregation('donorsWithReleasedFilesCount').filter(
        esb
          .termsQuery()
          .field('processingStatus' as EsDonorDocumentField)
          .values(['COMPLETE'] as ElasticsearchDonorDocument['processingStatus'][]),
      ),
      filterAggregation('donorsWithRegisteredNormalAndTumourSamples' as AggregationName).filter(
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
      filterAggregation('donorsWithAllCoreClinicalData').filter(
        esb
          .rangeQuery()
          .field('submittedCoreDataPercent' as EsDonorDocumentField)
          .gte(1),
      ),
      esb
        .sumAggregation('allFilesCount' as AggregationName)
        .field('filesCount' as EsDonorDocumentField),
      esb
        .sumAggregation('filesToQcCount' as AggregationName)
        .field('filesToQc' as EsDonorDocumentField),
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
      index: 'donor_centric',
      track_total_hits: true,
      size: 0, // number of hits to retrieve, we're not interested in hits
      body: esQuery,
    })
    .then(response => {
      return response.body;
    });

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
    filesToQcCount: aggregations.filesToQcCount.value,
  };
};

export default programDonorSummaryStatsResolver;
