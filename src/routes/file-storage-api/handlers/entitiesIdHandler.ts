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

import { Client } from '@elastic/elasticsearch';
import { Request, Handler } from 'express';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';
import { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import { hasSufficientProgramMembershipAccess } from 'routes/utils/accessValidations';
import { getEsFileDocumentByObjectId, toSongEntity } from '../utils';

const createEntitiesIdHandler = ({ esClient }: { esClient: Client }): Handler => {
  return async (req: AuthenticatedRequest, res, next) => {
    const file = await getEsFileDocumentByObjectId(esClient)(req.params.fileObjectId);
    if (!file) {
      res
        .status(404)
        .send(`No file found with the provided ObjectId: ${req.params.fileObjectId}`)
        .end();
      return;
    }
    const isAuthorized = hasSufficientProgramMembershipAccess({
      scopes: req.auth.scopes,
      file,
    });
    if (isAuthorized) {
      res.status(200).send(toSongEntity(file as EsFileCentricDocument));
    } else {
      // token is valid but permissions are not sufficient
      res.status(403).send('Not authorized to access the requested data').end();
    }
  };
};

export default createEntitiesIdHandler;
