/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { KAFKA_REST_PROXY_ROOT } from '../config';
import urlJoin from 'url-join';
import logger from '../utils/logger';
import fetch from 'node-fetch';
import { json } from 'body-parser';
import express, { Router } from 'express';
import { EgoClient } from 'services/ego';
import authenticatedRequestMiddleware, {
  AuthenticatedRequest,
} from 'routes/middleware/authenticatedRequestMiddleware';
import egoTokenUtils from 'utils/egoTokenUtils';

const createKafkaRouter = (egoClient: EgoClient): Router => {
  const router = express.Router();
  const apiRoot = KAFKA_REST_PROXY_ROOT;

  // fetch needs to use the json body parser
  // Kafka can accept message up to max 1mb in size, and there are examples of song sending messages larger than the default 100kb limit
  router.use(json({ limit: '1mb' }));

  router.use(authenticatedRequestMiddleware({ egoClient }));

  router.post('/:topic', async (req: AuthenticatedRequest, res) => {
    const {
      auth: { authenticated, serializedScopes, egoJwt },
      params: { topic },
    } = req;

    // Require auth
    if (!authenticated) {
      res.status(401).json({ error: 'invalid auth token' });
      return;
    }

    // Require kafka topic writing permisison
    const hasPermission = egoTokenUtils.canWriteKafkaTopic({
      permissions: serializedScopes,
      topic,
    });
    if (!hasPermission) {
      res.status(403).json({ error: 'not authorized' });
      return;
    }

    const url = urlJoin(apiRoot, 'topics', topic);
    const msg = req.body;
    logger.debug(`received message in kafka proxy ${JSON.stringify(msg)}`);
    const kafkaRestProxyBody = JSON.stringify({
      records: [
        {
          value: msg,
        },
      ],
    });
    await fetch(url, {
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
        response.body.pipe(res);
        return;
      })
      .catch(e => {
        logger.error('failed to send message to kafka proxy' + e);
        res.status(500).send(e);
        return;
      });
    return;
  });

  return router;
};

export default createKafkaRouter;
