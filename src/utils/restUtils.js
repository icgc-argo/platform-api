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

import {
  AuthenticationError,
  UserInputError,
  ApolloError,
} from 'apollo-server-express';
import logger from './logger';
/*
convert the REST status codes to GQL errors, or return the response if passing
*/
export const restErrorResponseHandler = async (response) => {
  // Generic handle 5xx errors
  if (response.status >= 500 && response.status <= 599) {
    const responseBody = await response.text();
    logger.debug(`Server 5xx response: ${responseBody}`);
    throw new ApolloError(); // will return Apollo code INTERNAL_SERVER_ERROR
  }

  switch (response.status) {
    case 200:
    case 201:
      return response;
    case 401:
    case 403:
      throw new AuthenticationError(response.status);
    case 400:
    case 404:
      let notFoundData;
      try {
        // This was built for the response structure from Clincial Service which returns a message value in the 404 response.
        notFoundData = await response.json();
      } catch {
        notFoundData = { message: '' };
      }
      // throw error with message and properties in response (if any)
      throw new UserInputError(notFoundData.message, notFoundData);
    default:
      return response;
  }
};
