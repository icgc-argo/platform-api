import { EsFileDocument, TsvFileSchema } from '../types';
import flatMap from 'lodash/flatMap';

const manifestFileFields: TsvFileSchema<EsFileDocument> = [
  {
    header: 'repository_code',
    getter: fileObj => fileObj.repositories.map(({ code }) => code).join('|'),
  },
  { header: 'analysis_id', getter: fileObj => fileObj.analysis.analysis_id },
  { header: 'object_id', getter: fileObj => fileObj.object_id },
  { header: 'file_type', getter: fileObj => fileObj.file_type },
  { header: 'file_name', getter: fileObj => fileObj.file.name },
  { header: 'file_size', getter: fileObj => String(fileObj.file.size) },
  { header: 'md5sum', getter: fileObj => fileObj.file.md5sum },
  { header: 'index_object_id', getter: fileObj => fileObj.file.index_file?.object_id || '' },
  {
    header: 'donor_id',
    getter: fileObj => fileObj.donors.map(({ donor_id }) => donor_id).join('|'),
  },
  {
    header: 'sample_id(s)',
    getter: fileObj =>
      flatMap(
        fileObj.donors.map(({ specimens }) =>
          specimens.map(({ samples }) => samples.map(({ sample_id }) => sample_id)),
        ),
      ).join('|'),
  },
  { header: 'project_id', getter: fileObj => fileObj.study_id },
];

export default manifestFileFields;
