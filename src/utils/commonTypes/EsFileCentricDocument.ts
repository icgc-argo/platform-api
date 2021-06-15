export type EsFileCentricDocument = {
  file_id: string;
  study_id: string;
  object_id: string;
  file_type: string;
  embargo_stage: FILE_EMBARGO_STAGE;
  release_state: FILE_RELEASE_STATE;
  program_access_date: string;
  data_type: string;
  data_category: string;
  analysis_tools: string;
  file_access: FILE_ACCESS;
  meta: {
    embargo_stage: FILE_EMBARGO_STAGE;
    release_stage: FILE_RELEASE_STATE;
    study_id: string;
  };
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
  clinical: {
    donor: {
      age_at_menarche: number;
      bmi: number;
      cause_of_death: string;
      donor_id: string;
      height: number;
      menopause_status: string;
      number_of_children: number;
      number_of_pregnancies: number;
      primary_site: string;
      submitter_donor_id: string;
      survival_time: number;
      vital_status: string;
      weight: number;
    };
    follow_ups: Array<{
      anatomic_site_progression_or_recurrences: string;
      disease_status_at_followup: string;
      follow_up_id: string;
      interval_of_followup: number;
      is_primary_treatment: string;
      method_of_progression_status: string;
      posttherapy_m_category: string;
      posttherapy_n_category: string;
      posttherapy_stage_group: string;
      posttherapy_t_category: string;
      posttherapy_tumour_staging_system: string;
      primary_diagnosis_id: string;
      recurrence_m_category: string;
      recurrence_n_category: string;
      recurrence_stage_group: string;
      recurrence_t_category: string;
      recurrence_tumour_staging_system: string;
      relapse_interval: number;
      relapse_type: string;
      submitter_follow_up_id: string;
      submitter_primary_diagnosis_id: string;
      submitter_treatment_id: string;
      treatment_id: string;
      treatment_type: string;
      weight_at_followup: number;
    }>;
    primary_diagnosis: Array<{
      age_at_diagnosis: number;
      basis_of_diagnosis: string;
      cancer_type_additional_information: string;
      cancer_type_code: string;
      clinical_m_category: string;
      clinical_n_category: string;
      clinical_stage_group: string;
      clinical_t_category: string;
      clinical_tumour_staging_system: string;
      number_lymph_nodes_examined: number;
      number_lymph_nodes_positive: number;
      performance_status: string;
      presenting_symptoms: string;
      primary_diagnosis_id: string;
      submitter_primary_diagnosis_id: string;
    }>;
    specimens: Array<{
      pathological_m_category: string;
      pathological_n_category: string;
      pathological_stage_group: string;
      pathological_t_category: string;
      pathological_tumour_staging_system: string;
      percent_inflammatory_tissue: number;
      percent_necrosis: number;
      percent_proliferating_cells: number;
      percent_stromal_cells: number;
      percent_tumour_cells: number;
      primary_diagnosis_id: string;
      reference_pathology_confirmed: string;
      specimen_acquisition_interval: number;
      specimen_anatomic_location: string;
      specimen_id: string;
      specimen_processing: string;
      specimen_storage: string;
      submitter_primary_diagnosis_id: string;
      submitter_specimen_id: string;
      tumour_grade: string;
      tumour_grading_system: string;
      tumour_histological_type: string;
    }>;
    treatments: Array<{
      adverse_events: string;
      anatomical_site_irradiated: string;
      chemotherapy_dosage_units: string;
      clinical_trial_number: string;
      clinical_trials_database: string;
      cumulative_drug_dosage: number;
      days_per_cycle: number;
      drug_name: string;
      drug_rxnormcui: string;
      hemotological_toxicity: string;
      hormone_drug_dosage_units: string;
      is_primary_treatment: string;
      line_of_treatment: number;
      number_of_cycles: number;
      outcome_of_treatment: string;
      primary_diagnosis_id: string;
      radiation_therapy_dosage: number;
      radiation_therapy_fractions: number;
      radiation_therapy_modality: string;
      radiation_therapy_type: string;
      response_to_treatment: string;
      submitter_primary_diagnosis_id: string;
      submitter_treatment_id: string;
      toxicity_type: string;
      treatment_duration: number;
      treatment_id: string;
      treatment_intent: string;
      treatment_setting: string;
      treatment_start_interval: number;
      treatment_type: string;
    }>;
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
  release_state: 'release_state' as 'release_state',
  embargo_stage: 'embargo_stage' as 'embargo_stage',
  program_access_date: 'program_access_date' as 'program_access_date',
  data_type: 'data_type' as 'data_type',
  data_category: 'data_category' as 'data_category',
  analysis_tools: 'analysis_tools' as 'analysis_tools',
  file_access: 'file_access' as 'file_access',

  meta: {
    embargo_stage: 'embargo_stage' as 'embargo_stage',
    release_state: 'release_state' as 'release_state',
    study_id: 'study_id' as 'study_id',
  },

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

  clinical: 'clinical' as 'clinical',
  'clinical.donor': 'clinical.donor' as 'clinical.donor',
  'clinical.donor.age_at_menarche': 'clinical.donor.age_at_menarche' as 'clinical.donor.age_at_menarche',
  'clinical.donor.bmi': 'clinical.donor.bmi' as 'clinical.donor.bmi',
  'clinical.donor.cause_of_death': 'clinical.donor.cause_of_death' as 'clinical.donor.cause_of_death',
  'clinical.donor.donor_id': 'clinical.donor.donor_id' as 'clinical.donor.donor_id',
  'clinical.donor.height': 'clinical.donor.height' as 'clinical.donor.height',
  'clinical.donor.menopause_status': 'clinical.donor.menopause_status' as 'clinical.donor.menopause_status',
  'clinical.donor.number_of_children': 'clinical.donor.number_of_children' as 'clinical.donor.number_of_children',
  'clinical.donor.number_of_pregnancies': 'clinical.donor.number_of_pregnancies' as 'clinical.donor.number_of_pregnancies',
  'clinical.donor.primary_site': 'clinical.donor.primary_site' as 'clinical.donor.primary_site',
  'clinical.donor.submitter_donor_id': 'clinical.donor.submitter_donor_id' as 'clinical.donor.submitter_donor_id',
  'clinical.donor.survival_time': 'clinical.donor.survival_time' as 'clinical.donor.survival_time',
  'clinical.donor.vital_status': 'clinical.donor.vital_status' as 'clinical.donor.vital_status',
  'clinical.donor.weight': 'clinical.donor.weight' as 'clinical.donor.weight',
  'clinical.follow_ups': 'clinical.follow_ups' as 'clinical.follow_ups',
  'clinical.follow_ups.anatomic_site_progression_or_recurrences': 'clinical.follow_ups.anatomic_site_progression_or_recurrences' as 'clinical.follow_ups.anatomic_site_progression_or_recurrences',
  'clinical.follow_ups.disease_status_at_followup': 'clinical.follow_ups.disease_status_at_followup' as 'clinical.follow_ups.disease_status_at_followup',
  'clinical.follow_ups.follow_up_id': 'clinical.follow_ups.follow_up_id' as 'clinical.follow_ups.follow_up_id',
  'clinical.follow_ups.interval_of_followup': 'clinical.follow_ups.interval_of_followup' as 'clinical.follow_ups.interval_of_followup',
  'clinical.follow_ups.is_primary_treatment': 'clinical.follow_ups.is_primary_treatment' as 'clinical.follow_ups.is_primary_treatment',
  'clinical.follow_ups.method_of_progression_status': 'clinical.follow_ups.method_of_progression_status' as 'clinical.follow_ups.method_of_progression_status',
  'clinical.follow_ups.posttherapy_m_category': 'clinical.follow_ups.posttherapy_m_category' as 'clinical.follow_ups.posttherapy_m_category',
  'clinical.follow_ups.posttherapy_n_category': 'clinical.follow_ups.posttherapy_n_category' as 'clinical.follow_ups.posttherapy_n_category',
  'clinical.follow_ups.posttherapy_stage_group': 'clinical.follow_ups.posttherapy_stage_group' as 'clinical.follow_ups.posttherapy_stage_group',
  'clinical.follow_ups.posttherapy_t_category': 'clinical.follow_ups.posttherapy_t_category' as 'clinical.follow_ups.posttherapy_t_category',
  'clinical.follow_ups.posttherapy_tumour_staging_system': 'clinical.follow_ups.posttherapy_tumour_staging_system' as 'clinical.follow_ups.posttherapy_tumour_staging_system',
  'clinical.follow_ups.primary_diagnosis_id': 'clinical.follow_ups.primary_diagnosis_id' as 'clinical.follow_ups.primary_diagnosis_id',
  'clinical.follow_ups.recurrence_m_category': 'clinical.follow_ups.recurrence_m_category' as 'clinical.follow_ups.recurrence_m_category',
  'clinical.follow_ups.recurrence_n_category': 'clinical.follow_ups.recurrence_n_category' as 'clinical.follow_ups.recurrence_n_category',
  'clinical.follow_ups.recurrence_stage_group': 'clinical.follow_ups.recurrence_stage_group' as 'clinical.follow_ups.recurrence_stage_group',
  'clinical.follow_ups.recurrence_t_category': 'clinical.follow_ups.recurrence_t_category' as 'clinical.follow_ups.recurrence_t_category',
  'clinical.follow_ups.recurrence_tumour_staging_system': 'clinical.follow_ups.recurrence_tumour_staging_system' as 'clinical.follow_ups.recurrence_tumour_staging_system',
  'clinical.follow_ups.relapse_interval': 'clinical.follow_ups.relapse_interval' as 'clinical.follow_ups.relapse_interval',
  'clinical.follow_ups.relapse_type': 'clinical.follow_ups.relapse_type' as 'clinical.follow_ups.relapse_type',
  'clinical.follow_ups.submitter_follow_up_id': 'clinical.follow_ups.submitter_follow_up_id' as 'clinical.follow_ups.submitter_follow_up_id',
  'clinical.follow_ups.submitter_primary_diagnosis_id': 'clinical.follow_ups.submitter_primary_diagnosis_id' as 'clinical.follow_ups.submitter_primary_diagnosis_id',
  'clinical.follow_ups.submitter_treatment_id': 'clinical.follow_ups.submitter_treatment_id' as 'clinical.follow_ups.submitter_treatment_id',
  'clinical.follow_ups.treatment_id': 'clinical.follow_ups.treatment_id' as 'clinical.follow_ups.treatment_id',
  'clinical.follow_ups.treatment_type': 'clinical.follow_ups.treatment_type' as 'clinical.follow_ups.treatment_type',
  'clinical.follow_ups.weight_at_followup': 'clinical.follow_ups.weight_at_followup' as 'clinical.follow_ups.weight_at_followup',
  'clinical.primary_diagnosis': 'clinical.primary_diagnosis' as 'clinical.primary_diagnosis',
  'clinical.primary_diagnosis.age_at_diagnosis': 'clinical.primary_diagnosis.age_at_diagnosis' as 'clinical.primary_diagnosis.age_at_diagnosis',
  'clinical.primary_diagnosis.basis_of_diagnosis': 'clinical.primary_diagnosis.basis_of_diagnosis' as 'clinical.primary_diagnosis.basis_of_diagnosis',
  'clinical.primary_diagnosis.cancer_type_additional_information': 'clinical.primary_diagnosis.cancer_type_additional_information' as 'clinical.primary_diagnosis.cancer_type_additional_information',
  'clinical.primary_diagnosis.cancer_type_code': 'clinical.primary_diagnosis.cancer_type_code' as 'clinical.primary_diagnosis.cancer_type_code',
  'clinical.primary_diagnosis.clinical_m_category': 'clinical.primary_diagnosis.clinical_m_category' as 'clinical.primary_diagnosis.clinical_m_category',
  'clinical.primary_diagnosis.clinical_n_category': 'clinical.primary_diagnosis.clinical_n_category' as 'clinical.primary_diagnosis.clinical_n_category',
  'clinical.primary_diagnosis.clinical_stage_group': 'clinical.primary_diagnosis.clinical_stage_group' as 'clinical.primary_diagnosis.clinical_stage_group',
  'clinical.primary_diagnosis.clinical_t_category': 'clinical.primary_diagnosis.clinical_t_category' as 'clinical.primary_diagnosis.clinical_t_category',
  'clinical.primary_diagnosis.clinical_tumour_staging_system': 'clinical.primary_diagnosis.clinical_tumour_staging_system' as 'clinical.primary_diagnosis.clinical_tumour_staging_system',
  'clinical.primary_diagnosis.number_lymph_nodes_examined': 'clinical.primary_diagnosis.number_lymph_nodes_examined' as 'clinical.primary_diagnosis.number_lymph_nodes_examined',
  'clinical.primary_diagnosis.number_lymph_nodes_positive': 'clinical.primary_diagnosis.number_lymph_nodes_positive' as 'clinical.primary_diagnosis.number_lymph_nodes_positive',
  'clinical.primary_diagnosis.performance_status': 'clinical.primary_diagnosis.performance_status' as 'clinical.primary_diagnosis.performance_status',
  'clinical.primary_diagnosis.presenting_symptoms': 'clinical.primary_diagnosis.presenting_symptoms' as 'clinical.primary_diagnosis.presenting_symptoms',
  'clinical.primary_diagnosis.primary_diagnosis_id': 'clinical.primary_diagnosis.primary_diagnosis_id' as 'clinical.primary_diagnosis.primary_diagnosis_id',
  'clinical.primary_diagnosis.submitter_primary_diagnosis_id': 'clinical.primary_diagnosis.submitter_primary_diagnosis_id' as 'clinical.primary_diagnosis.submitter_primary_diagnosis_id',
  'clinical.specimens': 'clinical.specimens' as 'clinical.specimens',
  'clinical.specimens.pathological_m_category': 'clinical.specimens.pathological_m_category' as 'clinical.specimens.pathological_m_category',
  'clinical.specimens.pathological_n_category': 'clinical.specimens.pathological_n_category' as 'clinical.specimens.pathological_n_category',
  'clinical.specimens.pathological_stage_group': 'clinical.specimens.pathological_stage_group' as 'clinical.specimens.pathological_stage_group',
  'clinical.specimens.pathological_t_category': 'clinical.specimens.pathological_t_category' as 'clinical.specimens.pathological_t_category',
  'clinical.specimens.pathological_tumour_staging_system': 'clinical.specimens.pathological_tumour_staging_system' as 'clinical.specimens.pathological_tumour_staging_system',
  'clinical.specimens.percent_inflammatory_tissue': 'clinical.specimens.percent_inflammatory_tissue' as 'clinical.specimens.percent_inflammatory_tissue',
  'clinical.specimens.percent_necrosis': 'clinical.specimens.percent_necrosis' as 'clinical.specimens.percent_necrosis',
  'clinical.specimens.percent_proliferating_cells': 'clinical.specimens.percent_proliferating_cells' as 'clinical.specimens.percent_proliferating_cells',
  'clinical.specimens.percent_stromal_cells': 'clinical.specimens.percent_stromal_cells' as 'clinical.specimens.percent_stromal_cells',
  'clinical.specimens.percent_tumour_cells': 'clinical.specimens.percent_tumour_cells' as 'clinical.specimens.percent_tumour_cells',
  'clinical.specimens.primary_diagnosis_id': 'clinical.specimens.primary_diagnosis_id' as 'clinical.specimens.primary_diagnosis_id',
  'clinical.specimens.reference_pathology_confirmed': 'clinical.specimens.reference_pathology_confirmed' as 'clinical.specimens.reference_pathology_confirmed',
  'clinical.specimens.specimen_acquisition_interval': 'clinical.specimens.specimen_acquisition_interval' as 'clinical.specimens.specimen_acquisition_interval',
  'clinical.specimens.specimen_anatomic_location': 'clinical.specimens.specimen_anatomic_location' as 'clinical.specimens.specimen_anatomic_location',
  'clinical.specimens.specimen_id': 'clinical.specimens.specimen_id' as 'clinical.specimens.specimen_id',
  'clinical.specimens.specimen_processing': 'clinical.specimens.specimen_processing' as 'clinical.specimens.specimen_processing',
  'clinical.specimens.specimen_storage': 'clinical.specimens.specimen_storage' as 'clinical.specimens.specimen_storage',
  'clinical.specimens.submitter_primary_diagnosis_id': 'clinical.specimens.submitter_primary_diagnosis_id' as 'clinical.specimens.submitter_primary_diagnosis_id',
  'clinical.specimens.submitter_specimen_id': 'clinical.specimens.submitter_specimen_id' as 'clinical.specimens.submitter_specimen_id',
  'clinical.specimens.tumour_grade': 'clinical.specimens.tumour_grade' as 'clinical.specimens.tumour_grade',
  'clinical.specimens.tumour_grading_system': 'clinical.specimens.tumour_grading_system' as 'clinical.specimens.tumour_grading_system',
  'clinical.specimens.tumour_histological_type': 'clinical.specimens.tumour_histological_type' as 'clinical.specimens.tumour_histological_type',
  'clinical.treatments': 'clinical.treatments' as 'clinical.treatments',
  'clinical.treatments.adverse_events': 'clinical.treatments.adverse_events' as 'clinical.treatments.adverse_events',
  'clinical.treatments.anatomical_site_irradiated': 'clinical.treatments.anatomical_site_irradiated' as 'clinical.treatments.anatomical_site_irradiated',
  'clinical.treatments.chemotherapy_dosage_units': 'clinical.treatments.chemotherapy_dosage_units' as 'clinical.treatments.chemotherapy_dosage_units',
  'clinical.treatments.clinical_trial_number': 'clinical.treatments.clinical_trial_number' as 'clinical.treatments.clinical_trial_number',
  'clinical.treatments.clinical_trials_database': 'clinical.treatments.clinical_trials_database' as 'clinical.treatments.clinical_trials_database',
  'clinical.treatments.cumulative_drug_dosage': 'clinical.treatments.cumulative_drug_dosage' as 'clinical.treatments.cumulative_drug_dosage',
  'clinical.treatments.days_per_cycle': 'clinical.treatments.days_per_cycle' as 'clinical.treatments.days_per_cycle',
  'clinical.treatments.drug_name': 'clinical.treatments.drug_name' as 'clinical.treatments.drug_name',
  'clinical.treatments.drug_rxnormcui': 'clinical.treatments.drug_rxnormcui' as 'clinical.treatments.drug_rxnormcui',
  'clinical.treatments.hemotological_toxicity': 'clinical.treatments.hemotological_toxicity' as 'clinical.treatments.hemotological_toxicity',
  'clinical.treatments.hormone_drug_dosage_units': 'clinical.treatments.hormone_drug_dosage_units' as 'clinical.treatments.hormone_drug_dosage_units',
  'clinical.treatments.is_primary_treatment': 'clinical.treatments.is_primary_treatment' as 'clinical.treatments.is_primary_treatment',
  'clinical.treatments.line_of_treatment': 'clinical.treatments.line_of_treatment' as 'clinical.treatments.line_of_treatment',
  'clinical.treatments.number_of_cycles': 'clinical.treatments.number_of_cycles' as 'clinical.treatments.number_of_cycles',
  'clinical.treatments.outcome_of_treatment': 'clinical.treatments.outcome_of_treatment' as 'clinical.treatments.outcome_of_treatment',
  'clinical.treatments.primary_diagnosis_id': 'clinical.treatments.primary_diagnosis_id' as 'clinical.treatments.primary_diagnosis_id',
  'clinical.treatments.radiation_therapy_dosage': 'clinical.treatments.radiation_therapy_dosage' as 'clinical.treatments.radiation_therapy_dosage',
  'clinical.treatments.radiation_therapy_fractions': 'clinical.treatments.radiation_therapy_fractions' as 'clinical.treatments.radiation_therapy_fractions',
  'clinical.treatments.radiation_therapy_modality': 'clinical.treatments.radiation_therapy_modality' as 'clinical.treatments.radiation_therapy_modality',
  'clinical.treatments.radiation_therapy_type': 'clinical.treatments.radiation_therapy_type' as 'clinical.treatments.radiation_therapy_type',
  'clinical.treatments.response_to_treatment': 'clinical.treatments.response_to_treatment' as 'clinical.treatments.response_to_treatment',
  'clinical.treatments.submitter_primary_diagnosis_id': 'clinical.treatments.submitter_primary_diagnosis_id' as 'clinical.treatments.submitter_primary_diagnosis_id',
  'clinical.treatments.submitter_treatment_id': 'clinical.treatments.submitter_treatment_id' as 'clinical.treatments.submitter_treatment_id',
  'clinical.treatments.toxicity_type': 'clinical.treatments.toxicity_type' as 'clinical.treatments.toxicity_type',
  'clinical.treatments.treatment_duration': 'clinical.treatments.treatment_duration' as 'clinical.treatments.treatment_duration',
  'clinical.treatments.treatment_id': 'clinical.treatments.treatment_id' as 'clinical.treatments.treatment_id',
  'clinical.treatments.treatment_intent': 'clinical.treatments.treatment_intent' as 'clinical.treatments.treatment_intent',
  'clinical.treatments.treatment_setting': 'clinical.treatments.treatment_setting' as 'clinical.treatments.treatment_setting',
  'clinical.treatments.treatment_start_interval': 'clinical.treatments.treatment_start_interval' as 'clinical.treatments.treatment_start_interval',
  'clinical.treatments.treatment_type': 'clinical.treatments.treatment_type' as 'clinical.treatments.treatment_type',

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

export enum FILE_EMBARGO_STAGE {
  OWN_PROGRAM = 'PROGRAM_ONLY',
  FULL_PROGRAMS = 'MEMBER_ACCESS',
  ASSOCIATE_PROGRAMS = 'ASSOCIATE_ACCESS',
  PUBLIC = 'PUBLIC',
}

export enum FILE_RELEASE_STATE {
  RESTRICTED = 'RESTRICTED',
  QUEUED = 'QUEUED',
  PUBLIC = 'PUBLIC',
}
