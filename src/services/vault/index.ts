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

import vault, { VaultOptions } from 'node-vault';
import { VAULT_URL, VAULT_ROLE, VAULT_TOKEN, VAULT_AUTH_METHOD } from 'config';
import { promises } from 'fs';
import memoize from 'lodash/memoize';
import logger from 'utils/logger';

/**
 * Memoized client factory for a singleton Vault client
 */
export const createVaultClient = memoize(async (vaultOptions: VaultOptions = {}) => {
	const options: VaultOptions = {
		apiVersion: 'v1',
		endpoint: VAULT_URL,
		token: VAULT_TOKEN,
		...vaultOptions,
	};
	const vaultClient = vault(options);

	if (VAULT_AUTH_METHOD === 'kubernetes') {
		const k8Token =
			VAULT_TOKEN ||
			(await promises.readFile('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf-8'));
		await vaultClient.kubernetesLogin({
			role: VAULT_ROLE,
			jwt: k8Token,
		});
	}
	return vaultClient;
});

export const loadVaultSecret =
	(vaultClient: ReturnType<typeof createVaultClient> = createVaultClient()) =>
	async (path: string) => {
		const result = await (await vaultClient).read(path);
		const secretData = result.data as { [k: string]: any };
		logger.info(`Loaded Vault secret at ${path}: ${Object.keys(secretData)}`);
		return secretData;
	};
