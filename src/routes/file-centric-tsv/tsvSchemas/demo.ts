import { EsFileDocument, TsvFileSchema } from '../types';

const demoTsvSchema: TsvFileSchema<EsFileDocument> = [
  {
    header: 'file name',
    getter: source => source.file.name,
  },
];

export default demoTsvSchema;
