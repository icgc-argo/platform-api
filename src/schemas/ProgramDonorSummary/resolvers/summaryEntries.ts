//@ts-ignore no type defs
import esb from 'elastic-builder';

import { GlobalGqlContext } from 'app';
import { GraphQLFieldResolver } from 'graphql';
import { DonorSummaryEntry, ProgramDonorSummaryFilter, ElasticsearchDonorDocument } from './types';
import { Client } from '@elastic/elasticsearch';
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

export default programDonorSummaryEntriesResolver;
