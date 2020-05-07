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
        esClient.index({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
          body: metadata.projectManifest,
          refresh: 'wait_for',
        }),
        esClient.index({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: FILE_CENTRIC_INDEX,
          body: metadata.projectIndexConfigs.file_centric,
          refresh: 'wait_for',
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

    logger.info(`created data: ${JSON.stringify(projectManifestInEs)}`);
    logger.info(`created data: ${JSON.stringify(fileCentricArrangerSetting)}`);

    if (
      isEqual(projectManifestInEs, metadata.projectManifest) &&
      isEqual(fileCentricArrangerSetting, metadata.projectIndexConfigs.file_centric)
    ) {
      return true;
    } else {
      throw new Error("couldn't index data properly");
    }
  };
  logger.info('initializing arranger metadata');
  return retry(initMetadata, { retries: 10 });
};
