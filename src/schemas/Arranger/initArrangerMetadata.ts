/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { Client } from '@elastic/elasticsearch';
import isEqual from 'lodash/isEqual';
import retry from 'async-retry';
import { ARRANGER_PROJECT_ID, ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import logger from 'utils/logger';
import metadata from 'resources/arranger_es_metadata.json';

export const ARRANGER_PROJECT_METADATA_INDEX = `arranger-projects-${ARRANGER_PROJECT_ID}`;
export const ARRANGER_PROJECTS_INDEX = `arranger-projects`;

export const harmonizedFileCentricConfig: typeof metadata.projectIndexConfigs.file_centric =
  {
    ...metadata.projectIndexConfigs.file_centric,
    index: ARRANGER_FILE_CENTRIC_INDEX,
  };

type EsConfig = {
  id: string;
  index: string;
};

const projectsEsConfig: EsConfig = {
  id: ARRANGER_PROJECT_ID,
  index: ARRANGER_PROJECTS_INDEX,
};

const projectMetadataEsConfig: EsConfig = {
  id: harmonizedFileCentricConfig.name,
  index: ARRANGER_PROJECT_METADATA_INDEX,
};

const { projectManifest } = metadata;

// for ARRANGER_PROJECT_METADATA_INDEX
const esUpdateBody = {
  doc: harmonizedFileCentricConfig,
};

export default async (esClient: Client) => {
  const initMetadata = async () => {
    await Promise.all([
      esClient.indices
        .create({ index: ARRANGER_PROJECTS_INDEX })
        .then(() => logger.info(`created ES index ${ARRANGER_PROJECTS_INDEX}`))
        .catch((err) =>
          logger.warn(
            `failed to create ES index ${ARRANGER_PROJECTS_INDEX}: ${err}`,
          ),
        ),
      esClient.indices
        .exists({ index: ARRANGER_PROJECT_METADATA_INDEX })
        .then(async ({ body: indexExists = false }) =>
          indexExists
            ? await esClient
                .update({ ...projectMetadataEsConfig, body: esUpdateBody })
                .then(() =>
                  logger.info(
                    `updated ES index settings ${ARRANGER_PROJECT_METADATA_INDEX}`,
                  ),
                )
                .catch((err) =>
                  logger.warn(
                    `failed to update ES index settings ${ARRANGER_PROJECT_METADATA_INDEX}: ${err}`,
                  ),
                )
            : await esClient.indices
                .create({ index: ARRANGER_PROJECT_METADATA_INDEX })
                .then(() =>
                  logger.info(
                    `created ES index ${ARRANGER_PROJECT_METADATA_INDEX}`,
                  ),
                )
                .catch((err) =>
                  logger.warn(
                    `failed to create ES index ${ARRANGER_PROJECT_METADATA_INDEX}: ${err}`,
                  ),
                ),
        )
        .catch((err) =>
          logger.warn(
            `failed to check if ES index ${ARRANGER_PROJECT_METADATA_INDEX} exists: ${err}`,
          ),
        ),
    ]);

    try {
      await Promise.all([
        esClient.index({
          ...projectsEsConfig,
          body: projectManifest,
          refresh: 'wait_for',
        }),
        esClient.index({
          ...projectMetadataEsConfig,
          body: harmonizedFileCentricConfig,
          refresh: 'wait_for',
        }),
      ]);
    } catch (err) {
      // we'll validate the data and only kill the app if the data doesn't match
      logger.warn(
        `failed to index metadata, will now check ES to confirm data: ${err}`,
      );
    }

    type TProjectManifest = typeof projectManifest;
    type TFileCentric = typeof metadata.projectIndexConfigs.file_centric;

    const [projectManifestInEs, fileCentricArrangerSetting]: [
      TProjectManifest,
      TFileCentric,
    ] = await Promise.all<TProjectManifest, TFileCentric>([
      esClient.get(projectsEsConfig).then(response => response._source),
      esClient.get(projectMetadataEsConfig).then(response => response._source),
    ]);

    if (
      isEqual(projectManifestInEs, projectManifest) &&
      isEqual(fileCentricArrangerSetting, harmonizedFileCentricConfig)
    ) {
      logger.info('arranger metadata init success!!!');
      return true;
    } else {
      throw new Error('arranger metadata mismatch in elasticsearch');
    }
  };
  logger.info('initializing arranger metadata');

  return retry(initMetadata, { retries: 10 });
};
