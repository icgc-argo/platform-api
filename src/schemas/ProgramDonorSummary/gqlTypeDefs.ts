import { gql } from 'apollo-server-express';

export default gql`
  scalar DateTime

  enum DonorMolecularDataReleaseStatus {
    FULLY_RELEASED
    PARTIALLY_RELEASED
    NO_RELEASE
    UNKNOWN
  }

  enum DonorMolecularDataProcessingStatus {
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
    programShortName
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

  """
  Includes status summary of clinical and molecular data processing for the given donor
  """
  type DonorSummaryEntry {
    """
    Unique object ID for this summary object
    """
    id: ID!
    """
    Donor id of the donor within the program
    """
    donorId: String!
    """
    Short name of the program in which this donor is registered
    """
    programShortName: String!
    """
    Whether the donor submitted donor is valid according to the latest data dictionary layed out at: https://docs.icgc-argo.org/dictionary
    """
    validWithCurrentDictionary: Boolean!
    """
    Release status of the donor's molecular data
    """
    releaseStatus: DonorMolecularDataReleaseStatus!
    """

    """
    submitterDonorId: String!
    """
    Percentage of core clinical data fields that has been submitted for this donor. All core fields are listed at: https://docs.icgc-argo.org/dictionary
    """
    submittedCoreDataPercent: Float!
    """
    Percentage of extended clinical data fields that has been submitted for this donor. All extended fields are listed at: https://docs.icgc-argo.org/dictionary
    """
    submittedExtendedDataPercent: Float!
    """
    Number of normal samples registered for this donor
    """
    registeredNormalSamples: Int!
    """
    Number of tumour samples registered for this donor
    """
    registeredTumourSamples: Int!
    """
    Number of normal sample analysis that has been published for this donor
    """
    publishedNormalAnalysis: Int!
    """
    Number of tumour sample analysis that has been published for this donor
    """
    publishedTumourAnalysis: Int!
    """
    Number of alignments completed for this donor
    """
    alignmentsCompleted: Int!
    """
    Number of alignments currently running for this donor
    """
    alignmentsRunning: Int!
    """
    Number of alignments that is failing for this donor
    """
    alignmentsFailed: Int!
    """
    Number of Sanger VCs completed for this donor
    """
    sangerVcsCompleted: Int!
    """
    Number of Sanger VCs currently running for this donor
    """
    sangerVcsRunning: Int!
    """
    Number of Sanger VCs that is failing for this donor
    """
    sangerVcsFailed: Int!
    """
    Molecular data processing status of this donor
    """
    processingStatus: DonorMolecularDataProcessingStatus!
    """
    Timestamp of the latest update applied to this donor's clinical data
    """
    updatedAt: DateTime!
    """
    Timestamp of when this donor was first registered
    """
    createdAt: DateTime!
  }

  """
  Contains summary of aggregate clinical and molecular data processing status for the given program
  """
  type ProgramDonorSummaryStats {
    """
    Unique ID of this summary object
    """
    id: ID!
    """
    Short name of the program which this summary object is associated with
    """
    programShortName: String!
    """
    Total number of donors registered for this program
    """
    registeredDonorsCount: Int!
    """
    Percentage of core clinical data fields submitted over total core clinical data fields
    """
    percentageCoreClinical: Float!
    """

    """
    percentageTumourAndNormal: Float!
    """
    Number of donors whose molecular data is being processed
    """
    donorsProcessingMolecularDataCount: Int!
    """
    Number of files to QC
    """
    filesToQcCount: Int!
    """
    Number of donors whose files have been released
    """
    donorsWithReleasedFilesCount: Int!
    """
    Total number of genomic files associated with this program
    """
    allFilesCount: Int!
    """
    Total number of donors registered under this program
    """
    totalDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
    """
    Number of donors whose genomic files have been fully released
    """
    fullyReleasedDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
    """
    Number of donors who only have some genomic files that have been released
    """
    partiallyReleasedDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
    """
    Number of donors registered to the program who currently has no released genomic file
    """
    noReleaseDonorsCount(filters: [ProgramDonorSummaryFilter!] = []): Int!
  }

  type Query {
    programDonorSummaryEntries(
      programShortName: String!
      first: Int = 20
      offset: Int = 0
      filters: [ProgramDonorSummaryFilter!] = []
    ): [DonorSummaryEntry]!
    programDonorSummaryStats(programShortName: String!): ProgramDonorSummaryStats
  }
`;
