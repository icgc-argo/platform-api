import urlJoin from 'url-join';
import { CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH } from '../config';
import fetch from 'node-fetch';
import logger from '../utils/logger';
var express = require('express');
var router = express.Router();

// Our specification download service can't use GraphQL because GraphQL specification requires the content-type
// that it returns be json, and we want to be able to return other content types, such as tab-separated-values,
// so that the user is automatically prompted to save the file from their browser.
const apiRoot = urlJoin(CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH);

// This is mostly passthrough, so file names and response will be set in clincial
// 'all'.zip or 'all' will retrieve the zip file with all templates
// for specific templates 'templateName'.tsv or 'templateName' will get the tsv from clinical
router.get('/template/:template', async (req, res) => {
  const name = req.params.template.replace(/.tsv$/, '').replace(/.zip$/, '');
  fetch(urlJoin(apiRoot, name))
    .then(r => {
      res.status(r.status);
      res.headers = r.headers.raw();
      // copying headers doesn't copy the content-type&content-disposition header...
      res.set({
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Content-Disposition': r.headers.get('content-disposition') || 'inline',
      });
      // pass buffered data to next '.then'
      return r.buffer(); // buffer() turns the body into the buffred data
    })
    .then(bufferedData => res.send(bufferedData))
    .catch(err => handleError(err, res));
});

// This is for handling nodejs/system errors (e.g. connection failed)
function handleError(err, res) {
  logger.error('Clinical Router Error - ' + err);
  return res.status(500).send('Internal Server Error');
}

module.exports = router;
