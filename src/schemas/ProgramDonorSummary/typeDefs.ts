import { gql } from 'apollo-server-express';

export default gql`
  scalar DateTime

  enum DonorReleaseStatus {
    FULLY_RELEASED
    PARTIALLY_RELEASED
    NO_RELEASE
    UNKNOWN
  }

  enum DonorProcessingStatus {
    COMPLETED
    PROCESSING
    REGISTERED
    UNKNOWN
  }

  type DonorSummaryEntry {
    donorId: ID!
    validWithCurrentDictionary: Boolean!
    releaseStatus: DonorReleaseStatus!
    submitterDonorId: String!
    programId: String!
    submittedCoreDataPercent: Float!
    submittedExtendedDataPercent: Float!
    registeredNormalSamples: Int!
    registeredTumourSamples: Int!
    publishedNormalAnalysis: Int!
    publishedTumourAnalysis: Int!
    alignmentsCompleted: Int!
    alignmentsRunning: Int!
    alignmentsFailed: Int!
    sangerVcsCompleted: Int!
    sangerVcsRunning: Int!
    sangerVcsFailed: Int!
    processingStatus: DonorProcessingStatus!!
    updatedAt: DateTime!!
    createdAt: DateTime!!
  }

  type Query {
    donorSummaryEntries: [DonorSummaryEntry]!
  }
`;
