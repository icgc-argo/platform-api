import { KAFKA_REST_PROXY_ROOT, EGO_PUBLIC_KEY } from '../config';
import createEgoUtils from '@icgc-argo/ego-token-utils/dist/lib/ego-token-utils';
import urlJoin from 'url-join';
import logger from '../utils/logger';
import fetch from 'node-fetch';
import { json } from 'body-parser';
import express from 'express';

const TokenUtils = createEgoUtils(EGO_PUBLIC_KEY);
var router = express.Router();
const apiRoot = KAFKA_REST_PROXY_ROOT;

// fetch needs to use the json body parser
router.use(json());

// middleware to secure the kafka proxy endpoint
// it expects a valid jwt
router.use((req, res, next) => {
  const jwt = (req.headers.authorization || '').split(' ')[1] || '';
  if (jwt === '') {
    return res.status(401).send({
      message: 'this endpoint needs a valid jwt token',
    });
  }
  let decodedToken = '';
  try {
    decodedToken = TokenUtils.decodeToken(jwt);
  } catch (err) {
    logger.error('failed to decode token');
  }

  if (!decodedToken || decodedToken.exp < new Date().getUTCMilliseconds()) {
    return res.status(401).send({
      message: 'expired token',
    });
  }
  return next();
});

router.post('/:topic', async (req, res) => {
  const url = urlJoin(apiRoot, 'topics', req.params.topic);
  const msg = req.body;
  logger.debug(`received message in kafka proxy ${JSON.stringify(msg)}`);
  const kafkaRestProxyBody = JSON.stringify({
    records: [
      {
        value: msg,
      },
    ],
  });
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.kafka.json.v2+json',
      Accept: 'application/vnd.kafka.v2+json',
    },
    body: kafkaRestProxyBody,
  })
    .then(response => {
      res.contentType('application/vnd.kafka.v2+json');
      res.status(response.status);
      return response.body.pipe(res);
    })
    .catch(e => {
      logger.error('failed to send message to kafka proxy' + e);
      return res.status(500).send(e);
    });
});

export default router;
