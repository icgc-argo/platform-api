import { range, sample } from 'lodash';
import fs from 'fs';
import { v5 as uuidv5 } from 'uuid';
import fetch from 'node-fetch';

const RDPC_URL = 'https://api.rdpc-dev.cancercollaboratory.org/graphql';
const SCORE_URL = 'https://score.rdpc-dev.cancercollaboratory.org';

const studyIds = ['PACA-CA', 'OCCAMS-GB', 'DASH-CA', 'TEST-CA'];
const studyToLoadFromRdpc = 'TEST-CA';
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

const args = process.argv.slice(2);

(async () => {
  const uuidNamespace = '7a17f032-83b2-44fe-8cf0-bef1bfb77023'; //from https://www.uuidgenerator.net/
  const fileIdsFromRdpc: string[] =
    [] ||
    (await fetch(RDPC_URL, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: `{
        analyses(filter: { 
          studyId: "${studyToLoadFromRdpc}"
          analysisState: PUBLISHED
        }) {
          files {
            objectId
          }
        }
      }`,
      }),
      method: 'POST',
    })
      .then(res => res.json())
      .then(({ data }: { data: { analyses: Array<{ files: Array<{ objectId: string }> }> } }) =>
        data.analyses
          .map(({ files }) => files)
          .flatMap(x => x)
          .map(({ objectId }) => objectId),
      ));
  const usedIds: { [k: string]: true } = {};
  const data = range(parseInt(args[0]) || 1000).map((i, index) => {
    const studyId = sample(studyIds);
    const useDataFromRdpc = studyId === studyToLoadFromRdpc;
    const nextIdCandidate = fileIdsFromRdpc.filter(id => !usedIds[id])[0];
    if (useDataFromRdpc) {
      usedIds[nextIdCandidate] = true;
    }
    return {
      object_id:
        useDataFromRdpc && nextIdCandidate
          ? nextIdCandidate
          : uuidv5(`fake_file_${i}`, uuidNamespace),
      study_id: sample(studyIds),
      file_access: sample(['controlled', 'public']),
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
        url: SCORE_URL,
      },
    };
  });

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
