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

/**
 * Types from graphql
 */
export enum DonorMolecularDataReleaseStatus {
  FULLY_RELEASED = 'FULLY_RELEASED',
  PARTIALLY_RELEASED = 'PARTIALLY_RELEASED',
  NO_RELEASE = 'NO_RELEASE',
}

export enum DonorMolecularDataProcessingStatus {
  COMPLETE = 'COMPLETE',
  PROCESSING = 'PROCESSING',
  REGISTERED = 'REGISTERED',
}

export type DonorSummaryEntry = {
  id: string;
  donorId: string;
  validWithCurrentDictionary: boolean;
  releaseStatus: DonorMolecularDataReleaseStatus;
  submitterDonorId: string;
  programShortName: string;
  submittedCoreDataPercent: number;
  submittedExtendedDataPercent: number;
  registeredNormalSamples: number;
  registeredTumourSamples: number;
  publishedNormalAnalysis: number;
  publishedTumourAnalysis: number;
  alignmentsCompleted: number;
  alignmentsRunning: number;
  alignmentsFailed: number;
  sangerVcsCompleted: number;
  sangerVcsRunning: number;
  sangerVcsFailed: number;
  mutectCompleted: number;
  mutectRunning: number;
  mutectFailed: number;
  processingStatus: DonorMolecularDataProcessingStatus;
  updatedAt: Date;
  createdAt: Date;
};

type ProgramDonorSummaryEntryField = keyof DonorSummaryEntry & keyof
  { combinedDonorId: string,
    coreDataPercentAggregation: string,
    registeredSamplePairs: string,
    rawReads: string,
  };

export type ProgramDonorSummaryFilter = {
  field: ProgramDonorSummaryEntryField;
  values: string[];
};

export type ProgramDonorSummaryStats = {
  registeredDonorsCount: number;
  percentageCoreClinical: number;
  percentageTumourAndNormal: number;
  donorsProcessingMolecularDataCount: number;
  filesToQcCount: number;
  donorsWithReleasedFilesCount: number;
  allFilesCount: number;
  fullyReleasedDonorsCount: number;
  partiallyReleasedDonorsCount: number;
  noReleaseDonorsCount: number;
  donorsInvalidWithCurrentDictionaryCount: number;
  lastUpdate?: Date;
};

export type ProgramDonorSummaryStatsGqlResponse = ProgramDonorSummaryStats & {
  id: string;
  programShortName: string;
};

export type SortOrder = 'asc' | 'desc';

export type DonorSummaryEntrySort = {
  field: keyof ElasticsearchDonorDocument;
  order: SortOrder;
};
export type BaseQueryArguments = {
  programShortName: string;
};

/**
 * Types from Elasticsearch
 */
export enum EsDonorDocumentField {
  alignmentsCompleted = 'alignmentsCompleted',
  alignmentsFailed = 'alignmentsFailed',
  alignmentsRunning = 'alignmentsRunning',
  createdAt = 'createdAt',
  donorId = 'donorId',
  combinedDonorId = 'combinedDonorId',
  coreDataPercentAggregation = 'coreDataPercentAggregation',
  registeredSamplePairs = 'registeredSamplePairs',
  rawReads = 'rawReads',
  processingStatus = 'processingStatus',
  programId = 'programId',
  publishedNormalAnalysis = 'publishedNormalAnalysis',
  publishedTumourAnalysis = 'publishedTumourAnalysis',
  registeredNormalSamples = 'registeredNormalSamples',
  registeredTumourSamples = 'registeredTumourSamples',
  releaseStatus = 'releaseStatus',
  sangerVcsCompleted = 'sangerVcsCompleted',
  sangerVcsFailed = 'sangerVcsFailed',
  sangerVcsRunning = 'sangerVcsRunning',
  mutectCompleted = 'mutectCompleted',
  mutectRunning = 'mutectRunning',
  mutectFailed = 'mutectFailed',
  submittedCoreDataPercent = 'submittedCoreDataPercent',
  submittedExtendedDataPercent = 'submittedExtendedDataPercent',
  submitterDonorId = 'submitterDonorId',
  updatedAt = 'updatedAt',
  validWithCurrentDictionary = 'validWithCurrentDictionary',
  totalFilesCount = 'totalFilesCount',
  filesToQcCount = 'filesToQcCount',
}

export type ElasticsearchDonorDocument = {
  [EsDonorDocumentField.alignmentsCompleted]: number;
  [EsDonorDocumentField.alignmentsFailed]: number;
  [EsDonorDocumentField.alignmentsRunning]: number;
  [EsDonorDocumentField.createdAt]: string;
  [EsDonorDocumentField.donorId]: string;
  [EsDonorDocumentField.processingStatus]: DonorMolecularDataProcessingStatus | '';
  [EsDonorDocumentField.programId]: string;
  [EsDonorDocumentField.publishedNormalAnalysis]: number;
  [EsDonorDocumentField.publishedTumourAnalysis]: number;
  [EsDonorDocumentField.registeredNormalSamples]: number;
  [EsDonorDocumentField.registeredTumourSamples]: number;
  [EsDonorDocumentField.releaseStatus]: DonorMolecularDataReleaseStatus | '';
  [EsDonorDocumentField.sangerVcsCompleted]: number;
  [EsDonorDocumentField.sangerVcsFailed]: number;
  [EsDonorDocumentField.sangerVcsRunning]: number;
  [EsDonorDocumentField.mutectCompleted]: number;
  [EsDonorDocumentField.mutectRunning]: number;
  [EsDonorDocumentField.mutectFailed]: number;
  [EsDonorDocumentField.submittedCoreDataPercent]: number;
  [EsDonorDocumentField.submittedExtendedDataPercent]: number;
  [EsDonorDocumentField.submitterDonorId]: string;
  [EsDonorDocumentField.updatedAt]: string;
  [EsDonorDocumentField.validWithCurrentDictionary]: boolean;
  [EsDonorDocumentField.totalFilesCount]: number;
  [EsDonorDocumentField.filesToQcCount]: number;
};

export enum coreDataPercentAggregationValue {
  INCOMPLETE = 'INCOMPLETE',
  COMPLETE = 'COMPLETE',
  NO_DATA = 'NO_DATA'
}

export enum registeredSamplePairsValue {
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export enum rawReadsValue {
  VALID = 'VALID',
  INVALID = 'INVALID',
}
