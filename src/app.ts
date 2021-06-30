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

import express, { Request } from 'express';
import cors from 'cors';
import { mergeSchemas } from 'graphql-tools';
import expressWinston from 'express-winston';
import userSchema from './schemas/User';
import programSchema from './schemas/Program';
import path from 'path';
import clinicalProxyRoute from './routes/clinical-proxy';
import createKafkaRouter from './routes/kafka-rest-proxy';
import createDonorAggregatorRouter from 'routes/donor-aggregator-api';
import createFileStorageApi from './routes/file-storage-api';
import {
  PORT,
  NODE_ENV,
  APP_DIR,
  ARRANGER_PROJECT_ID,
  FEATURE_ARRANGER_SCHEMA_ENABLED,
  FEATURE_STORAGE_API_ENABLED,
  EGO_VAULT_SECRET_PATH,
  USE_VAULT,
  EGO_CLIENT_SECRET,
  EGO_CLIENT_ID,
  ELASTICSEARCH_VAULT_SECRET_PATH,
  ELASTICSEARCH_USERNAME,
  ELASTICSEARCH_PASSWORD,
} from './config';
import systemAlertSchema from './schemas/SystemAlert';
import clinicalSchema from './schemas/Clinical';
import createHelpdeskSchema from './schemas/Helpdesk';

import ProgramDashboardSummarySchema from './schemas/ProgramDonorSummary';
import ProgramDonorPublishedAnalysisByDateRangeSchema from './schemas/ProgramDonorPublishedAnalysisByDateRange';
import logger, { loggerConfig } from './utils/logger';
import getArrangerGqlSchema, { ArrangerGqlContext } from 'schemas/Arranger';
import { createEsClient, EsSecret } from 'services/elasticsearch';
import createFileCentricTsvRoute from 'routes/file-centric-tsv';
import ArgoApolloServer from 'utils/ArgoApolloServer';
import apiDocRouter from 'routes/api-docs';
import createEgoClient, { EgoApplicationCredential } from 'services/ego';
import { loadVaultSecret } from 'services/vault';
import egoTokenUtils from 'utils/egoTokenUtils';
import { EgoJwtData } from '@icgc-argo/ego-token-utils/dist/common';

const config = require(path.join(APP_DIR, '../package.json'));
const { version } = config;

export type GlobalGqlContext = {
  isUserRequest: boolean;
  egoToken: string;
  Authorization: string;
  userJwtData: EgoJwtData | null;
  dataLoaders: {};
};

const init = async () => {
  const vaultSecretLoader = await loadVaultSecret();

  const [egoAppCredentials, elasticsearchCredentials] = USE_VAULT
    ? ((await Promise.all([
        vaultSecretLoader(EGO_VAULT_SECRET_PATH).catch((err: any) => {
          logger.error(`could not read Ego secret at path ${EGO_VAULT_SECRET_PATH}`);
          throw err; //fail fast
        }),
        vaultSecretLoader(ELASTICSEARCH_VAULT_SECRET_PATH).catch((err: any) => {
          logger.error(`could not read Elasticsearch secret at path ${EGO_VAULT_SECRET_PATH}`);
          throw err; //fail fastw
        }),
      ])) as [EgoApplicationCredential, EsSecret])
    : ([
        {
          clientId: EGO_CLIENT_ID,
          clientSecret: EGO_CLIENT_SECRET,
        },
        {
          user: ELASTICSEARCH_USERNAME,
          pass: ELASTICSEARCH_PASSWORD,
        },
      ] as [EgoApplicationCredential, EsSecret]);

  const esClient = await createEsClient({
    auth:
      elasticsearchCredentials.user && elasticsearchCredentials.pass
        ? elasticsearchCredentials
        : undefined,
  });
  const egoClient = createEgoClient(egoAppCredentials);

  const schemas = await Promise.all([
    userSchema(egoClient),
    programSchema,
    clinicalSchema,
    systemAlertSchema,
    ProgramDashboardSummarySchema(esClient),
    ProgramDonorPublishedAnalysisByDateRangeSchema(esClient),
    createHelpdeskSchema(),
    ...(FEATURE_ARRANGER_SCHEMA_ENABLED ? [getArrangerGqlSchema(esClient)] : []),
  ]);

  const server = new ArgoApolloServer({
    // @ts-ignore ApolloServer type is missing this for some reason
    schema: mergeSchemas({
      schemas,
    }),
    context: ({ req }: { req: Request }): GlobalGqlContext & ArrangerGqlContext => {
      const authHeader = req.headers.authorization;
      let userJwtData: EgoJwtData | null = null;
      try {
        if (authHeader) {
          const jwt = authHeader.replace('Bearer ', '');
          userJwtData = egoTokenUtils.decodeToken(jwt);
        }
      } catch (err) {
        userJwtData = null;
      }
      return {
        isUserRequest: true,
        egoToken: (authHeader || '').split('Bearer ').join(''),
        Authorization: `Bearer ${(authHeader || '').replace(/^Bearer[\s]*/, '')}` || '',
        dataLoaders: {},
        userJwtData,
        es: esClient, // for arranger only
        projectId: ARRANGER_PROJECT_ID, // for arranger only
      };
    },
    introspection: true,
    tracing: NODE_ENV !== 'production',
  });

  const app = express();
  app.use(cors());
  app.use(expressWinston.logger(loggerConfig));
  server.applyMiddleware({ app, path: '/graphql' });
  app.get('/status', (req, res) => {
    res.json(version);
  });

  app.use('/kafka', createKafkaRouter(egoClient));
  app.use('/clinical', clinicalProxyRoute);
  app.use('/file-centric-tsv', await createFileCentricTsvRoute(esClient, egoClient));
  app.use('/donor-aggregator', createDonorAggregatorRouter(egoClient));

  if (FEATURE_STORAGE_API_ENABLED) {
    const rdpcRepoProxyPath = '/storage-api';
    app.use(
      rdpcRepoProxyPath,
      createFileStorageApi({
        rootPath: rdpcRepoProxyPath,
        esClient,
        egoClient,
      }),
    );
  }

  app.use('/api-docs', apiDocRouter());

  app.listen(PORT, () => {
    // @ts-ignore ApolloServer type is missing graphqlPath for some reason
    logger.info(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    logger.info(`🚀 Rest API doc available at http://localhost:${PORT}/api-docs`);
  });
};

export default init;
