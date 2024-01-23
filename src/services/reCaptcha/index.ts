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

import fetch from 'node-fetch';

import { DEV_RECAPTCHA_DISABLED, RECAPTCHA_SECRET_KEY, RECAPTCHA_VAULT_SECRET_PATH, USE_VAULT } from '@/config';
import { loadVaultSecret } from 'services/vault';
import logger from 'utils/logger';

type ReCaptchaVerificationErrorCode =
	| 'missing-input-secret'
	| 'invalid-input-secret'
	| 'missing-input-response'
	| 'invalid-input-response'
	| 'bad-request'
	| 'timeout-or-duplicate';
type ReCaptchaVerificationResult = {
	// modeled after https://developers.google.com/recaptcha/docs/verify
	success: boolean;
	challenge_ts?: string;
	hostname?: string;
	'error-codes'?: Array<ReCaptchaVerificationErrorCode>;
};
type ReCaptchaVaultSecret = {
	secret_key: string;
};
export type ReCaptchaClient = {
	verifyUserResponse: (response: string) => Promise<ReCaptchaVerificationResult>;
};

const isReCaptchaSecretData = (data: { [k: string]: unknown }): data is ReCaptchaVaultSecret => {
	return typeof data['secret_key'] === 'string';
};

const getReCaptchaSecret = async () => {
	let secret: string;
	if (USE_VAULT) {
		const vaultData = await loadVaultSecret()(RECAPTCHA_VAULT_SECRET_PATH);
		if (isReCaptchaSecretData(vaultData)) {
			secret = vaultData.secret_key;
		} else {
			throw new Error('invalid reCaptcha secret retrieved from vault');
		}
	} else {
		secret = RECAPTCHA_SECRET_KEY;
	}
	return secret;
};

const createReCaptchaClient = async (): Promise<ReCaptchaClient> => {
	logger.info('Attempting to create a ReCaptcha Client');

	const reCaptchaSecretKey = await getReCaptchaSecret();

	const verifyUserResponse = async (response: string) =>
		fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${reCaptchaSecretKey}&response=${response}`, {
			method: 'POST',
		}).then((res): Promise<ReCaptchaVerificationResult> => res?.json?.());

	logger.info('...verifying reCaptcha secret');

	const testVerificationResponse = await verifyUserResponse('');
	const verificationErrorCodes = testVerificationResponse['error-codes'];

	if (verificationErrorCodes?.some((error) => ['invalid-input-secret', 'missing-input-secret'].includes(error))) {
		throw new Error(
			'Failed to initialize ReCaptcha client, missing or invalid secret key. For local development, provide a reCaptcha secret key through the RECAPTCHA_SECRET_KEY env var. Contact your admin for a secret, or create your own through Google for local dev.',
		);
	}

	logger.info('Successfully created reCaptcha client');

	return {
		verifyUserResponse,
	};
};

export const createStubReCaptchaClient = async (): Promise<ReCaptchaClient> => {
	DEV_RECAPTCHA_DISABLED && logger.debug('using a stub recaptcha client');

	return Promise.resolve({
		verifyUserResponse: () => {
			return Promise.resolve({
				success: true,
			});
		},
	});
};

export default createReCaptchaClient;
