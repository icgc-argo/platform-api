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
    ...mainDoc,
    ...fileStorageApiDoc,
    paths: {
      ...mainDoc.paths,
      ...fileStorageApiDoc.paths,
    },
    tags: [...mainDoc.tags, ...fileStorageApiDoc.tags],
  };

  router.use('/', swaggerUi.serve, swaggerUi.setup(mergedDoc));

  return router;
};
