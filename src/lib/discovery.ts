/*
 * Copyright (c) 2025 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>.
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
import { ELASTICSEARCH_DISCOVERY_INDEX } from 'config';
import { createFilterToEsQueryConverter } from 'routes/file-centric-tsv/utils';
import { downloadDonorTsv } from 'services/clinical/api';
import { createAuthClient } from 'services/ego/authClient';
import logger from 'utils/logger';
import { z } from 'zod';

const FilterQuerySchema = z.object({
	filter: z.string().min(1, 'Filter cannot be empty'),
});
export const validateQueryParams = (query: unknown) => {
	const result = FilterQuerySchema.safeParse(query);

	if (!result.success) {
		throw new Error('Missing required query param: filter');
	}

	try {
		return JSON.parse(result.data.filter);
	} catch (error) {
		throw new Error('Invalid filter format: must be valid JSON');
	}
};

/**
 * Converts filter to ES query and queries Data Discovery index.
 *
 * @param filter - SQON
 * @param esClient - ES client
 * @returns Data Discovery records
 */
export const searchDataDiscoveryIndex = async (filter: object, esClient: Client) => {
	const convertFilterToEsQuery = await createFilterToEsQueryConverter(esClient, ELASTICSEARCH_DISCOVERY_INDEX);

	try {
		const query = await convertFilterToEsQuery(filter);
		const result = await esClient.search({
			index: ELASTICSEARCH_DISCOVERY_INDEX,
			body: {
				query,
			},
		});

		return result?.body?.hits?.hits?.map((doc: Record<string, any>) => doc._source) || [];
	} catch (error) {
		logger.error(error);
		throw new Error('Failed to convert filter to ES query or search failed');
	}
};

export const extractUniqueDonorIds = (files: Record<string, any>[]) => {
	return files.reduce<Set<string>>((set, file) => {
		typeof file.donor_id === 'string' && set.add(file.donor_id);
		return set;
	}, new Set());
};

/**
 * Queries clinical api with donor ids
 *
 * @param clinicalAuthClient
 * @param donorIds
 * @returns Filename for download and data for attachment
 */
export const generateClinicalDataFile = async (
	clinicalAuthClient: Awaited<ReturnType<typeof createAuthClient>>,
	donorIds: Set<string>,
) => {
	const filename = `clinical_data_${Date.now()}.zip`;

	try {
		const data = await downloadDonorTsv(clinicalAuthClient, Array.from(donorIds));
		return { data, filename };
	} catch (error) {
		logger.error(`Error retrieving clinical donor data: ${error}`);
		throw new Error('Failed to retrieve clinical file data');
	}
};
