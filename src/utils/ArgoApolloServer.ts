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

import { Request, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { GQL_MAX_COST } from 'config';

import logger from 'utils/logger';
// @ts-ignore
import costAnalysis from 'graphql-cost-analysis';

class ArgoApolloServer extends ApolloServer {
  async createGraphQLServerOptions(req: Request, res: Response) {
    const options = await super.createGraphQLServerOptions(req, res);
    logger.debug(`Query: ${req.body.query.split('\n').join(' ')}`);
    logger.debug(`Variables: ${JSON.stringify(req.body.variables)}`);

    return {
      ...options,
      validationRules: [
        ...(options.validationRules || []),
        costAnalysis({
          variables: req.body.variables,
          maximumCost: GQL_MAX_COST,
          defaultCost: 10,
          // logs out complexity so we can later on come back and decide on appropriate limit
          onComplete: async (cost: number) => {
            logger.info(`QUERY_COST: ${cost}`);
          },
        }),
      ],
    };
  }
}

export default ArgoApolloServer;
