import es from '@elastic/elasticsearch';
const mapping = require('./sample_schema.json');
const donors = require('./donors.json');

const client = new es.Client({
  node: 'http://localhost:9200',
});

export const initIndexMapping = async (index: string, esClient: es.Client) => {
  const serializedIndexName = index.toLowerCase();
  await esClient.indices.putMapping({
    index: serializedIndexName,
    body: mapping.mappings,
  });
};

(async () => {
  try {
    await client.indices.delete({ index: 'donor_centric' });
  } catch (err) {
    console.log(err);
  }
  await client.indices.create({ index: 'donor_centric' }).catch(err => console.log('create'));
  await initIndexMapping('donor_centric', client).catch(err => console.log('mapping'));
  await Promise.all(
    donors.map((donor: any) =>
      client.index({
        index: 'donor_centric',
        body: {
          ...donor,
          createdAt: new Date(donor.createdAt),
          updatedAt: new Date(donor.updatedAt),
        },
      }),
    ),
  ).catch(err => console.log('index'));
})();
