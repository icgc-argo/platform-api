/*
 * Copyright (c) 2025 The Ontario Institute for Cancer Research. All rights reserved
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

import { DISCOVERY_ARRANGER_ROOT } from 'config';
import express, { Request, Response, Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { EgoClient } from 'services/ego';
import logger from 'utils/logger';
import authenticatedRequestMiddleware, { AuthenticatedRequest } from './middleware/authenticatedRequestMiddleware';
import { hasDacoAccess } from './utils/accessValidations';

export const createArrangerV3Route = (egoClient: EgoClient): Router => {
	const router = express.Router();

	router.use(authenticatedRequestMiddleware({ egoClient }));

	const handleRequest = createProxyMiddleware({
		target: DISCOVERY_ARRANGER_ROOT,
		onError: (err: Error, req: Request, res: Response) => {
			logger.error(`Arranger V3 error: + ${err}`);
			return res.status(500).send('Internal Server Error');
		},
		changeOrigin: true,
		onProxyReq: () => {
			logger.debug(`proxying request to ${DISCOVERY_ARRANGER_ROOT}`);
		},
	});

	router.all('/', (req: AuthenticatedRequest, res: Response, next) => {
		const { authenticated, scopes } = req.auth;

		if (!authenticated) {
			res.status(401).json({ error: 'invalid auth token' });
			return;
		}

		if (!hasDacoAccess(scopes)) {
			res.status(403).json({ error: 'not authorized' });
			return;
		}

		handleRequest(req, res, next);
	});

	return router;
};
