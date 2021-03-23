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

  enum ChartType {
    CLINICAL
    MOLECULAR
  }

  enum DonorMolecularDataProcessingStatus {
    COMPLETE
    PROCESSING
    REGISTERED
  }

  enum DonorMolecularDataReleaseStatus {
    FULLY_RELEASED
    PARTIALLY_RELEASED
    NO_RELEASE
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
    rawReadsFirstPublishedDate: DateTime!
    """
    Timestamp of when this donor was first registered
    """
    createdAt: DateTime!
  }
  # TODO: I want to get back aggs not hits. change [DonorSummaryEntry]!
  # to look like aggs response.
  type Query {
    donorDataChartEntries(
      programId: String!
      chartType: ChartType!
      dataPoints: Int!
      dateRangeFrom: DateTime!
      dateRangeTo: DateTime!
    ): [DonorSummaryEntry]!
  }
`;
