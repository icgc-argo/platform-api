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

import typeDefs from './gqlTypeDefs';
import { GlobalGqlContext } from 'app';
import { makeExecutableSchema } from 'graphql-tools';
import { createJiraClient, JiraClient } from './jiraRequests';
import { FEATURE_HELP_DESK_ENABLED, DEV_RECAPTCHA_DISABLED } from 'config';
import { ApolloError, UserInputError } from 'apollo-server-express';
import createReCaptchaClient, {
  ReCaptchaClient,
  createStubReCaptchaClient,
} from 'services/reCaptcha';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';

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
  async (
    ...resolverArgs: [unknown, { reCaptchaResponse: string }, GlobalGqlContext, GraphQLResolveInfo]
  ) => {
    const { reCaptchaResponse } = resolverArgs[1];
    const { success, 'error-codes': errorCodes } = await reCaptchaClient.verifyUserResponse(
      reCaptchaResponse,
    );
    if (success) {
      return resolverFn(...resolverArgs);
    } else {
      if (
        errorCodes?.includes('invalid-input-response') ||
        errorCodes?.includes('missing-input-response')
      ) {
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
      createJiraTicketWithReCaptcha: resolveWithReCaptcha(
        jiraTicketCreationResolver,
        reCaptchaClient,
      ),
    },
  };
};

const createDisabledResolvers = (reCaptchaClient: ReCaptchaClient) => ({
  Mutation: {
    createJiraTicketWithReCaptcha: resolveWithReCaptcha(() => {
      throw new ApolloError(
        `FEATURE_HELP_DESK_ENABLED is ${FEATURE_HELP_DESK_ENABLED} in this instance of the gateway`,
      );
    }, reCaptchaClient),
  },
});

export default async () => {
  const reCaptchaClient = DEV_RECAPTCHA_DISABLED
    ? await createStubReCaptchaClient()
    : await createReCaptchaClient();
  const resolvers = FEATURE_HELP_DESK_ENABLED
    ? createResolvers(await createJiraClient(), reCaptchaClient)
    : createDisabledResolvers(reCaptchaClient);
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
};
