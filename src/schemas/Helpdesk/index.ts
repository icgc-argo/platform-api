import typeDefs from './gqlTypeDefs';
import { GlobalGqlContext } from 'app';
import { makeExecutableSchema } from 'graphql-tools';
import { createJiraClient, JiraClient } from './jiraRequests';
import { FEATURE_HELP_DESK_ENABLED } from 'config';
import { ApolloError, UserInputError } from 'apollo-server-express';
import createReCaptchaClient, { ReCaptchaClient } from 'services/reCaptcha';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';

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

const createResolvers = (jiraClient: JiraClient, reCaptchaClient: ReCaptchaClient) => {
  const jiraTicketCreationResolver: GraphQLFieldResolver<unknown, GlobalGqlContext, {
      messageCategory: string;
      emailAddress: string;
      requestText: string;
      displayName: string;
    }> = async (
    obj,
    args,
    context,
  ) => {
    const { messageCategory, emailAddress, requestText, displayName } = args;
    const messageCategoryKey = messageCategory as keyof typeof JiraTicketCategory;
    const serviceRequestResponse = await jiraClient.createServiceRequest(
      emailAddress,
      REQUEST_TYPE_MAPPER[messageCategoryKey],
      requestText,
      MESSAGE_CATEGORY_MAPPER[messageCategoryKey],
    );
    return serviceRequestResponse;
  };

  const resolveWithReCaptcha = (resolverFn: GraphQLFieldResolver<unknown, unknown>) => async (
    ...resolverArgs: [unknown, { reCaptchaResponse: string }, GlobalGqlContext, GraphQLResolveInfo]
  ) => {
    const { reCaptchaResponse } = resolverArgs[1];
    const { success, 'error-codes': errorCodes } = await reCaptchaClient.verifyUserResponse(
      reCaptchaResponse,
    );
    if (success) {
      return resolverFn(...resolverArgs);
    } else {
      if (errorCodes?.includes("invalid-input-response") || errorCodes?.includes("missing-input-response")) {
        throw new UserInputError(`invalid ReCaptcha response: ${errorCodes}`);
      } else {
        throw new ApolloError(`failed to verify reCaptcha response`);
      }
    }
  };

  return {
    Mutation: {
      createJiraTicketWithReCaptcha: resolveWithReCaptcha(jiraTicketCreationResolver),
      /**
       * @TODO remove this resolver once UI usage is switched to createJiraTicketWithReCaptcha
       */
      createJiraTicket: jiraTicketCreationResolver,
    },
  };
};

const disabledResolvers = {
  Mutation: {
    createJiraTicketWithReCaptcha: () => {
      throw new ApolloError(
        `FEATURE_HELP_DESK_ENABLED is ${FEATURE_HELP_DESK_ENABLED} in this instance of the gateway`,
      );
    },
    createJiraTicket: () => {
      throw new ApolloError(
        `FEATURE_HELP_DESK_ENABLED is ${FEATURE_HELP_DESK_ENABLED} in this instance of the gateway`,
      );
    },
  },
};

export default async () => {
  const reCaptchaClient = await createReCaptchaClient() // this client is created regardless of FEATURE_HELP_DESK_ENABLED so its vault integration can be tested in dev environments
  const resolvers = FEATURE_HELP_DESK_ENABLED
    ? createResolvers(await createJiraClient(), reCaptchaClient)
    : disabledResolvers;
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
};
