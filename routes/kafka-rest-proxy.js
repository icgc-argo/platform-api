import { KAFKA_REST_PROXY_ROOT, EGO_PUBLIC_KEY } from '../config';
import createEgoUtils from '@icgc-argo/ego-token-utils/dist/lib/ego-token-utils';
import urlJoin from 'url-join';
import request from 'request';

const TokenUtils = createEgoUtils(EGO_PUBLIC_KEY); 
var express = require('express');
var router = express.Router();
const apiRoot = KAFKA_REST_PROXY_ROOT;

// middleware to secure the kafka proxy endpoint
// it expects a valid jwt 
router.use((req, res, next) => {
  const jwt = (req.headers.authorization || '').split(' ')[1] || ''
  if (jwt === '') {
    return res.status(401).send(
      {
        message: "this endpoint needs a valid jwt token"
    });
  }
  const decodedToken = TokenUtils.decodeToken(jwt);
  if (decodedToken.exp > new Date().getUTCMilliseconds()){
    return next();
  }

  return res.status(401).send({
      message: "expired token"
  });
});

router.post('/:topic', (req, res) => {
  const url = urlJoin(apiRoot, "topics" , req.params.topic)
  return req.pipe(
    request.post(url, { headers: {
        'Content-Type': 'application/vnd.kafka.json.v2+json',
        'Accept': 'application/vnd.kafka.v2+json'
      }, json: true, body: req.body 
    }), { end: true })
    .pipe(res);
});

module.exports = router;
