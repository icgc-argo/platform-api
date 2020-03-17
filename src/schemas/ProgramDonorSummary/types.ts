/**
 * Types from graphql
 */
export type DonorReleaseStatus = 'FULLY_RELEASED' | 'PARTIALLY_RELEASED' | 'NO_RELEASE' | 'UNKNOWN';

export type DonorProcessingStatus = 'COMPLETED' | 'PROCESSING' | 'REGISTERED' | 'UNKNOWN';

export type DonorSummaryEntry = {
  id: string;
  donorId: string;
  validWithCurrentDictionary: boolean;
  releaseStatus: DonorReleaseStatus;
  submitterDonorId: string;
  programId: string;
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
  processingStatus: DonorProcessingStatus;
  updatedAt: Date;
  createdAt: Date;
};

type ProgramDonorSummaryEntryField = keyof DonorSummaryEntry;

export type ProgramDonorSummaryFilter = {
  field: ProgramDonorSummaryEntryField;
  values: string[];
};

export type ProgramDonorSummaryStats = {
  programId: string;
  registeredDonorsCount: number;
  percentageCoreClinical: number;
  percentageTumorAndNormal: number;
  donorsProcessingMolecularDataCount: number;
  filesToQcCount: number;
  donorsWithReleasedFilesCount: number;
  allFilesCount: number;
};