//@ts-ignore no type defs
import stringify from 'json-stringify-deterministic';
import esb from 'elastic-builder';

import { IResolvers } from 'apollo-server-express';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryStats, ProgramDonorSummaryFilter } from './types';
import { createEsClient } from 'services/elasticsearch';
import { Client } from '@elastic/elasticsearch';

type ElasticsearchDonorDocument = {
  alignmentsCompleted: number;
  alignmentsFailed: number;
  alignmentsRunning: number;
  createdAt: string;
  donorId: string;
  processingStatus: string;
  programId: string;
  publishedNormalAnalysis: number;
  publishedTumourAnalysis: number;
  registeredNormalSamples: number;
  registeredTumourSamples: number;
  releaseStatus: string;
  sangerVcsCompleted: number;
  sangerVcsFailed: number;
  sangerVcsRunning: number;
  submittedCoreDataPercent: number;
  submittedExtendedDataPercent: number;
  submitterDonorId: string;
  updatedAt: string;
  validWithCurrentDictionary: boolean;
};

const programDonorSummaryEntriesResolver: (
  esClient: Client,
) => GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  {
    programShortName: string;
    first: number;
    offset: number;
    filters: ProgramDonorSummaryFilter[];
  }
> = esClient => async (source, args, context): Promise<DonorSummaryEntry[]> => {
  const { programShortName } = args;

  const esQuery = esb
    .requestBodySearch()
    .query(
      esb.boolQuery().must([esb.matchQuery('programId', programShortName)]), //using an array to accommodate filters in the future
    )
    .from(args.offset)
    .size(args.first);

  const esHits: Array<{
    _source: ElasticsearchDonorDocument;
  }> = await esClient
    .search({
      index: 'donor_centric',
      body: esQuery,
    })
    .then(res => res.body.hits.hits);
  const output = esHits
    .map(({ _source }) => _source)
    .map(
      doc =>
        ({
          id: `${programShortName}::${doc.donorId}`,
          programShortName: doc.programId,
          alignmentsCompleted: doc.alignmentsCompleted,
          alignmentsFailed: doc.alignmentsFailed,
          alignmentsRunning: doc.alignmentsRunning,
          donorId: doc.donorId,
          processingStatus: doc.processingStatus || 'REGISTERED',
          programId: doc.programId,
          publishedNormalAnalysis: doc.publishedNormalAnalysis,
          publishedTumourAnalysis: doc.publishedTumourAnalysis,
          registeredNormalSamples: doc.registeredNormalSamples,
          registeredTumourSamples: doc.registeredTumourSamples,
          releaseStatus: doc.releaseStatus || 'NO_RELEASE',
          sangerVcsCompleted: doc.sangerVcsCompleted,
          sangerVcsFailed: doc.sangerVcsFailed,
          sangerVcsRunning: doc.sangerVcsRunning,
          submittedCoreDataPercent: doc.submittedCoreDataPercent,
          submittedExtendedDataPercent: doc.submittedExtendedDataPercent,
          submitterDonorId: doc.submitterDonorId,
          validWithCurrentDictionary: doc.validWithCurrentDictionary,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        } as DonorSummaryEntry),
    );

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
