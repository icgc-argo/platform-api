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

import { IResolvers } from 'graphql-tools';
import { GlobalGqlContext } from 'app';
import programDonorSummaryEntriesResolver from './summaryEntries';
import programDonorSummaryStatsResolver from './summaryStats';
import { GraphQLFieldResolver } from 'graphql';
import egoTokenUtils from 'utils/egoTokenUtils';
import { AuthenticationError, ApolloError } from 'apollo-server-express';
import { BaseQueryArguments, ProgramDonorSummaryStatsGqlResponse } from './types';
import { Client } from '@elastic/elasticsearch';

class UnauthorizedError extends ApolloError {
  constructor(message: string) {
    super(message);
  }
  extensions = {
    code: 'UNAUTHORIZED',
  };
}

const resolveWithProgramAuth = <ResolverType = GraphQLFieldResolver<unknown, unknown, unknown>>(
  resolver: ResolverType,
  gqlResolverArguments: [unknown, BaseQueryArguments, GlobalGqlContext, unknown],
): ResolverType => {
  const [_, args, context] = gqlResolverArguments;
  const { egoToken } = context;
  const {
    decodeToken,
    isExpiredToken,
    getPermissionsFromToken,
    isValidJwt,
    canReadProgramData,
    canReadProgram,
  } = egoTokenUtils;

  if (egoToken) {
    let decodedToken: ReturnType<typeof decodeToken>;
    try {
      decodedToken = decodeToken(egoToken);
    } catch (err) {
      throw new AuthenticationError(err);
    }

    const isExpired = isExpiredToken(decodedToken);
    const permissions = getPermissionsFromToken(egoToken);
    const hasPermission =
      canReadProgram({
        permissions,
        programId: args.programShortName,
      }) ||
      canReadProgramData({
        permissions,
        programId: args.programShortName,
      });

    const authorized = egoToken && isValidJwt(egoToken) && !isExpired && hasPermission;

    if (authorized) {
      return resolver;
    } else {
      if (isExpired) {
        throw new UnauthorizedError('expired jwt');
      } else {
        throw new UnauthorizedError('unauthorized');
      }
    }
  } else {
    throw new AuthenticationError('you must be logged in to access this data');
  }
};

const createResolvers = async (
  esClient: Client,
): Promise<IResolvers<ProgramDonorSummaryStatsGqlResponse, GlobalGqlContext>> => {
  return {
    Query: {
      programDonorSummaryEntries: (...resolverArguments) =>
        resolveWithProgramAuth(
          programDonorSummaryEntriesResolver(esClient)(...resolverArguments),
          resolverArguments,
        ),
      programDonorSummaryStats: (...resolverArguments) =>
        resolveWithProgramAuth(
          programDonorSummaryStatsResolver(esClient)(...resolverArguments),
          resolverArguments,
        ),
    },
  };
};

export default createResolvers;
