export type EsFileCentricDocument = {
  program_id: string;
  primary_site: string;
  object_id: string;
  file_type: string;
  data_type: string;
  release_stage: string;
  file_access: 'public' | 'controlled';
  analysis: {
    analysis_id: string;
    analysis_type: string;
    analysis_version: number;
    workflow: {
      workflow_name: string;
      workflow_version: string;
    };
    experiment: {
      platform: string;
      library_strategy: string;
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
    vital_status: string;
    survival_time: number;
    prior_malignancy: string;
    primary_diagnosis: {
      age_at_diagnosis: number;
      cancer_type_code: string;
      clinical_tumour_staging_system: string;
      clinical_t_category: string;
      clinical_n_category: string;
      clinical_m_category: string;
    };
    follow_ups: Array<{
      follow_up_id: string;
      submitter_follow_up_id: string;
      disease_status_at_followup: string;
      relapse_type: string;
    }>;
    treatments: Array<{
      treatment_id: string;
      submitter_treatment_id: string;
      treatment_type: string;
      response_to_therapy: string;
    }>;
    specimens: Array<{
      specimen_id: string;
      submitter_specimen_id: string;
      tumour_normal_designation: string;
      specimen_tissue_source: string;
      specimen_type: string;
      pathological_tumour_staging_system: string;
      pathological_t_category: string;
      pathological_n_category: string;
      pathological_m_category: string;
      pathological_stage_group: string;
      specimen_anatomic_location: string;
      tumour_histological_type: string;
      tumour_grading_system: string;
      tumour_grade: string;
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
  program_id: 'program_id',
  primary_site: 'primary_site',
  object_id: 'object_id',
  file_type: 'file_type',
  data_type: 'data_type',
  release_stage: 'release_stage',
  file_access: 'file_access',

  /** @analysis */
  analysis: 'analysis',
  'analysis.analysis_id': 'analysis.analysis_id',
  'analysis.analysis_type': 'analysis.analysis_type',
  'analysis.analysis_version': 'analysis.analysis_version',
  'analysis.workflow': 'analysis.workflow',
  'analysis.workflow.workflow_name': 'analysis.workflow.workflow_name',
  'analysis.workflow.workflow_version': 'analysis.workflow.workflow_version',
  'analysis.experiment': 'analysis.experiment',
  'analysis.experiment.platform': 'analysis.experiment.platform',
  'analysis.experiment.library_strategy': 'analysis.experiment.library_strategy',

  /** @file */
  file: 'file',
  'file.size': 'file.size',
  'file.md5sum': 'file.md5sum',
  'file.name': 'file.name',
  'file.index_file': 'file.index_file',
  'file.index_file.object_id': 'file.index_file.object_id',
  'file.index_file.file_type': 'file.index_file.file_type',
  'file.index_file.md5sum': 'file.index_file.md5sum',
  'file.index_file.name': 'file.index_file.name',
  'file.index_file.size': 'file.index_file.size',

  /** @donors */
  donors: 'donors',
  'donors.donor_id': 'donors.donor_id',
  'donors.submitter_donor_id': 'donors.submitter_donor_id',
  'donors.gender': 'donors.gender',
  'donors.vital_status': 'donors.vital_status',
  'donors.survival_time': 'donors.survival_time',
  'donors.prior_malignancy': 'donors.prior_malignancy',

  /** @primary_diagnosis */
  'donors.primary_diagnosis': 'donors.primary_diagnosis',
  'donors.primary_diagnosis.age_at_diagnosis': 'donors.primary_diagnosis.age_at_diagnosis',
  'donors.primary_diagnosis.cancer_type_code': 'donors.primary_diagnosis.cancer_type_code',
  'donors.primary_diagnosis.clinical_tumour_staging_system':
    'donors.primary_diagnosis.clinical_tumour_staging_system',
  'donors.primary_diagnosis.clinical_t_category': 'donors.primary_diagnosis.clinical_t_category',
  'donors.primary_diagnosis.clinical_n_category': 'donors.primary_diagnosis.clinical_n_category',
  'donors.primary_diagnosis.clinical_m_category': 'donors.primary_diagnosis.clinical_m_category',

  /** @follow_ups */
  'donors.follow_ups': 'donors.follow_ups.follow_ups',
  'donors.follow_ups.follow_up_id': 'donors.follow_ups.follow_up_id',
  'donors.follow_ups.submitter_follow_up_id': 'donors.follow_ups.submitter_follow_up_id',
  'donors.follow_ups.disease_status_at_followup': 'donors.follow_ups.disease_status_at_followup',
  'donors.follow_ups.relapse_type': 'donors.follow_ups.relapse_type',

  /** @treatments */
  'donors.treatments': 'donors.treatments',
  'donors.treatments.treatment_id': 'donors.treatments.treatment_id',
  'donors.treatments.submitter_treatment_id': 'donors.treatments.submitter_treatment_id',
  'donors.treatments.treatment_type': 'donors.treatments.treatment_type',
  'donors.treatments.response_to_therapy': 'donors.treatments.response_to_therapy',

  /** @specimens */
  'donors.specimens': 'donors.specimens',
  'donors.specimens.specimen_id': 'donors.specimens.specimen_id',
  'donors.specimens.submitter_specimen_id': 'donors.specimens.submitter_specimen_id',
  'donors.specimens.tumour_normal_designation': 'donors.specimens.tumour_normal_designation',
  'donors.specimens.specimen_tissue_source': 'donors.specimens.specimen_tissue_source',
  'donors.specimens.specimen_type': 'donors.specimens.specimen_type',
  'donors.specimens.pathological_tumour_staging_system':
    'donors.specimens.pathological_tumour_staging_system',
  'donors.specimens.pathological_t_category': 'donors.specimens.pathological_t_category',
  'donors.specimens.pathological_n_category': 'donors.specimens.pathological_n_category',
  'donors.specimens.pathological_m_category': 'donors.specimens.pathological_m_category',
  'donors.specimens.pathological_stage_group': 'donors.specimens.pathological_stage_group',
  'donors.specimens.specimen_anatomic_location': 'donors.specimens.specimen_anatomic_location',
  'donors.specimens.tumour_histological_type': 'donors.specimens.tumour_histological_type',
  'donors.specimens.tumour_grading_system': 'donors.specimens.tumour_grading_system',
  'donors.specimens.tumour_grade': 'donors.specimens.tumour_grade',

  /** @samples */
  'donors.specimens.samples': 'donors.specimens.samples',
  'donors.specimens.samples.sample_id': 'donors.specimens.samples.sample_id',
  'donors.specimens.samples.submitter_sample_id': 'donors.specimens.samples.submitter_sample_id',
  'donors.specimens.samples.sample_type': 'donors.specimens.samples.sample_type',
  'donors.specimens.samples.matched_normal_submitter_sample_id':
    'donors.specimens.samples.matched_normal_submitter_sample_id',

  /** @repositories */
  repositories: 'repositories',
  'repositories.code': 'repositories.code',
  'repositories.name': 'repositories.name',
  'repositories.organization': 'repositories.organization',
  'repositories.country': 'repositories.country',
  'repositories.url': 'repositories.url',
};
