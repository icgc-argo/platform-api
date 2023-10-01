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

/* *******
 * This file is a continuation of clinical/index.js but with new additions written in TS.
 * Eventually the full contents of clinical/index should be moved here with proper typing.
 * ******* */

import fetch from 'node-fetch';
import urlJoin from 'url-join';

import { CONTENTTYPE_JSON, HEADER_CONTENTTYPE } from 'constants/http';
import { EgoAuthClient } from 'services/ego/authClient';
import { CLINICAL_SERVICE_ROOT } from 'config';

export const ClinicalCompletionStates = {
	ALL: 'all',
	INVALID: 'invalid',
	COMPLETE: 'complete',
	INCOMPLETE: 'incomplete',
};

export const downloadDonorTsv = async (authClient: EgoAuthClient, donorIds: string[]) => {
	// Set the page size to include every donoId here, so we get a zip with all requested donors.

	const url = urlJoin(CLINICAL_SERVICE_ROOT, `/clinical/donors/tsv`);

	const authToken = await authClient.getAuth();

	const donorIdNumbers = donorIds.map((donorId) => Number(donorId.replace(/^DO/, '')));

	const response = await fetch(url, {
		method: 'post',
		headers: { Authorization: `Bearer ${authToken}`, [HEADER_CONTENTTYPE]: CONTENTTYPE_JSON },
		body: JSON.stringify({
			donorIds: donorIdNumbers,
		}),
	}).then((data) => data.buffer());

	// This returns an object to download, so don't return the body as text or json

	return response;
};
