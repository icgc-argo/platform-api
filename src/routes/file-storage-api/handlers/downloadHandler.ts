/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

import { Client } from '@elastic/elasticsearch';
import { Handler, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { get } from 'lodash';
import fetch from 'node-fetch';

import { MAX_FILE_DOWNLOAD_SIZE } from 'config';
import { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import {
	hasSufficientDacoAccess,
	hasSufficientProgramMembershipAccess,
} from 'routes/utils/accessValidations';
import { getDataCenter } from 'services/dataCenterRegistry';
import { EgoAuthClient } from 'services/ego/authClient';
import logger from 'utils/logger';

import { getEsFileDocumentByObjectId } from '../utils';

const normalizePath = (rootPath: string) => (pathName: string) =>
	pathName.replace(rootPath, '').replace('//', '/');

const downloadHandler =
	({
		rootPath,
		esClient,
		scoreAuthClient,
		proxyMiddlewareFactory = createProxyMiddleware,
	}: {
		rootPath: string;
		esClient: Client;
		scoreAuthClient: EgoAuthClient;
		proxyMiddlewareFactory: typeof createProxyMiddleware;
	}): Handler =>
	async (req: AuthenticatedRequest, res, next) => {
		const { fileObjectId } = req.params;
		const esFileObject = await getEsFileDocumentByObjectId(esClient)(fileObjectId);

		if (!esFileObject) {
			return res.status(404).end();
		}

		const isAuthorized =
			hasSufficientProgramMembershipAccess({
				scopes: req.auth.scopes,
				file: esFileObject,
			}) &&
			hasSufficientDacoAccess({
				scopes: req.auth.scopes,
				file: esFileObject,
			});

		if (isAuthorized) {
			const repositoryCode = esFileObject.repositories[0].code;
			const dataCenter = await getDataCenter(repositoryCode);
			const scoreProxyJwt = await scoreAuthClient.getAuth();

			if (dataCenter) {
				const scoreUrl = dataCenter.scoreUrl;
				const handleRequest = proxyMiddlewareFactory({
					target: scoreUrl,
					pathRewrite: normalizePath(rootPath),
					onError: (err: Error, req: Request, res: Response) => {
						logger.error('Score Router Error - ' + err);
						return res.status(500).end();
					},
					headers: {
						Authorization: `Bearer ${scoreProxyJwt}`,
					},
					changeOrigin: true,
				});
				handleRequest(req, res, next);
			} else {
				res.status(500).json({ error: 'File repository unavailable' }).end();
			}
		} else {
			if (req.auth.authenticated) {
				// token is valid but permissions are not sufficient
				res.status(403).send('Not authorized to access the requested data').end();
			} else {
				// token was invalid
				res.status(401).send('Invalid access token').end();
			}
		}
	};
export const downloadFile =
	({ esClient, scoreAuthClient }: { esClient: Client; scoreAuthClient: EgoAuthClient }): Handler =>
	async (req: AuthenticatedRequest, res) => {
		const { fileObjectId } = req.params;
		const esFileObject = await getEsFileDocumentByObjectId(esClient)(fileObjectId);

		if (!esFileObject) {
			return res.status(404).end();
		}

		const fileSize = esFileObject.file.size;

		if (fileSize > MAX_FILE_DOWNLOAD_SIZE) {
			return res
				.status(400)
				.send('File is too large to download over UI. Please use the SCORE client instead')
				.end();
		}

		// open access files don't require authentication or DACO access
		const isAuthorized =
			esFileObject.file_access === 'open' ||
			(hasSufficientProgramMembershipAccess({
				scopes: req.auth.scopes,
				file: esFileObject,
			}) &&
				hasSufficientDacoAccess({
					scopes: req.auth.scopes,
					file: esFileObject,
				}));

		if (isAuthorized) {
			const repositoryCode = esFileObject.repositories[0].code;
			const dataCenter = await getDataCenter(repositoryCode);
			const scoreProxyJwt = await scoreAuthClient.getAuth();

			if (dataCenter) {
				const scoreUrl = `${dataCenter.scoreUrl}/download/${fileObjectId}?offset=0&length=${fileSize}&external=true`;
				const scoreResponse = await fetch(scoreUrl, {
					headers: {
						Authorization: `Bearer ${scoreProxyJwt}`,
					},
				})
					.then((response) => response.json())
					.catch((err) => {
						logger.error('Score Router Error - ' + err);
						return res.status(500).end();
					});

				const scoreDownloadUrl = get(scoreResponse, 'parts[0].url', undefined);

				if (!scoreDownloadUrl) {
					// if we get here, the score response didn't contain a download url
					return res.status(404).end();
				}

				// download file from score and return it to the client with the correct filename
				await fetch(scoreDownloadUrl)
					.then((response) => {
						if (!response.body) throw 'response body is undefined';

						res.header('Content-Disposition', `attachment; filename="${esFileObject.file.name}"`);

						response.body.pipe(res);

						response.body.on('error', (err) => {
							logger.error('Error piping file from Score - ' + err);
							return res.status(500).end();
						});
					})
					.catch((err) => {
						logger.error('Score Download Error - ' + err);
						return res.status(500).end();
					});
			} else {
				res.status(500).json({ error: 'File repository unavailable' }).end();
			}
		} else {
			if (req.auth.authenticated) {
				// token is valid but permissions are not sufficient
				res.status(403).send('Not authorized to access the requested data').end();
			} else {
				// token was invalid
				res.status(401).send('Invalid access token').end();
			}
		}
	};

export default downloadHandler;
