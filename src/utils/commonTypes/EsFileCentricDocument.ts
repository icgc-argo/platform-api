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
  'analysis.analysis_id': 'analysis_id',
  'analysis.analysis_type': 'analysis_type',
  'analysis.analysis_version': 'analysis_version',
  'analysis.publish_date': 'publish_date',
  'analysis.variant_class': 'variant_class',
  'analysis.workflow': 'workflow',
  'analysis.workflow.workflow_name': 'workflow_name',
  'analysis.workflow.workflow_version': 'workflow_version',
  'analysis.experiment': 'experiment',
  'analysis.experiment.platform': 'platform',
  'analysis.experiment.experimental_strategy': 'experimental_strategy',

  file: 'file',
  'file.size': 'size',
  'file.md5sum': 'md5sum',
  'file.name': 'name',
  'file.index_file': 'index_file',
  'file.object_id': 'object_id',
  'file.file_type': 'file_type',
  'file.file_type.md5sum': 'md5sum',
  'file.file_type.name': 'name',
  'file.file_type.size': 'size',

  donors: 'donors',
  'donors.donor_id': 'donor_id',
  'donors.submitter_donor_id': 'submitter_donor_id',
  'donors.gender': 'gender',
  'donors.specimens': 'specimens',
  'donors.specimens.specimen_id': 'specimen_id',
  'donors.specimens.submitter_specimen_id': 'submitter_specimen_id',
  'donors.specimens.tumour_normal_designation': 'tumour_normal_designation',
  'donors.specimens.specimen_tissue_source': 'specimen_tissue_source',
  'donors.specimens.specimen_type': 'specimen_type',
  'donors.specimens.samples': 'samples',
  'donors.specimens.samples.sample_id': 'sample_id',
  'donors.specimens.samples.submitter_sample_id': 'submitter_sample_id',
  'donors.specimens.samples.sample_type': 'sample_type',
  'donors.specimens.samples.matched_normal_submitter_sample_id':
    'matched_normal_submitter_sample_id',

  repositories: 'repositories',
  'repositories.code': 'code',
  'repositories.name': 'name',
  'repositories.organization': 'organization',
  'repositories.country': 'country',
  'repositories.url': 'url',
};

export enum FILE_ACCESS {
  PUBLIC = 'public',
  CONTROLLED = 'controlled',
}

export enum FILE_RELEASE_STAGE {
  OWN_PROGRAM = 'OWN_PROGRAM',
  FULL_PROGRAMS = 'FULL_PROGRAMS',
  ASSOCIATE_PROGRAMS = 'ASSOCIATE_PROGRAMS',
  PUBLIC_QUEUE = 'PUBLIC_QUEUE',
  PUBLIC = 'PUBLIC',
}
