import urlJoin from 'url-join';
import { CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH } from '../config';
import fetch from 'node-fetch';

var express = require('express');
var router = express.Router();

// Our specification download service can't use GraphQL because GraphQL specification requires the content-type
// that it returns be json, and we want to be able to return other content types, such as tab-separated-values,
// so that the user is automatically prompted to save the file from their browser.
const apiRoot = urlJoin(CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH);

router.get('/template/:template', async (req, res) => {
  const name = req.params.template;
  const data = fetch(urlJoin(apiRoot, name)).then(r => {
    res.status(r.status);
    res.headers = r.headers;
    // copying headers doesn't copy the content-type header...
    res.contentType(r.headers.get('content-type'));
    res.send(r.body.read());
  });
});
module.exports = router;
