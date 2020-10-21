import { range, sample } from 'lodash';
import fs from 'fs';

const studyIds = ['PACA-CA', 'OCCAMS-GB', 'DASH-CA', 'TEST-CA'];
const releaseStages = [
  'OWN_PROGRAM',
  'FULL_PROGRAMS',
  'ASSOCIATE_PROGRAMS',
  'PUBLIC_QUEUE',
  'PUBLIC',
];
const gender = ['Male', 'Female'];
const donorIds = range(0, 100).map(num => `fake_donor_${num}`);
const submitterDonorIds = range(0, 100).map(num => `fake_donor_${num}`);

(() => {
  const args = process.argv.slice(2);

  const data = range(parseInt(args[0]) || 10001).map(i => ({
    object_id: `fake_file_${i}`,
    study_id: sample(studyIds),
    file_access: 'controlled',
    data_type: 'unaligned_reads',
    file_type: 'FASTQ',
    release_stage: sample(releaseStages),
    analysis: {
      analysis_id: `fake_analysis_${i}`,
      analysis_type: 'sequencing_experiment',
      analysis_version: 1,
      experiment: { platform: 'ILLUMINA', library_strategy: 'WGS' },
    },
    file: {
      file_id: `FI_Fake_${i}`,
      size: 0,
      md5sum: `fakeMd5_${i}`,
      name: `fake_file_${i}.gz`,
    },
    donors: {
      donor_id: sample(donorIds),
      submitter_donor_id: sample(submitterDonorIds),
      gender: sample(gender),
      specimens: {
        specimen_id: `fake_specimen_${i}`,
        submitter_specimen_id: 'insilico_2_tumor',
        tumour_normal_designation: 'Tumour',
        specimen_tissue_source: 'Blood derived',
        specimen_type: 'Primary tumour',
        samples: {
          sample_id: `fake_sample_${i}`,
          submitter_sample_id: 'insilico_2_tumor',
          sample_type: 'Total DNA',
          matched_normal_submitter_sample_id: 'insilico_2_normal',
        },
      },
    },
    repositories: {
      code: 'Cancer Collaboratory',
      name: 'Canadian RDPC',
      organization: 'Ontario Institute for Cancer Research',
      country: 'Canada',
      url: 'https://song.rdpc-dev.cancercollaboratory.org',
    },
  }));

  fs.writeFile(
    './compose/file_centric/sample_file_centric.json',
    JSON.stringify(data, null, 2),
    null,
    err => {
      if (err) {
        console.log('error writing file: ', err);
      } else {
        console.log('file written successfully');
      }
    },
  );
})();
