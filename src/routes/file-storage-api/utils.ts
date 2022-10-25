import { Client } from '@elastic/elasticsearch';
import { ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import esb from 'elastic-builder';
import {
  EsFileCentricDocument,
  FILE_ACCESS,
  FILE_METADATA_FIELDS,
} from 'utils/commonTypes/EsFileCentricDocument';

export const getEsFileDocumentByObjectId = (esClient: Client) => (
  objectId: string,
) =>
  esClient
    .search({
      index: ARRANGER_FILE_CENTRIC_INDEX,
      body: esb.requestBodySearch().query(
        esb.boolQuery().should([
          // ID could be file ID or index_file ID
          esb.termQuery(FILE_METADATA_FIELDS['object_id'], objectId),
          esb.termsQuery(
            FILE_METADATA_FIELDS['file.index_file.object_id'],
            objectId,
          ),
        ]),
      ),
    })
    .then(
      (res) =>
        res.body.hits.hits[0]?._source as EsFileCentricDocument | undefined,
    );

export type SongEntity = {
  id: string;
  gnosId: string;
  fileName: string;
  projectCode: string;
  access: FILE_ACCESS;
};

export const toSongEntity = (file: EsFileCentricDocument): SongEntity => ({
  access: file.file_access,
  fileName: file.file.name,
  id: file.object_id,
  gnosId: file.analysis.analysis_id,
  projectCode: file.study_id,
});

export const getIndexFile = (
  file: EsFileCentricDocument,
): SongEntity | undefined => {
  if (!file.file.index_file) {
    return;
  }
  const output = {
    access: file.file_access,
    fileName: file.file.index_file.name,
    id: file.file.index_file.object_id,
    gnosId: file.analysis.analysis_id,
    projectCode: file.study_id,
  };
  return output;
};
