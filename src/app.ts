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
import * as swaggerUi from 'swagger-ui-express';
import expressWinston from 'express-winston'
import yaml from 'yamljs';
import userSchema from './schemas/User';
import programSchema from './schemas/Program';
import path from 'path';
import clinicalProxyRoute from './routes/clinical-proxy';
import kafkaProxyRoute from './routes/kafka-rest-proxy';
import createFileStorageApi from './routes/file-storage-api';
import {
  PORT,
  NODE_ENV,
  APP_DIR,
  ARRANGER_PROJECT_ID,
  FEATURE_ARRANGER_SCHEMA_ENABLED,
} from './config';
import clinicalSchema from './schemas/Clinical';
import createHelpdeskSchema from './schemas/Helpdesk';

import ProgramDashboardSummarySchema from './schemas/ProgramDonorSummary';
import logger, { loggerConfig } from './utils/logger';
import getArrangerGqlSchema, { ArrangerGqlContext } from 'schemas/Arranger';
import { createEsClient } from 'services/elasticsearch';
import createFileCentricTsvRoute from 'routes/file-centric-tsv';
import ArgoApolloServer from 'utils/ArgoApolloServer';

const config = require(path.join(APP_DIR, '../package.json'));
const { version } = config;

export type GlobalGqlContext = {
  isUserRequest: boolean;
  egoToken: string;
  Authorization: string;
  dataLoaders: {};
};

const init = async () => {
  const esClient = await createEsClient();
  
  const schemas = await Promise.all([
    userSchema,
    programSchema,
    clinicalSchema,
    ProgramDashboardSummarySchema(esClient), 
    createHelpdeskSchema(), 
    ...(FEATURE_ARRANGER_SCHEMA_ENABLED ? [getArrangerGqlSchema(esClient)] : [])
  ])

  const server = new ArgoApolloServer({
    // @ts-ignore ApolloServer type is missing this for some reason
    schema: mergeSchemas({
      schemas,
    }),
    context: ({ req }: {req: Request}): GlobalGqlContext & ArrangerGqlContext => ({
      isUserRequest: true,
      egoToken: (req.headers?.authorization || '').split('Bearer ').join(''),
      Authorization:
        `Bearer ${(req.headers?.authorization || '').replace(/^Bearer[\s]*/, '')}` || '',
      dataLoaders: {},
      es: esClient, // for arranger only
      projectId: ARRANGER_PROJECT_ID, // for arranger only
    }),
    introspection: true,
    tracing: NODE_ENV !== 'production',
  });

  const app = express();
  app.use(cors());
  app.use(expressWinston.logger(loggerConfig))
  server.applyMiddleware({ app, path: '/graphql' });
  app.get('/status', (req, res) => {
    res.json(version);
  });

  app.use('/kafka', kafkaProxyRoute);
  app.use('/clinical', clinicalProxyRoute);
  app.use('/file-centric-tsv', await createFileCentricTsvRoute(esClient))

  const rdpcRepoProxyPath = '/file_storage_api'
  app.use(rdpcRepoProxyPath, createFileStorageApi({
    rootPath: rdpcRepoProxyPath,
    esClient,
  }))

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(yaml.load(path.join(__dirname, './resources/swagger.yaml'))),
  );

  app.listen(PORT, () =>  {
    // @ts-ignore ApolloServer type is missing graphqlPath for some reason
    logger.info(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    logger.info(`🚀 Rest API doc available at http://localhost:${PORT}/api-docs`);
  });
};

export default init;
