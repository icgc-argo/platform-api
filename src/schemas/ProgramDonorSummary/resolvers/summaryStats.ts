//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';
import esb from 'elastic-builder';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import {
  ProgramDonorSummaryStats,
  ProgramDonorSummaryFilter,
  ProgramDonorSummaryStatsGqlResponse,
  EsDonorDocumentField,
  DonorMolecularDataProcessingStatus,
  DonorMolecularDataReleaseStatus,
} from './types';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';
import { esAliasNotFound } from './common';

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

  if (await esAliasNotFound(esClient)) {
    return getEmptySummaryStats(programShortName, filters);
  }

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
          .values([DonorMolecularDataReleaseStatus.FULLY_RELEASED]),
      ),
      filterAggregation('partiallyReleasedDonorsCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([DonorMolecularDataReleaseStatus.PARTIALLY_RELEASED]),
      ),
      filterAggregation('noReleaseDonorsCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([DonorMolecularDataReleaseStatus.NO_RELEASE, '']),
      ),
      filterAggregation('donorsProcessingMolecularDataCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.processingStatus)
          .values([DonorMolecularDataProcessingStatus.PROCESSING]),
      ),
      filterAggregation('donorsWithReleasedFilesCount').filter(
        esb
          .termsQuery()
          .field(EsDonorDocumentField.releaseStatus)
          .values([
            DonorMolecularDataReleaseStatus.PARTIALLY_RELEASED,
            DonorMolecularDataReleaseStatus.FULLY_RELEASED,
          ]),
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

export const emptyProgramDonorSumaryStatsResolver: () => GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programShortName: string;
    filters: ProgramDonorSummaryFilter[];
  }
> = () => (source, args, context) => {
  const { programShortName, filters } = args;
  return getEmptySummaryStats(programShortName, filters);
};

const getEmptySummaryStats = (programShortName: string, filters: ProgramDonorSummaryFilter[]) => {
  return {
    id: () => `${programShortName}::${stringify(filters)}`,
    programShortName: programShortName,
    registeredDonorsCount: 0,
    percentageCoreClinical: 0,
    percentageTumourAndNormal: 0,
    donorsProcessingMolecularDataCount: 0,
    filesToQcCount: 0,
    donorsWithReleasedFilesCount: 0,
    allFilesCount: 0,
    fullyReleasedDonorsCount: 0,
    partiallyReleasedDonorsCount: 0,
    noReleaseDonorsCount: 0,
  };
};

export default programDonorSummaryStatsResolver;
