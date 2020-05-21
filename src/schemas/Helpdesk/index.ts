import typeDefs from './gqlTypeDefs';
import { GlobalGqlContext } from 'app';
import { makeExecutableSchema } from 'graphql-tools';
import { createJiraClient, JiraClient } from './jiraRequests';

enum JiraTicketCategory {
  APPLYING_ACCESS,
  DATA_DOWNLOAD,
  DATA_SUBMISSION,
  DATA_QUERY,
  MEDIA_QUERY,
  PUBLICATION_QUERY,
  OTHER,
}

type CategoryMapper = {
  [key in keyof typeof JiraTicketCategory]: string;
};

const MESSAGE_CATEGORY_MAPPER: CategoryMapper = {
  APPLYING_ACCESS: 'Applying for Access to Controlled Data through DACO',
  DATA_DOWNLOAD: 'Data Download',
  DATA_SUBMISSION: 'Data Submission',
  DATA_QUERY: 'Data or Analysis Query',
  MEDIA_QUERY: 'Media or Collaboration Inquiry',
  PUBLICATION_QUERY: 'Publication Inquiry',
  OTHER: 'Other',
};

// values obtained from JIRA's "get request types" endpoint
const REQUEST_TYPE_MAPPER: CategoryMapper = {
  APPLYING_ACCESS: '63',
  DATA_DOWNLOAD: '81',
  DATA_SUBMISSION: '83',
  DATA_QUERY: '85',
  MEDIA_QUERY: '87',
  PUBLICATION_QUERY: '89',
  OTHER: '91',
};

const resolvers = {
  Mutation: {
    createJiraTicket: async (
      obj: unknown,
      args: {
        messageCategory: string;
        emailAddress: string;
        requestText: string;
        displayName: string;
      },
      context: GlobalGqlContext,
    ) => {
      const { messageCategory, emailAddress, requestText, displayName } = args;

      const messageCategoryKey = messageCategory as keyof typeof JiraTicketCategory;
      const jiraClient = await createJiraClient();

      const serviceRequestResponse = await jiraClient.createServiceRequest(
        emailAddress,
        REQUEST_TYPE_MAPPER[messageCategoryKey],
        requestText,
        MESSAGE_CATEGORY_MAPPER[messageCategoryKey],
      );

      return serviceRequestResponse;
    },
  },
};

const createResolvers = (client: JiraClient) => {
  return {
    Mutation: {
      createJiraTicket: async (
        obj: unknown,
        args: {
          messageCategory: string;
          emailAddress: string;
          requestText: string;
          displayName: string;
        },
        context: GlobalGqlContext,
      ) => {
        const { messageCategory, emailAddress, requestText, displayName } = args;

        const messageCategoryKey = messageCategory as keyof typeof JiraTicketCategory;

        const serviceRequestResponse = await client.createServiceRequest(
          emailAddress,
          REQUEST_TYPE_MAPPER[messageCategoryKey],
          requestText,
          MESSAGE_CATEGORY_MAPPER[messageCategoryKey],
        );

        return serviceRequestResponse;
      },
    },
  };
};

export default async () => {
  const client = await createJiraClient();
  return makeExecutableSchema({
    typeDefs,
    resolvers: createResolvers(client),
  });
};
