import typeDefs from './gqlTypeDefs';
import { GlobalGqlContext } from 'app';
import { makeExecutableSchema } from 'graphql-tools';
import { createServiceRequest } from './jiraRequests';

const resolvers = {
  Mutation: {
    createJiraTicket: async (
      obj: unknown,
      args: {
        dropdownValue: string;
        requestTypeId: string;
        emailAddress: string;
        requestText: string;
        displayName: string;
      },
      context: GlobalGqlContext,
    ) => {
      const { dropdownValue, requestTypeId, emailAddress, requestText } = args;

      const serviceRequestResponse = await createServiceRequest(
        emailAddress,
        requestTypeId,
        requestText,
        dropdownValue,
      );
      return serviceRequestResponse;
    },
  },
};

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
