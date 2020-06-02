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

import urlJoin from 'url-join';
import { CLINICAL_SERVICE_ROOT, SUBMISSION_TEMPLATE_PATH } from '../config';
import logger from '../utils/logger';
import express from 'express';
import { Request, Response } from 'express';
const router = express.Router();

import { createProxyMiddleware } from 'http-proxy-middleware';

// Our specification download service can't use GraphQL because GraphQL specification requires the content-type
// that it returns be json, and we want to be able to return other content types, such as tab-separated-values,
// so that the user is automatically prompted to save the file from their browser.

// This is for handling nodejs/system errors (e.g. connection failed)
const handleError = (err: Error, req: Request, res: Response) => {
  logger.error('Clinical Router Error - ' + err);
  return res.status(500).send('Internal Server Error');
};

router.use(
  '/template/:template',
  createProxyMiddleware({
    target: CLINICAL_SERVICE_ROOT,
    pathRewrite: (pathName: string, req: Request) => {
      // 'all' will retrieve the zip file with all templates
      // for specific templates 'templateName'.tsv or 'templateName' will get the tsv from clinical
      const name = req.params.template.replace(/.tsv$/, '');
      return urlJoin(SUBMISSION_TEMPLATE_PATH, name);
    },
    onError: handleError,
    changeOrigin: true,
  }),
);

router.use(
  '/program/:programId/all-clinical-data',
  createProxyMiddleware({
    target: CLINICAL_SERVICE_ROOT,
    pathRewrite: (pathName: string, req: Request) => {
      const programId = req.params.programId;
      return urlJoin('/clinical/program/', programId, '/tsv-export');
    },
    onError: handleError,
    changeOrigin: true,
  }),
);

export default router;
