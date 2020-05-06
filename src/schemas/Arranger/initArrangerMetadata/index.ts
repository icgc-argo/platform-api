import { Client } from '@elastic/elasticsearch';
import isEqual from 'lodash/isEqual';
import retry from 'async-retry';
import { ARRANGER_PROJECT_ID } from 'config';
import logger from 'utils/logger';
import metadata from 'resources/arranger_es_metadata.json';

export const ARRANGER_PROJECT_METADATA_INDEX = `arranger-projects-${ARRANGER_PROJECT_ID}`;
export const ARRANGER_PROJECTS_INDEX = `arranger-projects`;

export const FILE_CENTRIC_INDEX = 'file_centric';

export default async (esClient: Client) => {
  const initMetadata = async () => {
    await Promise.all([
      esClient.indices
        .create({ index: ARRANGER_PROJECTS_INDEX })
        .catch(err => logger.warn(`trying to create es index ${ARRANGER_PROJECTS_INDEX}: ${err}`)),
      esClient.indices
        .create({ index: ARRANGER_PROJECT_METADATA_INDEX })
        .catch(err =>
          logger.warn(`trying to create es index ${ARRANGER_PROJECT_METADATA_INDEX}: ${err}`),
        ),
    ]);

    try {
      await Promise.all([
        await esClient.index({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
          body: metadata.projectManifest,
        }),
        await esClient.index({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: FILE_CENTRIC_INDEX,
          body: metadata.projectIndexConfigs.file_centric,
        }),
      ]);
    } catch (err) {
      // we'll validate the data and only kill the app if the data doesn't match
      logger.warn('failed to index metadata, will now check ES to confirm data');
    }

    const projectManifestInEs = (await esClient.get({
      index: ARRANGER_PROJECTS_INDEX,
      id: ARRANGER_PROJECT_ID,
    })).body._source;
    const fileCentricArrangerSetting = (await esClient.get({
      index: ARRANGER_PROJECT_METADATA_INDEX,
      id: FILE_CENTRIC_INDEX,
    })).body._source;

    if (
      isEqual(projectManifestInEs, metadata.projectManifest) &&
      isEqual(fileCentricArrangerSetting, metadata.projectIndexConfigs.file_centric)
    ) {
      return true;
    } else {
      throw new Error("couldn't index data properly");
    }
  };
  return retry(initMetadata, { retries: 10 });
};
