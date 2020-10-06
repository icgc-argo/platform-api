import express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';

export default () => {
  const router = express.Router();

  const mainDoc = yaml.load(path.join(__dirname, '../resources/swagger/index.yaml'));
  const fileStorageApiDoc = yaml.load(
    path.join(__dirname, '../resources/swagger/file-storage-api.yaml'),
  );

  const mergedDoc: swaggerUi.SwaggerOptions = {
    paths: {
      ...fileStorageApiDoc.paths,
      ...mainDoc.paths,
    },
    tags: [...fileStorageApiDoc.tags, ...mainDoc.tags],
    ...fileStorageApiDoc,
    ...mainDoc,
  };

  router.use('/', swaggerUi.serve, swaggerUi.setup(mergedDoc));

  return router;
};
