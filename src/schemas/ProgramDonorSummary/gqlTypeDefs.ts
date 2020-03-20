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

  enum ProgramDonorSummaryEntryField {
    donorId
    validWithCurrentDictionary
    releaseStatus
    submitterDonorId
    progrmShortName
    submittedCoreDataPercent
    submittedExtendedDataPercent
    registeredNormalSamples
    registeredTumourSamples
    publishedNormalAnalysis
    publishedTumourAnalysis
    alignmentsCompleted
    alignmentsRunning
    alignmentsFailed
    sangerVcsCompleted
    sangerVcsRunning
    sangerVcsFailed
    processingStatus
    updatedAt
    createdAt
  }

  input ProgramDonorSummaryFilter {
    field: ProgramDonorSummaryEntryField!
    values: [String!]!
  }

  type DonorSummaryEntry {
    id: ID!
    donorId: String!
    progrmShortName: String!
    validWithCurrentDictionary: Boolean!
    releaseStatus: DonorReleaseStatus!
    submitterDonorId: String!
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
    processingStatus: DonorProcessingStatus!
    updatedAt: DateTime!
    createdAt: DateTime!
  }

  type ProgramDonorSummaryStats {
    progrmShortName: String!
    registeredDonorsCount: Int!
    percentageCoreClinical: Float!
    percentageTumourAndNormal: Float!
    donorsProcessingMolecularDataCount: Int!
    filesToQcCount: Int!
    donorsWithReleasedFilesCount: Int!
    allFilesCount: Int!
    totalDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
    fullyReleasedDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
    partiallyReleasedDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
    noReleaseDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
  }

  type Query {
    programDonorSummaryEntries(
      progrmShortName: String!
      first: Int = 20
      offset: Int = 0
      filters: [ProgramDonorSummaryFilter!] = []
    ): [DonorSummaryEntry]!
    programDonorSummaryStats(progrmShortName: String!): ProgramDonorSummaryStats
  }
`;
