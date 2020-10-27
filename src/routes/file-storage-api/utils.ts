import { Client } from "@elastic/elasticsearch";
import { ARRANGER_FILE_CENTRIC_INDEX } from "config";
import esb from "elastic-builder";
import { EsFileCentricDocument } from "utils/commonTypes/EsFileCentricDocument";

export const getEsFileDocumentByObjectId = (esClient: Client) => (objectId: string) => {
  const objectIdField: keyof EsFileCentricDocument = 'object_id';
  return esClient
    .search({
      index: ARRANGER_FILE_CENTRIC_INDEX,
      body: esb
        .requestBodySearch()
        .query(esb.boolQuery().must(esb.termQuery(objectIdField, objectId))),
    })
    .then(res => res.body.hits.hits[0]?._source as EsFileCentricDocument | undefined);
};

export type SongEntity = {
  id: string;
  gnosId: string;
  fileName: string;
  projectCode: string;
  access: 'controlled' | 'public';
}

export const toSongEntity = (
  file: EsFileCentricDocument,
):SongEntity  => ({
  access: file.file_access,
  fileName: file.file.name,
  id: file.object_id,
  gnosId: file.analysis.analysis_id,
  projectCode: file.program_id,
});
