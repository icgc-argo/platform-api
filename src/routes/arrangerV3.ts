/*
 * Copyright (c) 2026 The Ontario Institute for Cancer Research. All rights reserved
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

import { gql } from 'apollo-server-express';
import { json } from 'body-parser';
import express, { Request, Response, Router, type RequestHandler } from 'express';
import { GraphQLError, type DocumentNode } from 'graphql';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

import { DISCOVERY_ARRANGER_ROOT } from 'config';
import { EgoClient } from 'services/ego';
import logger from 'utils/logger';

import { extractUserScopes } from './middleware/authenticatedRequestMiddleware';
import { hasDacoAccess } from './utils/accessValidations';

/**
 * Check if the contents of the document are exclusively a query introspecting the gql schema.
 *
 * An introspection query can only have OperationDefinitions with the name `__schema` or `__type`.
 * Top level FragmentDefintions are also allowed, and are ignored in this check.
 */
function isIntrospectionQuery(document: DocumentNode): boolean {
	const { definitions } = document;

	// Allow all FragmentDefinitions (will not be checked)
	const definitionsToCheck = definitions.filter((definition) => definition.kind !== 'FragmentDefinition');

	const ALLOWED_OPERATION_NAMES: string[] = ['__schema', '__type'];

	// Only allow query operation where all selections are from the ALLOWED_OPERATION_NAMES
	return definitionsToCheck.every(
		(definition) =>
			definition.kind === 'OperationDefinition' &&
			definition.operation === 'query' &&
			definition.selectionSet.selections.every(
				(selection) => selection.kind === 'Field' && ALLOWED_OPERATION_NAMES.includes(selection.name.value),
			),
	);
}

function getQueryDocument(body: any): { success: true; query: DocumentNode } | { success: false; error: object } {
	const query = body?.query;

	if (query) {
		try {
			const gqlQuery = gql`
				${query}
			`;
			return { success: true, query: gqlQuery };
		} catch (error: unknown) {
			// Could not parse incoming query as valid gql string
			const detailedError =
				error instanceof GraphQLError
					? {
							...error,
							message: error.message,
							locations: error.locations,
							path: error.path,
							extensions: error.extensions,
						}
					: error instanceof Error
						? { message: error.message }
						: { message: 'Syntax Error' };
			return { success: false, error: detailedError };
		}
	}
	return { success: false, error: { message: 'No request query provided.' } };
}

/**
 * Auth is always required, except for schema introspection queries.
 */
function isAuthRequired(query: DocumentNode): boolean {
	return !isIntrospectionQuery(query);
}

/**
 * Creates an express middleware to perform authorization for all discovery arranger requests.
 * This uses an ego client to validate user credentials, if required for the request.
 *
 * The auth check is not performed if the request is only for gql schema introspection details, but is
 * made for all other requests.
 *
 * When auth is required, the user must:
 *   - authenticated
 *   - have DACO approval
 */
const discoveryArrangerAuthMiddleware =
	(config: { egoClient: EgoClient }): RequestHandler =>
	async (req, res, next) => {
		const { egoClient } = config;

		const queryResult = getQueryDocument(req.body);
		if (!queryResult.success) {
			// Could not parse request body, respond with status 400 and the result error details
			return res.status(400).json(queryResult.error);
		}
		if (isAuthRequired(queryResult.query)) {
			console.log('auth required');
			const { authorization } = req.headers;
			const authParams = await extractUserScopes({
				egoClient,
				authHeader: authorization,
			});

			if (!authParams.authenticated) {
				return res.status(401).json({ error: 'invalid auth token' });
			}

			if (!hasDacoAccess(authParams.scopes)) {
				return res.status(403).json({ error: 'not authorized' });
			}
		}
		next();
	};

export const createArrangerV3Route = (egoClient: EgoClient): Router => {
	const router = express.Router();
	router.use(json());

	const discoveryArrangerProxy = createProxyMiddleware({
		target: DISCOVERY_ARRANGER_ROOT,
		onError: (err: Error, req: Request, res: Response) => {
			logger.error(`Arranger V3 error: + ${err}`);
			return res.status(500).send('Internal Server Error');
		},
		changeOrigin: true,
		onProxyReq: (proxyReq, req, _res) => {
			logger.debug(`proxying request to ${DISCOVERY_ARRANGER_ROOT}`);

			// Need to fix request body since we consumed the original stream while enforcing auth rules
			fixRequestBody(proxyReq, req);
		},
	});

	/**
	 * Use custom discoveryAuthMiddleware to protect the discovery arranger contents, but allow access to introspection queries.
	 */
	router.all('/', discoveryArrangerAuthMiddleware({ egoClient }), discoveryArrangerProxy);

	return router;
};
