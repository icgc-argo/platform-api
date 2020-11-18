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
  file_id: 'file_id',
  study_id: 'study_id',
  object_id: 'object_id',
  file_type: 'file_type',
  release_stage: 'release_stage',
  program_access_date: 'program_access_date',
  data_type: 'data_type',
  data_category: 'data_category',
  analysis_tools: 'analysis_tools',
  file_access: 'file_access',

  analysis: 'analysis',
  'analysis.analysis_id': 'analysis.analysis_id',
  'analysis.analysis_type': 'analysis.analysis_type',
  'analysis.analysis_version': 'analysis.analysis_version',
  'analysis.publish_date': 'analysis.publish_date',
  'analysis.variant_class': 'analysis.variant_class',
  'analysis.workflow': 'analysis.workflow',
  'analysis.workflow.workflow_name': 'analysis.workflow.workflow_name',
  'analysis.workflow.workflow_version': 'analysis.workflow.workflow_version',
  'analysis.experiment': 'analysis.experiment',
  'analysis.experiment.platform': 'analysis.experiment.platform',
  'analysis.experiment.experimental_strategy': 'analysis.experiment.experimental_strategy',

  file: 'file',
  'file.size': 'file.size',
  'file.md5sum': 'file.md5sum',
  'file.name': 'file.name',
  'file.index_file': 'file.index_file',
  'file.object_id': 'file.object_id',
  'file.file_type': 'file.file_type',
  'file.file_type.md5sum': 'file.file_type.md5sum',
  'file.file_type.name': 'file.file_type.name',
  'file.file_type.size': 'file.file_type.size',

  donors: 'donors',
  'donors.donor_id': 'donors.donor_id',
  'donors.submitter_donor_id': 'donors.submitter_donor_id',
  'donors.gender': 'donors.gender',
  'donors.specimens': 'donors.specimens',
  'donors.specimens.specimen_id': 'donors.specimens.specimen_id',
  'donors.specimens.submitter_specimen_id': 'donors.specimens.submitter_specimen_id',
  'donors.specimens.tumour_normal_designation': 'donors.specimens.tumour_normal_designation',
  'donors.specimens.specimen_tissue_source': 'donors.specimens.specimen_tissue_source',
  'donors.specimens.specimen_type': 'donors.specimens.specimen_type',
  'donors.specimens.samples': 'donors.specimens.samples',
  'donors.specimens.samples.sample_id': 'donors.specimens.samples.sample_id',
  'donors.specimens.samples.submitter_sample_id': 'donors.specimens.samples.submitter_sample_id',
  'donors.specimens.samples.sample_type': 'donors.specimens.samples.sample_type',
  'donors.specimens.samples.matched_normal_submitter_sample_id':
    'donors.specimens.samples.matched_normal_submitter_sample_id',

  repositories: 'repositories',
  'repositories.code': 'repositories.code',
  'repositories.name': 'repositories.name',
  'repositories.organization': 'repositories.organization',
  'repositories.country': 'repositories.country',
  'repositories.url': 'repositories.url',
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
