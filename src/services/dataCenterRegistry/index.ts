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

import NodeCache from 'node-cache';
import fetch, { Response } from 'node-fetch';
import urljoin from 'url-join';

import { DATA_CENTER_REGISTRY_API_ROOT } from '../../config';
import logger from 'utils/logger';

// Make cache to reduce calls to Registry, set default expiry to 6 hours (60s*60mins*6hrs)
const dataCenterCache = new NodeCache({ stdTTL: 60 * 60 * 6 });

export type DataCenter = {
  centerId: string;
  country: string;
  name: string;
  organization: string;
  contactEmail: string;
  storageType: string;
  scoreUrl: string;
  songUrl: string;
  type: string;
};

type DataCenterError = {
  error: string;
  message: string;
};

async function fetchDataCenter(code: string): Promise<DataCenter | undefined> {
  const url_getById = urljoin(DATA_CENTER_REGISTRY_API_ROOT, 'data-centers', code);
  const dataCenter = await fetch(url_getById, {
    method: 'get',
  })
    .then(async (response: Response) => (await response.json()) as DataCenter)
    .catch(async (response: Response) => {
      const responseJson = await response.json();
      logger.error(
        `Failed to fetch data center from registry for repository code: ${code}. Error ${response.status}: ${responseJson.message}`,
      );
      return undefined;
    });
  return dataCenter;
}

export async function getDataCenter(code: string): Promise<DataCenter | undefined> {
  const fromCache = dataCenterCache.get(code) as DataCenter;
  if (fromCache) {
    return fromCache;
  }

  // Not in cache, fetch from registry
  const fromRegistry = await fetchDataCenter(code);
  if (!fromRegistry) {
    // Could not find code in registry
    return undefined;
  }
  // Cache response for future reference
  dataCenterCache.set(code, fromRegistry);
  return fromRegistry;
}
