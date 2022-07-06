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
import initArrangerMetadata, {
  ARRANGER_PROJECT_METADATA_INDEX,
  ARRANGER_PROJECTS_INDEX,
  harmonizedFileCentricConfig,
} from '../initArrangerMetadata';
import { createEsClient } from 'services/elasticsearch';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';
import { Client } from '@elastic/elasticsearch';
import getArrangerGqlSchema from '..';
import { ARRANGER_FILE_CENTRIC_INDEX, ARRANGER_PROJECT_ID } from 'config';
import metadata from 'resources/arranger_es_metadata.json';
import _ from 'lodash';

describe('Arranger schema', () => {
  const mockMapping = {
    aliases: {
      file_centric: {},
    },
    mappings: {
      dynamic: false,
      date_detection: false,
      properties: {
        study_id: {
          type: 'keyword',
        },
        file: {
          properties: {
            file_id: {
              type: 'keyword',
            },
          },
        },
      },
    },
  };
  let esContainer: StartedTestContainer;
  let esClient: Client;
  let esHost: string;
  beforeAll(async () => {
    esContainer = await new GenericContainer('elasticsearch', '7.5.0')
      .withExposedPorts(9200)
      .withEnv('discovery.type', 'single-node')
      .withStartupTimeout(new Duration(120, TemporalUnit.SECONDS))
      .start();
    esHost = `http://${esContainer.getContainerIpAddress()}:${esContainer.getMappedPort(
      9200,
    )}`;
    esClient = await createEsClient({
      node: esHost,
    });
    esClient.indices.create({
      index: 'test',
      body: mockMapping,
    });
  }, 120000);
  afterAll(async (done) => {
    await esContainer.stop();
    done();
  });

  describe('initArrangerMetadata', () => {
    it('indices must exist after run', async () => {
      await initArrangerMetadata(esClient);
      expect(
        (
          await esClient.indices.exists({
            index: ARRANGER_PROJECT_METADATA_INDEX,
          })
        ).body,
      ).toBe(true);
      expect(
        (await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX }))
          .body,
      ).toBe(true);
    });

    it('must handle another run without failing', async () => {
      expect(initArrangerMetadata(esClient)).resolves.toBeDefined();
      expect(
        (
          await esClient.indices.exists({
            index: ARRANGER_PROJECT_METADATA_INDEX,
          })
        ).body,
      ).toBe(true);
      expect(
        (await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX }))
          .body,
      ).toBe(true);
    });

    it('must index data properly', async () => {
      expect(
        (
          await esClient.get({
            index: ARRANGER_PROJECTS_INDEX,
            id: ARRANGER_PROJECT_ID,
          })
        )._source,
      ).toEqual(metadata.projectManifest);
      expect(
        (
          await esClient.get({
            index: ARRANGER_PROJECT_METADATA_INDEX,
            id: harmonizedFileCentricConfig.name,
          })
        )._source,
      ).toEqual(harmonizedFileCentricConfig);
    });

    it('must handle parallel runs without failing', async () => {
      // simulates horizontal scale
      expect(
        Promise.all([
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
        ]),
      ).resolves.toBeDefined();
      expect(
        (
          await esClient.get({
            index: ARRANGER_PROJECTS_INDEX,
            id: ARRANGER_PROJECT_ID,
          })
        )._source,
      ).toEqual(metadata.projectManifest);
      expect(
        (
          await esClient.get({
            index: ARRANGER_PROJECT_METADATA_INDEX,
            id: harmonizedFileCentricConfig.name,
          })
        )._source,
      ).toEqual(harmonizedFileCentricConfig);
    });

    it('must index data using ARRANGER_FILE_CENTRIC_INDEX config', async () => {
      expect(
        (
          await esClient.get({
            index: ARRANGER_PROJECT_METADATA_INDEX,
            id: harmonizedFileCentricConfig.name,
          })
        )._source.index,
      ).toEqual(ARRANGER_FILE_CENTRIC_INDEX);
    });
  });

  describe('getArrangerGqlSchema', () => {
    it('generates arranger schema with "file" type', async () => {
      try {
        const arrangerSchema = await getArrangerGqlSchema(esClient);
        expect(
          arrangerSchema.getType(harmonizedFileCentricConfig.name)?.toString(),
        ).toBe(harmonizedFileCentricConfig.name);
      } catch (err) {
        throw err;
      }
    });
  });
});
