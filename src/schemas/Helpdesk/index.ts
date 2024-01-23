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

import { ApolloError, UserInputError } from 'apollo-server-express';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { makeExecutableSchema } from 'graphql-tools';

import { GlobalGqlContext } from '@/app';
import { DEV_RECAPTCHA_DISABLED, FEATURE_HELP_DESK_ENABLED } from '@/config';
import createReCaptchaClient, { createStubReCaptchaClient, ReCaptchaClient } from '@/services/reCaptcha';
import logger from '@/utils/logger';

import typeDefs from './gqlTypeDefs';
import { createJiraClient, JiraClient } from './jiraRequests';

enum JiraTicketCategory {
	APPLYING_ACCESS,
	DATA_DOWNLOAD,
	DATA_SUBMISSION,
	DATA_QUERY,
	MEDIA_QUERY,
	PUBLICATION_QUERY,
	OTHER,
}

type CategoryMapper = {
	[key in keyof typeof JiraTicketCategory]: string;
};

const MESSAGE_CATEGORY_MAPPER: CategoryMapper = {
	APPLYING_ACCESS: 'Applying for Access to Controlled Data through DACO',
	DATA_DOWNLOAD: 'Data Download',
	DATA_SUBMISSION: 'Data Submission',
	DATA_QUERY: 'Data or Analysis Query',
	MEDIA_QUERY: 'Media or Collaboration Inquiry',
	PUBLICATION_QUERY: 'Publication Inquiry',
	OTHER: 'Other',
};

// values obtained from JIRA's "get request types" endpoint
const REQUEST_TYPE_MAPPER: CategoryMapper = {
	APPLYING_ACCESS: '63',
	DATA_DOWNLOAD: '81',
	DATA_SUBMISSION: '83',
	DATA_QUERY: '85',
	MEDIA_QUERY: '87',
	PUBLICATION_QUERY: '89',
	OTHER: '91',
};

const resolveWithReCaptcha =
	(resolverFn: GraphQLFieldResolver<unknown, unknown>, reCaptchaClient: ReCaptchaClient) =>
	async (...resolverArgs: [unknown, { reCaptchaResponse: string }, GlobalGqlContext, GraphQLResolveInfo]) => {
		const { reCaptchaResponse } = resolverArgs[1];
		const { success, 'error-codes': errorCodes } = await reCaptchaClient.verifyUserResponse(reCaptchaResponse);
		if (success) {
			return resolverFn(...resolverArgs);
		} else {
			if (errorCodes?.some((error) => ['invalid-input-response', 'missing-input-response'].includes(error))) {
				throw new UserInputError(`invalid ReCaptcha response: ${errorCodes}`);
			} else {
				throw new ApolloError(`failed to verify reCaptcha response`);
			}
		}
	};

const createResolvers = (jiraClient: JiraClient, reCaptchaClient: ReCaptchaClient) => {
	const jiraTicketCreationResolver: GraphQLFieldResolver<
		unknown,
		GlobalGqlContext,
		{
			messageCategory: string;
			emailAddress: string;
			requestText: string;
			displayName: string;
		}
	> = async (obj, args, context) => {
		const { messageCategory, emailAddress, requestText, displayName } = args;
		const messageCategoryKey = messageCategory as keyof typeof JiraTicketCategory;
		const serviceRequestResponse = await jiraClient.createServiceRequest(
			emailAddress,
			REQUEST_TYPE_MAPPER[messageCategoryKey],
			requestText,
			MESSAGE_CATEGORY_MAPPER[messageCategoryKey],
		);
		return serviceRequestResponse;
	};

	return {
		Mutation: {
			createJiraTicketWithReCaptcha: resolveWithReCaptcha(jiraTicketCreationResolver, reCaptchaClient),
		},
	};
};

const createDisabledResolvers = (reCaptchaClient: ReCaptchaClient) => ({
	Mutation: {
		createJiraTicketWithReCaptcha: resolveWithReCaptcha(() => {
			throw new ApolloError('HelpDesk is unavailable in this instance of the gateway');
		}, reCaptchaClient),
	},
});

export default async () => {
	const stubReCaptcha = await createStubReCaptchaClient();

	if (FEATURE_HELP_DESK_ENABLED) {
		try {
			logger.info(`Attempting to set up HelpDesk ticket creation`);

			const jiraClient = await createJiraClient();
			const reCaptchaClient = DEV_RECAPTCHA_DISABLED ? stubReCaptcha : await createReCaptchaClient();

			const resolvers = createResolvers(jiraClient, reCaptchaClient);

			logger.info(`Successful HelpDesk set up\n`);

			return makeExecutableSchema({
				typeDefs,
				resolvers,
			});
		} catch (error) {
			logger.error(error);
		}
	}

	logger.info(`HelpDesk is unavailable in this instance of the gateway\n`);

	const resolvers = createDisabledResolvers(stubReCaptcha);

	return makeExecutableSchema({
		typeDefs,
		resolvers,
	});
};
