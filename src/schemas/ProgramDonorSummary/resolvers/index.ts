import { IResolvers } from 'graphql-tools';
import { GlobalGqlContext } from 'app';
import { createEsClient } from 'services/elasticsearch';
import programDonorSummaryEntriesResolver, { emptyDonoSummariesResolver } from './summaryEntries';
import programDonorSummaryStatsResolver, { emptyProgramStatsResolver } from './summaryStats';
import { PROGRAM_DASHBOARD_SUMMARY_ENABLED } from 'config';

const createResolvers = async (): Promise<IResolvers<unknown, GlobalGqlContext>> => {
  const esClient = await createEsClient();
  return {
    Query: {
      programDonorSummaryEntries: !PROGRAM_DASHBOARD_SUMMARY_ENABLED
        ? emptyDonoSummariesResolver()
        : programDonorSummaryEntriesResolver(esClient),
      programDonorSummaryStats: !PROGRAM_DASHBOARD_SUMMARY_ENABLED
        ? emptyProgramStatsResolver()
        : programDonorSummaryStatsResolver(esClient),
    },
  };
};

export default createResolvers;
