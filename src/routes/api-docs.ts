import express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';
import { FEATURE_STORAGE_API_ENABLED } from 'config';

const DONOR_AGGREGATOR_API_PATH =
  '../resources/swagger/donor-aggregator-api.yaml';
const FILE_STORAGE_API_PATH = '../resources/swagger/file-storage-api.yaml';

export default () => {
  const router = express.Router();

  const mainDoc = yaml.load(
    path.join(__dirname, '../resources/swagger/index.yaml'),
  );

  // List of partial swagger YAML files to include in docs
  const partialDocPaths = [DONOR_AGGREGATOR_API_PATH];

  if (FEATURE_STORAGE_API_ENABLED) {
    // Include File Storage API if flag is enabled.
    partialDocPaths.push(FILE_STORAGE_API_PATH);
  }

  const mergedDoc: swaggerUi.SwaggerOptions = partialDocPaths.reduce(
    (mergedDocAccumulator, partialDocPath) => {
      const partialDoc = yaml.load(path.join(__dirname, partialDocPath));

      return {
        ...mergedDocAccumulator,
        ...partialDoc,
        paths: {
          ...mergedDocAccumulator.paths,
          ...partialDoc.paths,
        },
        tags: [...mergedDocAccumulator.tags, ...partialDoc.tags],
      };
    },
    mainDoc,
  );

  // Sort the tag orders alphabetically
  mergedDoc.tags = mergedDoc.tags.sort(
    (a: { name: string }, b: { name: string }) => (a.name > b.name ? 1 : -1),
  );

  router.use('/', swaggerUi.serve, swaggerUi.setup(mergedDoc));

  return router;
};
