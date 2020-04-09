import { IResolvers } from 'graphql-tools';
import { GlobalGqlContext } from 'app';
import { createEsClient } from 'services/elasticsearch';
import programDonorSummaryEntriesResolver, {
  emptyProgramDonorSummaryEntriesResolver,
} from './summaryEntries';
import programDonorSummaryStatsResolver, {
  emptyProgramDonorSumaryStatsResolver,
} from './summaryStats';
import { PROGRAM_DASHBOARD_SUMMARY_ENABLED } from 'config';

const createResolvers = async (): Promise<IResolvers<unknown, GlobalGqlContext>> => {
  const esClient = await createEsClient();
  return {
    Query: {
      programDonorSummaryEntries: !PROGRAM_DASHBOARD_SUMMARY_ENABLED
        ? emptyProgramDonorSummaryEntriesResolver()
        : programDonorSummaryEntriesResolver(esClient),
      programDonorSummaryStats: !PROGRAM_DASHBOARD_SUMMARY_ENABLED
        ? emptyProgramDonorSumaryStatsResolver()
        : programDonorSummaryStatsResolver(esClient),
    },
  };
};

export default createResolvers;
