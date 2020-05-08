import initArrangerMetadata, {
  ARRANGER_PROJECT_METADATA_INDEX,
  ARRANGER_PROJECTS_INDEX,
  harmonizedFileCentricConfig,
} from './initArrangerMetadata';
import { createEsClient } from 'services/elasticsearch';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';
import { Client } from '@elastic/elasticsearch';
import getArrangerGqlSchema from '.';
import { ARRANGER_FILE_CENTRIC_INDEX, ARRANGER_PROJECT_ID } from 'config';
import metadata from 'resources/arranger_es_metadata.json';

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
  beforeAll(async () => {
    esContainer = await new GenericContainer('elasticsearch', '7.5.0')
      .withExposedPorts(9200)
      .withEnv('discovery.type', 'single-node')
      .withStartupTimeout(new Duration(120, TemporalUnit.SECONDS))
      .start();
    esClient = await createEsClient({
      node: `http://${esContainer.getContainerIpAddress()}:${esContainer.getMappedPort(9200)}`,
    });
    esClient.indices.create({
      index: 'test',
      body: mockMapping,
    });
  }, 120000);
  afterAll(async () => {
    await esContainer.stop();
  }, 120000);

  describe("initArrangerMetadata", () => {
    it('indices must exist after run', async () => {
      await initArrangerMetadata(esClient);
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECT_METADATA_INDEX })).body).toBe(
        true,
      );
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX })).body).toBe(true);
    });

    it('must handle another run without failing', async () => {
      expect(initArrangerMetadata(esClient)).resolves.toBeDefined();
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECT_METADATA_INDEX })).body).toBe(
        true,
      );
      expect((await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX })).body).toBe(true);
    });

    it('must index data properly', async () => {
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
        })).body._source,
      ).toEqual(metadata.projectManifest);
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })).body._source,
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
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
          initArrangerMetadata(esClient),
        ]),
      ).resolves.toBeDefined();
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECTS_INDEX,
          id: ARRANGER_PROJECT_ID,
        })).body._source,
      ).toEqual(metadata.projectManifest);
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })).body._source,
      ).toEqual(harmonizedFileCentricConfig);
    });

    it('must index data using ARRANGER_FILE_CENTRIC_INDEX config', async () => {
      expect(
        (await esClient.get({
          index: ARRANGER_PROJECT_METADATA_INDEX,
          id: harmonizedFileCentricConfig.name,
        })).body._source.index,
      ).toEqual(ARRANGER_FILE_CENTRIC_INDEX);
    });
  });

  describe("getArrangerGqlSchema", () => {
    it('generates arranger schema with "file" type', async () => {
      try {
        const arrangerSchema = await getArrangerGqlSchema(esClient);
        expect(arrangerSchema.getType(harmonizedFileCentricConfig.name)?.toString()).toBe(
          harmonizedFileCentricConfig.name,
        );
      } catch (err) {
        throw err;
      }
    });
  })
});
