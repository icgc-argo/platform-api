import { gql } from 'apollo-server-express';

export default gql`
  enum Category {
    APPLYING_ACCESS
    DATA_DOWNLOAD
    DATA_SUBMISSION
    DATA_QUERY
    MEDIA_QUERY
    PUBLICATION_QUERY
    OTHER
  }

  # the url to the servicedesk ui for the newly made ticket
  type TicketLink {
    web: String
  }

  type TicketCreationResponse {
    issueId: String
    issueKey: String
    _links: TicketLink
  }

  type Mutation {
    createJiraTicket(
      messageCategory: Category!
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
