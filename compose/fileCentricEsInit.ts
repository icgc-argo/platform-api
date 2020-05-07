import { Client } from '@elastic/elasticsearch';
import indexSettings from './file_centric/file_mapping.json';
import indexData from './file_centric/sample_file_centric.json';

(async () => {
  const esClient = new Client({
    node: 'http://localhost:9200',
  });
  const TEST_INDEX = 'file_centric_test';
  try {
    await esClient.indices.delete({
      index: TEST_INDEX,
    });
    await esClient.indices.create({
      index: TEST_INDEX,
      body: indexSettings,
    });
  } catch (err) {
    if (!(await esClient.indices.exists({ index: TEST_INDEX }))) {
      throw err;
    }
  }

  await Promise.all(
    indexData.map(doc =>
      esClient.index({
        index: TEST_INDEX,
        body: doc,
      }),
    ),
  );
  console.log('Complete!');
})();
