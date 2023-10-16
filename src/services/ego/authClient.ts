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

import { USE_VAULT } from 'config';
import { loadVaultSecret } from 'services/vault';
import egoTokenUtils from 'utils/egoTokenUtils';

import logger from '../../utils/logger';

import { EgoApplicationCredential, EgoClient } from '.';

export type EgoAuthClient = {
	getAuth: () => Promise<string>;
};

/**
 * Ego Credentials can be configured through environment variables or to be read in from Vault.
 * This function will call Vault if configured or fallback to use the provided env variables if Vault use is not configured.
 *
 * Provide the env variables for the vault secret path and clientId and clientSecret fallbacks.
 * @param config
 * @returns
 */
export const initializeEgoCredentials = async (config: {
	vaultSecretPath?: string;
	clientId?: string;
	clientSecret?: string;
}): Promise<EgoApplicationCredential> => {
	if (USE_VAULT && config.vaultSecretPath) {
		const vaultSecretLoader = await loadVaultSecret();
		const values = await vaultSecretLoader(config.vaultSecretPath).catch((err: any) => {
			logger.error(
				`Initializing egoAuthClient, Could not read Vault secret at path ${config.vaultSecretPath}`,
			);
			throw err; //fail fast
		});

		if (
			'clientId' in values &&
			typeof values.clientId === 'string' &&
			'clientSecret' in values &&
			typeof values.clientSecret === 'string'
		) {
			return { clientId: values.clientId, clientSecret: values.clientSecret };
		} else {
			const errorMessage = `Failed to initialize egoAuthClient, values retrieved from Vault secret path ${config.vaultSecretPath} are missing or not named correctly.`;
			logger.error(errorMessage);
			throw new Error(errorMessage);
		}
	}

	return { clientId: config.clientId || '', clientSecret: config.clientSecret || '' };
};

/**
 * This will create an object that can fetch the access token for an application that needs permissions to access another api.
 *  It will store access tokens so that only one is kept at a time, and will not attempt to fetch another until the stored token expires.
 * @param egoClient
 * @param authCredentials
 * @returns
 */
export const createAuthClient = async (
	egoClient: EgoClient,
	authCredentials: EgoApplicationCredential,
	name: string,
) => {
	/**
	 * Internal Closure Data
	 * */

	let latestJwt: string;

	/**
	 * Returned Methods
	 * */

	const getAuth = async () => {
		if (latestJwt && egoTokenUtils.isValidJwt(latestJwt)) {
			return latestJwt;
		}
		logger.debug(`Fetching new Ego auth token for '${name}'...`);
		latestJwt = await egoClient.getApplicationJwt(authCredentials);
		return latestJwt;
	};

	return {
		getAuth,
	};
};
