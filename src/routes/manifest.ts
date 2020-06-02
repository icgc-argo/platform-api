import express from 'express';
import { Client } from '@elastic/elasticsearch';
import { ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import esb from 'elastic-builder';

const createFileManifestStream = async function*(configs: {
  esClient: Client;
  shouldContinue: () => boolean;
}) {
  const { esClient, shouldContinue } = configs;
  let currentPage = 0;
  let completed = false;
  const pageSize = 2;
  while (!completed && shouldContinue()) {
    console.log(`streaming chunk #${currentPage}`);
    const {
      body: { hits },
    } = await esClient.search({
      index: ARRANGER_FILE_CENTRIC_INDEX,
      body: esb
        .requestBodySearch()
        .from(currentPage)
        .size(pageSize),
    });
    if (hits.hits.length) {
      currentPage++;
      yield hits.hits as { _source: { object_id: string } }[];
    } else {
      completed = true;
    }
  }
};

const createManifestDownloadRouter = (esClient: Client) => {
  const router = express.Router();

  router.use('/download', async (req, res) => {
    const docToTsvRow = (doc: {
      _source: { object_id: string; study_id: string; data_type: string };
    }): string => {
      return [doc._source.object_id, doc._source.study_id, doc._source.data_type].join('\t');
    };
    // res.setHeader('Content-disposition', 'attachment; filename=score-manifest.20200520.tsv');
    res.write(['object_id', 'study_id', 'data_type'].join('\t'));
    res.write('\n');
    for await (const chunk of createFileManifestStream({
      esClient,
      shouldContinue: () => !req.aborted,
    })) {
      res.write(chunk.map(docToTsvRow).join('\n'));
      res.write('\n');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    res.end();
  });

  return router;
};

export default createManifestDownloadRouter;
