import { IResolvers } from 'graphql-tools';
import { GlobalGqlContext } from 'app';
import { createEsClient } from 'services/elasticsearch';
import programDonorSummaryEntriesResolver from './summaryEntries';
import programDonorSummaryStatsResolver from './summaryStats';

const createResolvers = async (): Promise<IResolvers<unknown, GlobalGqlContext>> => {
  const esClient = await createEsClient();
  return {
    Query: {
      programDonorSummaryEntries: programDonorSummaryEntriesResolver(esClient),
      programDonorSummaryStats: programDonorSummaryStatsResolver(esClient),
    },
  };
};

export default createResolvers;
