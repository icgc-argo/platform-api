import { gql } from 'apollo-server-express';

export default gql`
  type TicketCreationResponse {
    requestOk: Boolean!
    statusText: String!
  }

  type Mutation {
    createJiraTicket(
      dropdownValue: String!
      requestTypeId: String!
      emailAddress: String!
      requestText: String!
      displayName: String
    ): TicketCreationResponse!
  }

  # one query declaration required
  type Query {
    _dummy: String
  }
`;
