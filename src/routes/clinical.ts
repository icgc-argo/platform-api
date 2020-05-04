import urlJoin from 'url-join';
import { CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH } from '../config';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import logger from '../utils/logger';
import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// Our specification download service can't use GraphQL because GraphQL specification requires the content-type
// that it returns be json, and we want to be able to return other content types, such as tab-separated-values,
// so that the user is automatically prompted to save the file from their browser.

// All router paths are passthrough so params verification, auth checking and response will be set in clincial

// 'all' will retrieve the zip file with all templates
// for specific templates 'templateName'.tsv or 'templateName' will get the tsv from clinical
router.get('/template/:template', async (req: Request, res: Response) => {
  const name = req.params.template.replace(/.tsv$/, '');
  const url = urlJoin(CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH);
  fetch(urlJoin(url, name))
    .then(r => covertFetchResToBuffer(r, res))
    .then(bufferedData => res.send(bufferedData))
    .catch(err => handleError(err, res));
});

router.get('/program/:programId/all-clincial-data', async (req: Request, res: Response) => {
  const programId = req.params.programId;
  const url = urlJoin(
    CLINICAL_SERVICE_ROOT,
    '/submission/program/',
    programId,
    '/clinical/committed/tsv',
  );
  fetch(url, {
    method: 'GET',
    headers: req.headers,
  } as any)
    .then(r => covertFetchResToBuffer(r, res))
    .then(bufferedData => res.send(bufferedData))
    .catch(err => handleError(err, res));
});

// This is for handling nodejs/system errors (e.g. connection failed)
function handleError(err: any, res: Response) {
  logger.error('Clinical Router Error - ' + err);
  return res.status(500).send('Internal Server Error');
}

function covertFetchResToBuffer(r: NodeFetchResponse, res: Response) {
  res.status(r.status);
  Object.entries(r.headers.raw()).forEach(([field, [value]]) => res.set(field, value));
  return r.buffer(); // buffer() consumes the body and returns the buffred data
}

export default router;
