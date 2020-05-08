import { Client } from '@elastic/elasticsearch';
import isEqual from 'lodash/isEqual';
import retry from 'async-retry';
import { ARRANGER_PROJECT_ID, ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import logger from 'utils/logger';
import metadata from 'resources/arranger_es_metadata.json';

export const ARRANGER_PROJECT_METADATA_INDEX = `arranger-projects-${ARRANGER_PROJECT_ID}`;
export const ARRANGER_PROJECTS_INDEX = `arranger-projects`;

export const harmonizedFileCentricConfig: typeof metadata.projectIndexConfigs.file_centric = {
  ...metadata.projectIndexConfigs.file_centric,
  index: ARRANGER_FILE_CENTRIC_INDEX || metadata.projectIndexConfigs.file_centric.index,
};

const { projectManifest } = metadata;

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
          body: projectManifest,
          refresh: 'wait_for',
        }),
        esClient.index({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
          body: harmonizedFileCentricConfig,
          refresh: 'wait_for',
        }),
      ]);
    } catch (err) {
      // we'll validate the data and only kill the app if the data doesn't match
      logger.warn('failed to index metadata, will now check ES to confirm data');
    }

    const [projectManifestInEs, fileCentricArrangerSetting]: [
      typeof projectManifest,
      typeof metadata.projectIndexConfigs.file_centric,
    ] = await Promise.all([
      esClient
        .get({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
        })
        .then(response => response.body._source),
      esClient
        .get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })
        .then(response => response.body._source),
    ]);

    if (
      isEqual(projectManifestInEs, projectManifest) &&
      isEqual(fileCentricArrangerSetting, harmonizedFileCentricConfig)
    ) {
      return true;
    } else {
      throw new Error('arranger metadata mismatch in elasticsearch');
    }
  };
  logger.info('initializing arranger metadata');
  return retry(initMetadata, { retries: 10 });
};
