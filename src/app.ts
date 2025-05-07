/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import path from 'path';

import { EgoJwtData } from '@icgc-argo/ego-token-utils/dist/common';
import arrangerV3 from '@overture-stack/arranger-server';
import cors from 'cors';
import express, { Request } from 'express';
import { logger as loggerMiddleware } from 'express-winston';
import { mergeSchemas } from 'graphql-tools';

import apiDocRouter from 'routes/api-docs';
import createDonorAggregatorRouter from 'routes/donor-aggregator-api';
import createFileCentricTsvRoute from 'routes/file-centric-tsv';
import getArrangerGqlSchema, { ArrangerGqlContext } from 'schemas/Arranger';
import createEgoClient, { EgoApplicationCredential } from 'services/ego';
import { createEsClient, EsSecret } from 'services/elasticsearch';
import { loadVaultSecret } from 'services/vault';
import ArgoApolloServer from 'utils/ArgoApolloServer';
import egoTokenUtils from 'utils/egoTokenUtils';

import {
	APP_DIR,
	ARRANGER_PROJECT_ID,
	DEBUG_LOGGING,
	EGO_CLIENT_ID,
	EGO_CLIENT_SECRET,
	EGO_VAULT_SECRET_PATH,
	ELASTICSEARCH_HOST,
	ELASTICSEARCH_PASSWORD,
	ELASTICSEARCH_USERNAME,
	ELASTICSEARCH_VAULT_SECRET_PATH,
	FEATURE_STORAGE_API_ENABLED,
	HEALTH_ENDPOINTS,
	IS_PROD,
	PORT,
	USE_VAULT,
} from './config';
import createClinicalRouter from './routes/clinical';
import createFileStorageApi from './routes/file-storage-api';
import createKafkaRouter from './routes/kafka-rest-proxy';
import clinicalSchema from './schemas/Clinical';
import createHelpdeskSchema from './schemas/Helpdesk';
import programSchema from './schemas/Program';
import ProgramDonorPublishedAnalysisByDateRangeSchema from './schemas/ProgramDonorPublishedAnalysisByDateRange';
import ProgramDashboardSummarySchema from './schemas/ProgramDonorSummary';
import systemAlertSchema from './schemas/SystemAlert';
import userSchema from './schemas/User';
import logger, { loggerConfig } from './utils/logger';

const config = require(path.join(APP_DIR, '../package.json'));
const { version } = config;

export type GlobalGqlContext = {
	isUserRequest: boolean;
	egoToken: string;
	Authorization: string;
	userJwtData: EgoJwtData | null;
	dataLoaders: object;
};

const init = async () => {
	const vaultSecretLoader = await loadVaultSecret();

	const [egoAppCredentials, elasticsearchCredentials] = USE_VAULT
		? ((await Promise.all([
				vaultSecretLoader(EGO_VAULT_SECRET_PATH).catch((error) => {
					logger.error(`could not read Ego secret at path ${EGO_VAULT_SECRET_PATH}`);
					throw error; //fail fast
				}),
				vaultSecretLoader(ELASTICSEARCH_VAULT_SECRET_PATH).catch((error: any) => {
					logger.error(`could not read Elasticsearch secret at path ${EGO_VAULT_SECRET_PATH}`);
					throw error; //fail fastw
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

	const egoClient = createEgoClient(egoAppCredentials);
	const esClient = await createEsClient({
		auth: elasticsearchCredentials.user && elasticsearchCredentials.pass ? elasticsearchCredentials : undefined,
	});

	const schemas = await Promise.all(
		[
			userSchema(egoClient),
			programSchema,
			clinicalSchema,
			systemAlertSchema,
			ProgramDashboardSummarySchema(esClient),
			ProgramDonorPublishedAnalysisByDateRangeSchema(esClient),
			createHelpdeskSchema(),
			getArrangerGqlSchema(esClient),
		].filter(Boolean),
	);

	const server = new ArgoApolloServer({
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
		tracing: !IS_PROD,
	});

	const app = express();

	// Cors Config
	const corsOptions = {
		exposedHeaders: ['content-disposition'],
	};
	app.use(cors(corsOptions));

	const DEBUG = DEBUG_LOGGING || !IS_PROD;
	// Request Logging
	app.use(
		loggerMiddleware({
			...loggerConfig,
			ignoredRoutes: DEBUG ? [] : HEALTH_ENDPOINTS,
		}),
	);

	// Attach Arranger
	server.applyMiddleware({ app, path: '/graphql' });

	// Arranger v3 endpoint
	app.use(
		'/arranger-v3',
		await arrangerV3({
			enableLogs: true,
		}),
	);

	// Health Check / Status Endpoint
	app.get('/status', (req, res) => {
		res.json(version);
	});

	// Routers
	app.use('/kafka', createKafkaRouter(egoClient));
	app.use('/clinical', await createClinicalRouter(esClient, egoClient));
	app.use('/file-centric-tsv', await createFileCentricTsvRoute(esClient, egoClient));
	app.use('/donor-aggregator', createDonorAggregatorRouter(egoClient));

	if (FEATURE_STORAGE_API_ENABLED) {
		const rdpcRepoProxyPath = '/storage-api';
		app.use(
			rdpcRepoProxyPath,
			await createFileStorageApi({
				rootPath: rdpcRepoProxyPath,
				esClient,
				egoClient,
			}),
		);
	}

	app.use('/api-docs', apiDocRouter());

	app.listen(PORT, () => {
		console.log('\n');
		logger.info(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
		logger.info(`🚀 REST API docs available at http://localhost:${PORT}/api-docs`);
		console.log('\n');
	});
};

export default init;
