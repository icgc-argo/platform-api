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

import { ApolloError, AuthenticationError, UserInputError } from 'apollo-server-express';
import { get } from 'lodash';
import { Response } from 'node-fetch';

import logger from './logger';

const errorResponseHandler = async (response: Response, message: string) => {
	// Generic handle 5xx errors
	if (response.status >= 500 && response.status <= 599) {
		logger.debug(`Server 5xx response: ${message}`);
		throw new ApolloError(message); // will return Apollo code INTERNAL_SERVER_ERROR
	}

	switch (response.status) {
		case 401:
			throw new AuthenticationError('401: Unauthorized request.');
		case 403:
			throw new AuthenticationError('403: Request forbidden.');
		case 400:
		case 404: {
			const defaultMessage = { message };
			const notFoundData = await response
				.json()
				.then((data) => data)
				.catch(() => defaultMessage);
			// throw error with message and properties in response (if any)
			throw new UserInputError(notFoundData.message, notFoundData);
		}
		default:
			return response;
	}
};

/*
convert the REST status codes to GQL errors, or return the response if passing
*/
export const restErrorResponseHandler = async (response: Response) => {
	const responseBody = await response.text();
	return await errorResponseHandler(response, responseBody);
};

export const programServicePublicErrorResponseHandler = async (response: Response) => {
	const responseBody = await get(response, 'statusText');
	return await errorResponseHandler(response, responseBody);
};
