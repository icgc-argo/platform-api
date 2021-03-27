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

import fetch from 'node-fetch';

import egoTokenUtils from 'utils/egoTokenUtils';
import { DONOR_AGGREGATOR_REST_PROXY_ROOT } from 'config';

export type DonorAggregatorClient = {
  syncDonorAggregationIndex: (programId: string) => Promise<void>;
};

const getAuthorizedClient = (requestEgoJwt: string) => {
  const isValid = egoTokenUtils.isValidJwt(requestEgoJwt);
  if (!isValid) {
    throw new Error('Authentication token is not valid.');
  }
  const permissions = egoTokenUtils.getPermissionsFromToken(requestEgoJwt);
  const authorized = egoTokenUtils.isDccMember(permissions);
  if (!authorized) {
    throw new Error('Token does not provide DCC-Admin authorization.');
  }
  return donorAggregatorClient();
};

const donorAggregatorClient = (): DonorAggregatorClient => {
  const SYNC_PROGRAM_URL = new URL('index/program', DONOR_AGGREGATOR_REST_PROXY_ROOT);

  const syncDonorAggregationIndex = async (programId: string) => {
    const url = new URL(programId, SYNC_PROGRAM_URL);
    try {
      await fetch(url, { method: 'POST' });
      return;
    } catch (error) {
      throw new Error(error);
    }
  };
  return { syncDonorAggregationIndex };
};

export default getAuthorizedClient;
