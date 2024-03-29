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
import express, { Router } from 'express';
import { json } from 'body-parser';

import logger from 'utils/logger';

import { EgoClient } from 'services/ego';
import egoTokenUtils from 'utils/egoTokenUtils';
import getAuthorizedClient from 'services/donorAggregator';

import authenticatedRequestMiddleware, {
	AuthenticatedRequest,
} from 'routes/middleware/authenticatedRequestMiddleware';

const createDonorAggregatorRouter = (egoClient: EgoClient): Router => {
	const router = express.Router();

	router.use(json());
	router.use(authenticatedRequestMiddleware({ egoClient }));

	router.post('/sync', async (req: AuthenticatedRequest, res) => {
		// Ensure Authenticated and DCC Admin
		const { authenticated, serializedScopes, egoJwt } = req.auth;

		if (!authenticated) {
			res.status(401).json({ error: 'invalid auth token' });
			return;
		}

		if (!egoTokenUtils.isDccMember(serializedScopes)) {
			res.status(403).json({ error: 'not authorized' });
			return;
		}

		// Send request to Donor Aggregator
		const programId = req.body.programId;
		try {
			logger.info(`Initiating Donor Submission Aggregator SYNC request for ${programId}.`);
			await getAuthorizedClient(egoJwt).syncDonorAggregationIndex(programId);
		} catch (error) {
			logger.error(
				`Error requesting SYNC from Donor Submission Aggregator (${programId}): ${error}`,
			);
			res.status(500).json({ error: error.message });
			return;
		}

		res.status(200).json({
			message: 'Initiated sync for donor submission aggregation index.',
			programId,
		});
		return;
	});

	return router;
};

export default createDonorAggregatorRouter;
