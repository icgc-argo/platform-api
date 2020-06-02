import { gql } from 'apollo-server-express';

export default gql`
  enum JiraTicketCategory {
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
      messageCategory: JiraTicketCategory!
      emailAddress: String!
      requestText: String!
      displayName: String
    ): TicketCreationResponse!
      @deprecated(reason: "Now requires reCaptcha. Use createJiraTicketWithReCaptcha instead")
    createJiraTicketWithReCaptcha(
      reCaptchaResponse: String!
      messageCategory: JiraTicketCategory!
      emailAddress: String!
      requestText: String!
      displayName: String
    ): TicketCreationResponse!
  }

  type Query {
    _jiraRootQuery: String!
  }
`;
