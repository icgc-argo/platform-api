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

export type ProgramDonorSummaryStatsGqlResponse = ProgramDonorSummaryStats & {
  id: () => string;
  programShortName: string;
};

export type SortOrder = 'asc' | 'desc';

export type DonorSummaryEntrySort = {
  field: keyof ElasticsearchDonorDocument;
  order: SortOrder;
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
  [EsDonorDocumentField.submittedCoreDataPercent]: number;
  [EsDonorDocumentField.submittedExtendedDataPercent]: number;
  [EsDonorDocumentField.submitterDonorId]: string;
  [EsDonorDocumentField.updatedAt]: string;
  [EsDonorDocumentField.validWithCurrentDictionary]: boolean;
  [EsDonorDocumentField.totalFilesCount]: number;
  [EsDonorDocumentField.filesToQcCount]: number;
};
