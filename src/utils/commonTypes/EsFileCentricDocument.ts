export type EsFileCentricDocument = {
  file_id: string;
  study_id: string;
  object_id: string;
  file_type: string;
  release_stage: FILE_RELEASE_STAGE;
  program_access_date: string;
  data_type: string;
  data_category: string;
  analysis_tools: string;
  file_access: FILE_ACCESS;
  analysis: {
    analysis_id: string;
    analysis_type: string;
    analysis_version: number;
    publish_date: string;
    workflow: {
      workflow_name: string;
      workflow_version: string;
    };
    variant_class: string;
    experiment: {
      platform: string;
      experimental_strategy: string;
    };
  };
  file: {
    size: number;
    md5sum: string;
    name: string;
    index_file: {
      object_id: string;
      file_type: string;
      md5sum: string;
      name: string;
      size: number;
    };
  };
  donors: Array<{
    donor_id: string;
    submitter_donor_id: string;
    gender: string;
    specimens: Array<{
      specimen_id: string;
      submitter_specimen_id: string;
      tumour_normal_designation: string;
      specimen_tissue_source: string;
      specimen_type: string;
      samples: Array<{
        sample_id: string;
        submitter_sample_id: string;
        sample_type: string;
        matched_normal_submitter_sample_id: string;
      }>;
    }>;
  }>;
  repositories: Array<{
    code: string;
    name: string;
    organization: string;
    country: string;
    url: string;
  }>;
};

export const FILE_METADATA_FIELDS = {
  file_id: 'file_id' as 'file_id',
  study_id: 'study_id' as 'study_id',
  object_id: 'object_id' as 'object_id',
  file_type: 'file_type' as 'file_type',
  release_stage: 'release_stage' as 'release_stage',
  program_access_date: 'program_access_date' as 'program_access_date',
  data_type: 'data_type' as 'data_type',
  data_category: 'data_category' as 'data_category',
  analysis_tools: 'analysis_tools' as 'analysis_tools',
  file_access: 'file_access' as 'file_access',

  analysis: 'analysis' as 'analysis',
  'analysis.analysis_id': 'analysis.analysis_id' as 'analysis.analysis_id',
  'analysis.analysis_type': 'analysis.analysis_type' as 'analysis.analysis_type',
  'analysis.analysis_version': 'analysis.analysis_version' as 'analysis.analysis_version',
  'analysis.publish_date': 'analysis.publish_date' as 'analysis.publish_date',
  'analysis.variant_class': 'analysis.variant_class' as 'analysis.variant_class',
  'analysis.workflow': 'analysis.workflow' as 'analysis.workflow',
  'analysis.workflow.workflow_name': 'analysis.workflow.workflow_name' as 'analysis.workflow.workflow_name',
  'analysis.workflow.workflow_version': 'analysis.workflow.workflow_version' as 'analysis.workflow.workflow_version',
  'analysis.experiment': 'analysis.experiment' as 'analysis.experiment',
  'analysis.experiment.platform': 'analysis.experiment.platform' as 'analysis.experiment.platform',
  'analysis.experiment.experimental_strategy': 'analysis.experiment.experimental_strategy' as 'analysis.experiment.experimental_strategy',

  file: 'file' as 'file',
  'file.size': 'file.size' as 'file.size',
  'file.md5sum': 'file.md5sum' as 'file.md5sum',
  'file.name': 'file.name' as 'file.name',
  'file.index_file': 'file.index_file' as 'file.index_file',
  'file.object_id': 'file.object_id' as 'file.object_id',
  'file.file_type': 'file.file_type' as 'file.file_type',
  'file.file_type.md5sum': 'file.file_type.md5sum' as 'file.file_type.md5sum',
  'file.file_type.name': 'file.file_type.name' as 'file.file_type.name',
  'file.file_type.size': 'file.file_type.size' as 'file.file_type.size',

  donors: 'donors' as 'donors',
  'donors.donor_id': 'donors.donor_id' as 'donors.donor_id',
  'donors.submitter_donor_id': 'donors.submitter_donor_id' as 'donors.submitter_donor_id',
  'donors.gender': 'donors.gender' as 'donors.gender',
  'donors.specimens': 'donors.specimens' as 'donors.specimens',
  'donors.specimens.specimen_id': 'donors.specimens.specimen_id' as 'donors.specimens.specimen_id',
  'donors.specimens.submitter_specimen_id': 'donors.specimens.submitter_specimen_id' as 'donors.specimens.submitter_specimen_id',
  'donors.specimens.tumour_normal_designation': 'donors.specimens.tumour_normal_designation' as 'donors.specimens.tumour_normal_designation',
  'donors.specimens.specimen_tissue_source': 'donors.specimens.specimen_tissue_source' as 'donors.specimens.specimen_tissue_source',
  'donors.specimens.specimen_type': 'donors.specimens.specimen_type' as 'donors.specimens.specimen_type',
  'donors.specimens.samples': 'donors.specimens.samples' as 'donors.specimens.samples',
  'donors.specimens.samples.sample_id': 'donors.specimens.samples.sample_id' as 'donors.specimens.samples.sample_id',
  'donors.specimens.samples.submitter_sample_id': 'donors.specimens.samples.submitter_sample_id' as 'donors.specimens.samples.submitter_sample_id',
  'donors.specimens.samples.sample_type': 'donors.specimens.samples.sample_type' as 'donors.specimens.samples.sample_type',
  'donors.specimens.samples.matched_normal_submitter_sample_id': 'donors.specimens.samples.matched_normal_submitter_sample_id' as 'donors.specimens.samples.matched_normal_submitter_sample_id',

  repositories: 'repositories' as 'repositories',
  'repositories.code': 'repositories.code' as 'repositories.code',
  'repositories.name': 'repositories.name' as 'repositories.name',
  'repositories.organization': 'repositories.organization' as 'repositories.organization',
  'repositories.country': 'repositories.country' as 'repositories.country',
  'repositories.url': 'repositories.url' as 'repositories.url',
};

export enum FILE_ACCESS {
  OPEN = 'open',
  CONTROLLED = 'controlled',
}

export enum FILE_RELEASE_STAGE {
  OWN_PROGRAM = 'OWN_PROGRAM',
  FULL_PROGRAMS = 'FULL_PROGRAMS',
  ASSOCIATE_PROGRAMS = 'ASSOCIATE_PROGRAMS',
  PUBLIC_QUEUE = 'PUBLIC_QUEUE',
  PUBLIC = 'PUBLIC',
}
