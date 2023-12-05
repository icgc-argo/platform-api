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

import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';

import { GlobalGqlContext } from 'app';
import egoTokenUtils from 'utils/egoTokenUtils';
import { EGO_DACO_POLICY_NAME } from '../../config';
import { EgoClient } from '../../services/ego';
import logger from '../../utils/logger';

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
	type User {
		id: String!
		email: String!
		firstName: String
		lastName: String
		name: String
		preferredLanguage: String
		status: String
		type: String
		applications: [String]
		groups: [String]
		scopes: [String]

		"""
		ISO Formatted DateTime:
		"""
		createdAt: String

		"""
		ISO Formatted DateTime:
		"""
		lastLogin: String
	}

	type AccessKey {
		key: String
		error: String

		"""
		Time till expiry in milliseconds
		"""
		exp: Int
	}

	type Profile {
		isDacoApproved: Boolean
		apiKey: AccessKey
	}

	type Query {
		"""
		retrive user profile data
		"""
		self: Profile
	}

	type Mutation {
		"""
		Generate Ego access key
		"""
		generateAccessKey: AccessKey!
	}
`;

const createProfile = ({
	apiKey,
	isDacoApproved,
}: {
	apiKey: unknown;
	isDacoApproved: unknown;
}) => ({
	apiKey,
	isDacoApproved,
});

// Provide resolver functions for your schema fields
const createResolvers = (egoClient: EgoClient) => {
	return {
		Query: {
			self: async (obj: unknown, args: undefined, context: GlobalGqlContext) => {
				const { Authorization, egoToken, userJwtData } = context;
				logger.info({ Authorization, egoToken, userJwtData });
				const jwt = egoToken.replace('Bearer ', '');
				const decodedToken = egoTokenUtils.decodeToken(jwt);
				const userId = decodedToken.sub;
				const userScopes = decodedToken.context.scope;
				const isDacoApproved =
					(userScopes || []).includes(`${EGO_DACO_POLICY_NAME}.WRITE`) ||
					(userScopes || []).includes(`${EGO_DACO_POLICY_NAME}.READ`);

				// API access keys
				const keys = await egoClient.getEgoAccessKeys(userId, Authorization);
				let apiKey = null;

				if (keys.length === 1) {
					const egoApiKeyObj = keys[0];
					const { name: accessToken } = egoApiKeyObj;
					apiKey = {
						key: accessToken,
						exp: egoClient.getTimeToExpiry(egoApiKeyObj),
						error: '',
					};
				} else {
					const errorMsg =
						'An error has been found with your API key. Please generate a new API key';
					apiKey = { key: null, exp: null, error: errorMsg };
				}

				return createProfile({ apiKey, isDacoApproved });
			},
		},
		Mutation: {
			generateAccessKey: async (obj: unknown, args: undefined, context: GlobalGqlContext) => {
				const { Authorization, egoToken } = context;
				const decodedToken = egoTokenUtils.decodeToken(egoToken.replace('Bearer ', ''));
				const userId = decodedToken.sub;

				// delete old keys
				const keys = await egoClient.getEgoAccessKeys(userId, Authorization);
				if (keys) {
					await egoClient.deleteKeys(keys, Authorization);
				}
				// get scopes for new token
				const { scopes } = await egoClient.getScopes(userId, Authorization);

				const egoApiKeyObj = await egoClient.generateEgoAccessKey(userId, scopes, Authorization);
				return {
					exp: egoClient.getTimeToExpiry(egoApiKeyObj),
					key: egoApiKeyObj.name,
					error: '',
				};
			},
		},
	};
};

export default (egoClient: EgoClient) =>
	makeExecutableSchema({
		typeDefs,
		resolvers: createResolvers(egoClient),
	});
