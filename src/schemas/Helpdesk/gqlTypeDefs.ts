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

export default gql`
  enum JiraTicketCategory {
    APPLYING_ACCESS
    DATA_DOWNLOAD
    DATA_SUBMISSION
    DATA_QUERY
    MEDIA_QUERY
    PUBLICATION_QUERY
    OTHER
  }

  # the url to the servicedesk ui for the newly made ticket
  type TicketLink {
    web: String
  }

  type TicketCreationResponse {
    issueId: String
    issueKey: String
    _links: TicketLink
  }

  type Mutation {
    createJiraTicket(
      messageCategory: JiraTicketCategory!
      emailAddress: String!
      requestText: String!
      displayName: String
    ): TicketCreationResponse!
      @deprecated(reason: "Now requires reCaptcha. Use createJiraTicketWithReCaptcha instead")
    createJiraTicketWithReCaptcha(
      reCaptchaResponse: String!
      messageCategory: JiraTicketCategory!
      emailAddress: String!
      requestText: String!
      displayName: String
    ): TicketCreationResponse!
  }

  type Query {
    _jiraRootQuery: String!
  }
`;
