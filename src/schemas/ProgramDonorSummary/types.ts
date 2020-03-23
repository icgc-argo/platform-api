/**
 * Types from graphql
 */
export type DonorMolecularDataReleaseStatus =
  | 'FULLY_RELEASED'
  | 'PARTIALLY_RELEASED'
  | 'NO_RELEASE';

export type DonorMolecularDataProcessingStatus = 'COMPLETED' | 'PROCESSING' | 'REGISTERED';

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
  id: () => string;
  programShortName: string;
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
};
