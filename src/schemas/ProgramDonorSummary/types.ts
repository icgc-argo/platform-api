/**
 * Types from graphql
 */
export type DonorReleaseStatus = 'FULLY_RELEASED' | 'PARTIALLY_RELEASED' | 'NO_RELEASE' | 'UNKNOWN';

export type DonorMolecularDataProcessingStatus =
  | 'COMPLETED'
  | 'PROCESSING'
  | 'REGISTERED'
  | 'UNKNOWN';

export type DonorSummaryEntry = {
  id: string;
  donorId: string;
  validWithCurrentDictionary: boolean;
  releaseStatus: DonorReleaseStatus;
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
  processingStatus: DonorMolecularDataProcessingStatus;
  updatedAt: Date;
  createdAt: Date;
};

type ProgramDonorSummaryEntryField = keyof DonorSummaryEntry;

export type ProgramDonorSummaryFilter = {
  field: ProgramDonorSummaryEntryField;
  values: string[];
};

export type ProgramDonorSummaryStats = {
  programShortName: string;
  registeredDonorsCount: number;
  percentageCoreClinical: number;
  percentageTumourAndNormal: number;
  donorsProcessingMolecularDataCount: number;
  filesToQcCount: number;
  donorsWithReleasedFilesCount: number;
  allFilesCount: number;
};
