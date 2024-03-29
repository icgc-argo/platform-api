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

import memoize from 'lodash/memoize';
import fetch from 'node-fetch';
import urlJoin from 'url-join';

import { EGO_DACO_POLICY_NAME, EGO_ROOT_REST } from '../../config';
import logger from '../../utils/logger';
import { restErrorResponseHandler } from '../../utils/restUtils';

export type EgoApplicationCredential = {
	clientId: string;
	clientSecret: string;
};

type EgoAccessToken = {
	access_token: string;
	token_type: string;
	expires_in: number;
	scope: string;
	groups: string;
};

type EgoAccessTokenError = {
	error: string;
	error_description: string;
};

interface APIKeyResp {
	client_id: string;
	exp: number;
	scope: string[];
	user_id: string;
}

const createEgoClient = (applicationCredential: EgoApplicationCredential) => {
	const appCredentialBase64 = Buffer.from(
		`${applicationCredential.clientId}:${applicationCredential.clientSecret}`,
	).toString('base64');

	const EGO_API_KEY_ENDPOINT = urlJoin(EGO_ROOT_REST, '/o/api_key');

	let memoizedGetDacoIds: ReturnType<typeof getMemoizedDacoIds> | null = null;
	let dacoIdsCalled = new Date();
	const dacoGroupIdExpiry = 86400000; // 24hours

	type EgoAccessKeyObj = {
		name: string;
		expiryDate: string;
		description: string;
		scope: string[];
		isRevoked: boolean;
		issueDate: string;
	};

	const getEgoAccessKeys = async (userId: string, Authorization: string): Promise<EgoAccessKeyObj[]> => {
		const firstResponse = await fetch(urlJoin(EGO_API_KEY_ENDPOINT, `?user_id=${userId}`), {
			headers: { Authorization },
		})
			.then(restErrorResponseHandler)
			.then((response) => response.json());
		const totalCount = firstResponse.count;
		const firstResults = firstResponse.resultSet;
		const remainingPageIndex = firstResults.length;
		const remainingResponse = await fetch(
			urlJoin(
				EGO_API_KEY_ENDPOINT,
				`?user_id=${userId}&limit=${totalCount - remainingPageIndex}&offset=${remainingPageIndex}`,
			),
			{
				headers: { Authorization },
			},
		)
			.then(restErrorResponseHandler)
			.then((response) => response.json());

		const remainingResults = remainingResponse.resultSet;

		return [...firstResults, ...remainingResults].filter(({ isRevoked }) => !isRevoked);
	};

	const generateEgoAccessKey = async (
		userId: string,
		scopes: string[],
		Authorization: string,
	): Promise<EgoAccessKeyObj> => {
		const url = urlJoin(EGO_API_KEY_ENDPOINT, `?user_id=${userId}&scopes=${encodeURIComponent(scopes.join())}`);
		const response = await fetch(url, {
			method: 'POST',
			headers: { Authorization },
		})
			.then(restErrorResponseHandler)
			.then((response) => response.json());
		return response;
	};

	const getScopes = async (userId: string, Authorization: string): Promise<{ scopes: string[] }> => {
		const url = `${EGO_ROOT_REST}/o/scopes?userId=${userId}`;
		const response = await fetch(url, {
			method: 'get',
			headers: { Authorization },
		})
			.then(restErrorResponseHandler)
			.then((response) => response.json());
		return response;
	};

	const deleteKeys = async (
		keys: EgoAccessKeyObj[],
		Authorization: string,
	): Promise<{ key: string; success: boolean }[] | null> => {
		const accessKeys = keys.map((k) => k.name);
		const ps = await Promise.all(
			accessKeys.map(async (key) => {
				const url = urlJoin(EGO_API_KEY_ENDPOINT, `?apiKey=${encodeURIComponent(key)}`);
				return fetch(url, {
					method: 'delete',
					headers: { Authorization },
				})
					.then((_) => ({ key, success: true }))
					.catch((err) => {
						logger.error(err);
						return { key, success: false };
					});
			}),
		);
		return ps;
	};

	// check for new group id over 24hours otherwise use memo func
	const getDacoIds = (userId: string, Authorization: string) => {
		const checkIdExpiry = Number(new Date()) - Number(dacoIdsCalled) >= dacoGroupIdExpiry;
		if (!memoizedGetDacoIds || checkIdExpiry) {
			memoizedGetDacoIds = getMemoizedDacoIds();
			dacoIdsCalled = new Date();
		}

		return memoizedGetDacoIds(userId, Authorization);
	};

	const getMemoizedDacoIds = () =>
		memoize(async (userId, Authorization) => {
			const queryUrl = `${EGO_ROOT_REST}/groups?query=`;
			const dacoQueryUrl = queryUrl + 'daco';

			// query param will search descriptions too, so filter on name also
			const response = await fetch(dacoQueryUrl, {
				method: 'get',
				headers: { Authorization },
			})
				.then(
					(resp) =>
						resp.json() as Promise<{
							resultSet: { name: string; id: string }[];
						}>,
				)
				.then(({ resultSet = [] }) => resultSet.filter((data) => data.name === EGO_DACO_POLICY_NAME))
				.then((group) => {
					if (group.length === 0) {
						throw new Error('DACO group id not found');
					} else {
						return group[0].id;
					}
				})
				.catch((err) => {
					logger.error(err);
					return null;
				});
			return response;
		});

	const checkApiKey = ({ apiKey }: { apiKey: string }): Promise<APIKeyResp> =>
		fetch(`${EGO_ROOT_REST}/o/check_api_key?apiKey=${apiKey}`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				Authorization: `Basic ${appCredentialBase64}`,
			},
		}).then((res) => res.json() as Promise<APIKeyResp>);

	const toTimestamp = (str: string) => Math.round(new Date(str).getTime() / 1000);

	const getTimeToExpiry = (accessKeyObj: EgoAccessKeyObj): number => {
		return toTimestamp(accessKeyObj.expiryDate) - Math.round(Date.now() / 1000);
	};

	const isAuthError = (resp: EgoAccessToken | EgoAccessTokenError): resp is EgoAccessTokenError =>
		(resp as EgoAccessTokenError).error !== undefined;

	const getApplicationJwt = async (applicationCredentials: EgoApplicationCredential): Promise<string> => {
		const url = urlJoin(
			EGO_ROOT_REST,
			`/oauth/token?client_id=${applicationCredentials.clientId}&client_secret=${applicationCredentials.clientSecret}&grant_type=client_credentials`,
		);
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-type': 'application/json',
			},
		});
		const authResponse = await response.json();
		if (isAuthError(authResponse) && authResponse.error) {
			throw new Error(`Failed to authorize application: ${authResponse.error_description}`);
		}
		return (authResponse as EgoAccessToken).access_token;
	};

	return {
		generateEgoAccessKey,
		getScopes,
		getEgoAccessKeys,
		deleteKeys,
		getDacoIds,
		getTimeToExpiry,
		checkApiKey,
		getApplicationJwt,
	};
};

export type EgoClient = ReturnType<typeof createEgoClient>;

export default createEgoClient;
