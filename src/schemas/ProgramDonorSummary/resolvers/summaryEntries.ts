import esb from 'elastic-builder';
import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import {
  DonorSummaryEntry,
  ProgramDonorSummaryFilter,
  ElasticsearchDonorDocument,
  EsDonorDocumentField,
  DonorSummaryEntrySort,
  DonorMolecularDataProcessingStatus,
  DonorMolecularDataReleaseStatus,
  BaseQueryArguments,
} from './types';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX } from 'config';
import { UserInputError } from 'apollo-server-express';
import logger from 'utils/logger';

const programDonorSummaryEntriesResolver: (
  esClient: Client,
) => GraphQLFieldResolver<
  unknown,
  GlobalGqlContext,
  BaseQueryArguments & {
    first: number;
    offset: number;
    sorts: DonorSummaryEntrySort[];
    filters: ProgramDonorSummaryFilter[];
  }
> = esClient => async (source, args, context): Promise<DonorSummaryEntry[]> => {
  const { programShortName } = args;

  const MAXIMUM_SUMMARY_PAGE_SIZE = 500;
  if (args.first > MAXIMUM_SUMMARY_PAGE_SIZE) {
    throw new UserInputError(`Max page size of ${MAXIMUM_SUMMARY_PAGE_SIZE} exceeded`, {
      first: args.first,
    });
  }

  const esQuery = esb
    .requestBodySearch()
    .query(
      esb.boolQuery().must([
        //using an array to accommodate filters in the future
        esb.matchQuery(EsDonorDocumentField.programId, programShortName),
      ]),
    )
    .sorts(args.sorts.map(({ field, order }) => esb.sort(field, order)))
    .from(args.offset)
    .size(args.first);

  type EsHits = Array<{
    _source: ElasticsearchDonorDocument;
  }>;

  const esHits: EsHits = await esClient
    .search({
      index: ELASTICSEARCH_PROGRAM_DONOR_DASHBOARD_INDEX,
      body: esQuery,
    })
    .then(res => res.body.hits.hits)
    .catch(err => {
      logger.error('error reading data from Elasticsearch: ', err);
      return [] as EsHits;
    });
  return esHits
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
          processingStatus: doc.processingStatus || DonorMolecularDataProcessingStatus.REGISTERED,
          programId: doc.programId,
          publishedNormalAnalysis: doc.publishedNormalAnalysis,
          publishedTumourAnalysis: doc.publishedTumourAnalysis,
          registeredNormalSamples: doc.registeredNormalSamples,
          registeredTumourSamples: doc.registeredTumourSamples,
          releaseStatus: doc.releaseStatus || DonorMolecularDataReleaseStatus.NO_RELEASE,
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
};

export default programDonorSummaryEntriesResolver;
