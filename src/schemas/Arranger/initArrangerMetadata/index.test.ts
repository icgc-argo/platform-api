import initArrangerMetadata, {
  ARRANGER_PROJECT_METADATA_INDEX,
  ARRANGER_PROJECTS_INDEX,
  FILE_CENTRIC_INDEX,
  harmonizedFileCentricConfig,
} from './index';
import { createEsClient } from 'services/elasticsearch';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';
import { Client } from '@elastic/elasticsearch';
import { ARRANGER_PROJECT_ID, ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import metadata from 'resources/arranger_es_metadata.json';

describe('initArrangerMetadata', () => {
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
  }, 120000);
  afterAll(async () => {
    await esContainer.stop();
  }, 120000);

  test('indices must exist after run', async () => {
    await initArrangerMetadata(esClient);
    expect((await esClient.indices.exists({ index: ARRANGER_PROJECT_METADATA_INDEX })).body).toBe(
      true,
    );
    expect((await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX })).body).toBe(true);
  });

  test('must handle another run without failing', async () => {
    expect(initArrangerMetadata(esClient)).resolves.toBeDefined();
    expect((await esClient.indices.exists({ index: ARRANGER_PROJECT_METADATA_INDEX })).body).toBe(
      true,
    );
    expect((await esClient.indices.exists({ index: ARRANGER_PROJECTS_INDEX })).body).toBe(true);
  });

  test('must index data properly', async () => {
    expect(
      (await esClient.get({
        index: ARRANGER_PROJECTS_INDEX,
        id: ARRANGER_PROJECT_ID,
      })).body._source,
    ).toEqual(metadata.projectManifest);
    expect(
      (await esClient.get({
        index: ARRANGER_PROJECT_METADATA_INDEX,
        id: FILE_CENTRIC_INDEX,
      })).body._source,
    ).toEqual(harmonizedFileCentricConfig);
  });

  test('must handle parallel runs without failing', async () => {
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
        id: FILE_CENTRIC_INDEX,
      })).body._source,
    ).toEqual(harmonizedFileCentricConfig);
  });
  test('ARRANGER_FILE_CENTRIC_INDEX config must be set in ES', async () => {
    expect(
      (await esClient.get({
        index: ARRANGER_PROJECT_METADATA_INDEX,
        id: FILE_CENTRIC_INDEX,
      })).body._source.index,
    ).toEqual(ARRANGER_FILE_CENTRIC_INDEX);
  });
});
