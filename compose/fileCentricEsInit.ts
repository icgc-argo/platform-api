import { Client } from '@elastic/elasticsearch';
import indexSettings from './file_centric/file_mapping.json';
import indexData from './file_centric/sample_file_centric.json';

(async () => {
  const TEST_INDEX = 'file-centric';
  const ELASTICSEARCH_HOST = 'https://localhost:9200';
  const esClient = new Client({
    node: ELASTICSEARCH_HOST,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  try {
    await esClient.ping();
  } catch (err) {
    console.log(`failing to ping elasticsearch at ${ELASTICSEARCH_HOST}: `, err);
    throw err;
  }
  try {
    console.log(`deleting index ${TEST_INDEX}`);
    await esClient.indices.delete({
      index: TEST_INDEX,
    });
  } catch (err) {
    console.log(`could not delete index ${TEST_INDEX}: `, err);
    if ((await esClient.indices.exists({ index: TEST_INDEX })).body) {
      throw err;
    }
  }

  console.log(`creating index ${TEST_INDEX}`);

  await esClient.indices.create({
    index: TEST_INDEX,
    body: indexSettings,
  });

  console.log('index created');

  await Promise.all(
    indexData.map((doc, index) => {
      console.log(`doc_${index}`);
      return esClient.index({
        index: TEST_INDEX,
        refresh: 'wait_for',
        body: {
          ...doc,
          donors: [doc.donors].map(donor => ({
            ...donor,
            specimens: [donor.specimens].map(specimen => ({
              ...specimen,
              samples: [specimen.samples],
            })),
          })),
          repositories: [doc.repositories],
        },
      });
    }),
  );

  console.log('Complete!');
})();
