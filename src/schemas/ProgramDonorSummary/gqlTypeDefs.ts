/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { gql } from 'apollo-server-express';

export default gql`
  scalar DateTime

  enum DonorMolecularDataReleaseStatus {
    FULLY_RELEASED
    PARTIALLY_RELEASED
    NO_RELEASE
  }

  enum DonorMolecularDataProcessingStatus {
    COMPLETE
    PROCESSING
    REGISTERED
  }

  enum ProgramDonorSummaryEntryField {
    donorId
    """
    use this field to filter donor entries by partially matching donorId or submitterDonorId, e.g.: "donor", "donor5"
    """
    combinedDonorId
    """
    use this field to filter donor entries by 3 aggregations of submittedCoreDataPercent,
    3 enum options to filter by: NO_DATA, COMPLETE, INCOMPLETE.
    """
    coreDataPercentAggregation
    """
    use this field to filter donor entries by 2 enum values: VALID, INVALID.
    VALID means the donor has at least 1 registered tumour/normal sample pair.
    INVALID means the donor has not registered any tumour or normal samples.
    """
    registeredSamplePairs
    """
    use this field to filter donor entries by 2 enum values: VALID, INVALID.
    VALID means the donor has at least 1 submitted tumour/normal sequencing reads.
    INVALID means the donor has not registered any tumour or sequencing reads.
    """
    rawReads
    """
    use this field to filter donor entries by 4 enum values: COMPLETED, IN_PROGRESS, FAILED, NO_DATA.
    COMPLETED = donor has more than 1 completed alignment workflow;
    IN_PROGRESS = donor has more than 1 running alignment workflow;
    FAILED = donor has more than 1 failed alignment workflow;
    NO_DATA = donor has 0 of all the above alignment workflow.
    """
    alignmentStatus
    """
    use this field to filter donor entries by 4 enum values: COMPLETED, IN_PROGRESS, FAILED, NO_DATA.
    COMPLETED = donor has more than 1 completed sanger VC workflow;
    IN_PROGRESS = donor has more than 1 running sanger VC workflow;
    FAILED = donor has more than 1 failed sanger VC workflow;
    NO_DATA = donor has 0 of all the above sanger VC workflow.
    """
    sangerVCStatus
    """
    use this field to filter donor entries by 4 enum values: COMPLETED, IN_PROGRESS, FAILED, NO_DATA.
    COMPLETED = donor has more than 1 completed Mutect 2 workflow;
    IN_PROGRESS = donor has more than 1 running Mutect 2 workflow;
    FAILED = donor has more than 1 failed Mutect 2 workflow;
    NO_DATA = donor has 0 of all the above Mutect 2 workflow.
    """
    mutectStatus
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
    mutectCompleted
    mutectRunning
    mutectFailed
    processingStatus
    updatedAt
    createdAt
  }

  input ProgramDonorSummaryFilter {
    field: ProgramDonorSummaryEntryField!
    values: [String!]!
  }

  enum SortOrder {
    asc
    desc
  }

  input DonorSummaryEntrySort {
    field: ProgramDonorSummaryEntryField!
    order: SortOrder
  }

  type DonorSummary {
    entries: [DonorSummaryEntry!]
    stats: ProgramDonorSummaryStats!
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
    Number of Mutect2 completed for this donor
    """
    mutectCompleted: Int!
    """
    Number of Mutect2 currently running for this donor
    """
    mutectRunning: Int!
    """
    Number of Mutect2 that is failed for this donor
    """
    mutectFailed: Int!
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
    Number of donors invalidated with current data dictionary version
    """
    donorsInvalidWithCurrentDictionaryCount: Int!
    """
    Total number of genomic files associated with this program
    """
    allFilesCount: Int!
    """
    Number of donors whose genomic files have been fully released
    """
    fullyReleasedDonorsCount: Int!
    """
    Number of donors who only have some genomic files that have been released
    """
    partiallyReleasedDonorsCount: Int!
    """
    Number of donors registered to the program who currently has no released genomic file
    """
    noReleaseDonorsCount: Int!
    """
    Number of donors that are clinically complete at 100% core fields
    """
    donorsWithCompleteCoreCompletion: Int!
    """
    Number of donors that have incomplete core clinical fields
    """
    donorsWithIncompleteCoreCompletion: Int!
    """
    Number of donors that have no data for core clinical fields
    """
    donorsWithNoCoreCompletion: Int!
    """
    Number of donors that have at least 1 tumour/normal sample pairs
    """
    donorsWithValidSamplePairs: Int!
    """
    Number of donors that have 0 tumour or normal sample
    """
    donorsWithInvalidSamplePairs: Int!

    """
    Number of donors that have at least 1 tumour/normal raw reads pairs
    """
    donorsWithValidRawReads: Int!
    """
    Number of donors that have 0 tumour or normal raw read
    """
    donorsWithInvalidRawReads: Int!

    """
    Number of donors that have COMPLETED as alignment workflow status
    """
    donorsWithCompletedAlignment: Int!
    """
    Number of donors that have IN_PROGRESS as alignment workflow status
    """
    donorsWithInProgressAlignment: Int!
    """
    Number of donors that have FAILED as alignment workflow status
    """
    donorsWithFailedAlignment: Int!
    """
    Number of donors that have no alignment workflow status
    """
    donorsWithNoAlignment: Int!

    """
    Number of donors that have COMPLETED as sanger workflow status
    """
    donorsWithCompletedSanger: Int!
    """
    Number of donors that have IN_PROGRESS as sanger workflow status
    """
    donorsWithInProgressSanger: Int!
    """
    Number of donors that have FAILED as sanger workflow status
    """
    donorsWithFailedSanger: Int!
    """
    Number of donors that have no sanger workflow status
    """
    donorsWithNoSanger: Int!

    """
    Number of donors that have COMPLETED as mutect2 workflow status
    """
    donorsWithCompletedMutect: Int!
    """
    Number of donors that have IN_PROGRESS as mutect2 workflow status
    """
    donorsWithInProgressMutect: Int!
    """
    Number of donors that have FAILED as mutect2 workflow status
    """
    donorsWithFailedMutect: Int!
    """
    Number of donors that have no mutect2 workflow status
    """
    donorsWithNoMutect: Int!
    """
    Date of the most recent update to the donor summary index for this program. Can be null if no documents for this program
    """
    lastUpdate: DateTime
  }

  type Query {
    """
    Paginated list of donor data summary given a program
    """
    programDonorSummary(
      programShortName: String!
      """
      Maximum page size of 500
      """
      first: Int = 20
      offset: Int = 0
      sorts: [DonorSummaryEntrySort] = [{ field: donorId, order: asc }]
      filters: [ProgramDonorSummaryFilter!] = []
    ): DonorSummary!

    """
    To be removed
    """
    programDonorSummaryEntries(
      programShortName: String!
      """
      Maximum page size of 500
      """
      first: Int = 20
      offset: Int = 0
      sorts: [DonorSummaryEntrySort] = [{ field: donorId, order: asc }]
      filters: [ProgramDonorSummaryFilter!] = []
    ): [DonorSummaryEntry]!

    """
    To be removed
    """
    programDonorSummaryStats(
      programShortName: String!
      filters: [ProgramDonorSummaryFilter!] = []
    ): ProgramDonorSummaryStats
  }
`;
