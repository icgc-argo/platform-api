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
