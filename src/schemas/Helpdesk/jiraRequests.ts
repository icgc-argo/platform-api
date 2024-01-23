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

import { UserInputError } from 'apollo-server-express';
import fetch from 'node-fetch';
import urlJoin from 'url-join';

import {
	JIRA_ADMIN_VAULT_CREDENTIALS_PATH,
	JIRA_ORGANIZATION_ID,
	JIRA_PERSONAL_ACCESS_TOKEN,
	JIRA_REST_URI,
	JIRA_SERVICEDESK_ID,
	USE_VAULT,
} from '@/config';
import { loadVaultSecret } from '@/services/vault';
import logger from '@/utils/logger';
import { restErrorResponseHandler } from '@/utils/restUtils';

/**
 * to ensure user credentials work, test a simple request and process the response
 **/
const validateAuthToken = (bearerToken = '') =>
	fetch(urlJoin(JIRA_REST_URI, 'request'), {
		method: 'get',
		headers: {
			Authorization: bearerToken,
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
	})
		.then(restErrorResponseHandler)
		.then(async (response) => {
			const responseJson = await response.json();
			logger.debug(`response: ${JSON.stringify(responseJson)}`);

			logger.info(`Successfully obtained and tested credentials for JIRA Service Desk API `);

			return true;
		})
		.catch((error) => {
			logger.error(`Failed to make a request to JIRA using the authentication details provided`);

			logger.error(error);
		});

/**
 * Obtains and tests the Jira Admin Personal Access Token
 * @returns the validated Bearer token string
 */
const getJiraAuthToken = async (): Promise<string | undefined> => {
	/* JIRA API "basic auth" is disabled by ResIT
	 * Login details remain in Vault, used to renew the token yearly,
	 * and the expiration date is also logged in the Vault secret.
	 */
	try {
		const bearerTokenPrefix = 'Bearer ';

		if (USE_VAULT) {
			const secretData = await loadVaultSecret()(JIRA_ADMIN_VAULT_CREDENTIALS_PATH).catch((error) => {
				logger.error(`could not read Jira Credentials secret at path ${JIRA_ADMIN_VAULT_CREDENTIALS_PATH}`);

				throw error;
			});

			if (secretData?.token?.length > 0) {
				const bearerToken = bearerTokenPrefix + secretData.token;

				if (await validateAuthToken(bearerToken)) {
					return bearerToken;
				}
			} else {
				throw new Error(`Vault secret at ${JIRA_ADMIN_VAULT_CREDENTIALS_PATH} did not provide a token`);
			}
		} else if (JIRA_PERSONAL_ACCESS_TOKEN) {
			const bearerToken = bearerTokenPrefix + JIRA_PERSONAL_ACCESS_TOKEN;

			if (await validateAuthToken(bearerToken)) {
				return bearerToken;
			}
		}

		logger.debug('No valid auth token provided');
	} catch (error) {
		logger.debug(error);

		return;
	}
};

export type JiraClient = {
	createServiceRequest: (
		customerIdentifier: string,
		requestTypeId: string,
		requestText: string,
		summaryPrependText: string,
	) => Promise<any>;
	createCustomer: (email: string, displayName: string) => Promise<any>;
};

// these types only include relevant fields
type OrganizationCustomer = {
	accountId: string;
	emailAddress: string;
	displayName: string;
};

type ErrorBody = {
	i18nErrorMessage: {
		parameters: Array<string>;
	};
};

/**
 * Gets a customer's account id via an email search within a customer organization.
 *
 * Requires a customer organization.
 */
const getAccountIdPre = (requestHeaders: Record<string, string>) => async (emailAddress: string) => {
	const url = `${JIRA_REST_URI}/organization/${JIRA_ORGANIZATION_ID}/user`;

	type ResponseBody = {
		values: Array<OrganizationCustomer>;
	};
	const response = (await fetch(url, {
		method: 'get',
		headers: requestHeaders,
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())) as ResponseBody;

	const id = response.values.find((customer) => customer.emailAddress === emailAddress.toLowerCase())?.accountId;

	if (id) {
		return id;
	}

	throw new UserInputError(
		'An existing customer with a duplicate email was detected, but an error occurred when retreiving their ID',
	);
};

/**
 * Adds a customer to an organization for future reference.
 *
 * Requires a customer organization.
 */
const addCustomerToOrganizationPre = (requestHeaders: Record<string, string>) => async (accountId: string) => {
	const url = `${JIRA_REST_URI}/organization/${JIRA_ORGANIZATION_ID}/user`;

	const bodyData = JSON.stringify({ accountIds: [accountId] });

	const response = await fetch(url, {
		method: 'post',
		headers: requestHeaders,
		body: bodyData,
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json());

	return response;
};

export const createJiraClient = async (): Promise<JiraClient> => {
	const authToken = await getJiraAuthToken();

	if (authToken) {
		const requestHeaders = {
			Authorization: authToken,
			Accept: 'application/json',
			'Content-Type': 'application/json',
		};

		const EMAIL_ALREADY_EXISTS_MESSAGE = 'email: An account already exists for this email';
		const getAccountId = getAccountIdPre(requestHeaders);
		const addCustomerToOrganization = addCustomerToOrganizationPre(requestHeaders);

		return {
			/**
			 * Creates a service request using the admin credentials, on behalf of a customer.
			 * @param customerIdentifier An email address, or an accountid
			 * @param requestTypeId The designated id associated with the request, set from Jira's end
			 * @param requestText What goes in the description box
			 * @param summaryPrependText Text that prepends the summary so the tickets can be easily discerned
			 * @returns The json body from the request
			 */
			createServiceRequest: async (
				customerIdentifier: string,
				requestTypeId: string,
				requestText: string,
				summaryPrependText: string,
			) => {
				const url = `${JIRA_REST_URI}/request`;

				const characterLimit = 60;
				const summaryText =
					requestText.length > characterLimit ? `${requestText.substring(0, characterLimit)}...` : requestText;

				// summary is a required field, that cannot accept newlines
				const request = {
					raiseOnBehalfOf: customerIdentifier,
					serviceDeskId: JIRA_SERVICEDESK_ID,
					requestTypeId: requestTypeId,
					requestFieldValues: {
						summary: `${summaryPrependText}: ${summaryText.replace(/(\r\n|\n|\r)/gm, '')}`,
						description: requestText,
					},
				};
				const bodyData = JSON.stringify(request);

				const response = await fetch(url, {
					method: 'post',
					headers: requestHeaders,
					body: bodyData,
				})
					.then(restErrorResponseHandler)

					.then(async (response) => {
						return response.json();
					});

				return response;
			},
			/**
			 * Creates a customer and returns their account ID, an alternate customer identifier to just an email. This method will show the customer name by default.
			 *
			 * This method requires that a customer organization within the service desk is created, and relies on the organization's id!
			 * @returns the accountid of the customer
			 */
			createCustomer: async (email: string, displayName: string) => {
				const url = `${JIRA_REST_URI}/customer`;

				const bodyData = JSON.stringify({
					displayName: displayName,
					email: email,
				});

				const response = await fetch(url, {
					method: 'post',
					headers: requestHeaders,
					body: bodyData,
				}).then(async (response) => {
					if (response.status === 400) {
						// there is a particular error which is an indication that the customer exists already
						// can use this information to still obtain their id
						const errorData = (await response.json()) as ErrorBody;

						try {
							const isAlreadyCustomer = errorData.i18nErrorMessage.parameters.includes(EMAIL_ALREADY_EXISTS_MESSAGE);
							if (isAlreadyCustomer) {
								return await getAccountId(email);
							} else {
								logger.error('An unexpected error occured during the client creation process.');
								return await restErrorResponseHandler(response);
							}
						} catch {
							logger.error('An Error Occured, and the error body couldnt be correctly parsed.');
							return await restErrorResponseHandler(response);
						}
					} else if (response.ok) {
						const newCustomer: OrganizationCustomer = await response.json();
						addCustomerToOrganization(newCustomer.accountId);
						return newCustomer.accountId;
					}
				});

				return response;
			},
		};
	}

	throw Error('Helpdesk functionality is enabled, but no valid auth token was provided');
};
