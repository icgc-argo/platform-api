export type TsvFileSchema<Source> = Array<{ header: string; getter: (source: Source) => string }>;

export type EsFileDocument = {
  analysis: {
    analysis_id: string;
    analysis_type: string;
    analysis_version: number;
    experiment: {
      experimental_strategy: string;
      platform: string;
    };
    workflow: {
      workflow_name: string;
      workflow_version: string;
    };
  };
  data_type: string;
  donors: Array<{
    donor_id: string;
    gender: string;
    specimens: Array<{
      samples: Array<{
        matched_normal_submitter_sample_id: string;
        sample_id: string;
        sample_type: string;
        submitter_sample_id: string;
      }>;
      specimen_id: string;
      specimen_tissue_source: string;
      specimen_type: string;
      submitter_specimen_id: string;
      tumour_normal_designation: string;
    }>;
    submitter_donor_id: string;
  }>;
  file: {
    index_file?: {
      file_type: string;
      md5sum: string;
      name: string;
      object_id: string;
      size: number;
    };
    md5sum: string;
    name: string;
    size: number;
  };
  file_access: string;
  file_autocomplete: string;
  file_type: string;
  object_id: string;
  repositories: Array<{
    code: string;
    country: string;
    name: string;
    organization: string;
    url: string;
  }>;
  study_id: string;
  variant_class: string;
};
