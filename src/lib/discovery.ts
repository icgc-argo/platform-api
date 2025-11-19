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
import { format } from 'date-fns';
import { RequestHandler } from 'express';
import { TsvFileSchema } from 'routes/file-centric-tsv/types';
import {
	createEsDocumentStream,
	createFilterToEsQueryConverter,
	FilterStringParser,
	writeTsvStreamToWritableTarget,
} from 'routes/file-centric-tsv/utils';
import { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import { hasDacoAccess } from 'routes/utils/accessValidations';
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

type DataDiscoveryESDocument = {
	donor_id: string;
	gender: string;
	submitter_donor_id: string;
	study_id: string;
	updated_at: string;
	program_id: string;
	vital_status: string;
	cause_of_death: string;
	survival_time: number;
	primary_site: string[];
	height: number;
	weight: number;
	bmi: number;
	genetic_disorders: string[];

	analyses: {
		analysis_id: string;
		analysis_type: string;
		analysis_version: number;
		files: {
			index_file?: { object_id: string };
			file_id: string;
			file_type: string;
			md5sum: string;
			name: string;
			object_id: string;
			size: number;
		}[];
		repositories: {
			code: string;
			name: string;
			organization: string;
			country: string;
			url: string;
		}[];
	}[];

	specimens: { samples: { sample_id: string }[] }[];
};

type FileRecord = {
	donor_id: string;
	program_id: string;
	analysis_id: string;
	repositories: string[];
	sample_ids: string[];
	file: {
		object_id: string;
		type: string;
		name: string;
		size: number;
		md5sum: string;
		index_file?: string;
	};
};

/**
 * Convert donor centric records into file records
 * Consumes ES document stream and outputs stream for input to TSV writer stream
 *
 * @param stream ES document stream
 */
async function* donorsToFiles(
	stream: AsyncGenerator<DataDiscoveryESDocument[], void, unknown>,
): AsyncGenerator<FileRecord[], void, unknown> {
	for await (const documentChunk of stream) {
		const scoreRecords = [];

		for (const document of documentChunk) {
			const { donor_id, program_id, analyses, specimens } = document;

			const records = analyses.flatMap((analysis) => {
				const uniqueIds = new Set();
				return analysis.files.reduce<FileRecord[]>((acc, file) => {
					if (!uniqueIds.has(file.file_id)) {
						uniqueIds.add(file.file_id);
						acc.push({
							donor_id,
							program_id,
							analysis_id: analysis.analysis_id,
							repositories: analysis.repositories?.map(({ code }) => code),
							sample_ids: specimens?.flatMap(({ samples }) => samples.map(({ sample_id }) => sample_id)),
							file: {
								object_id: file.object_id,
								type: file.file_type,
								name: file.name,
								size: file.size,
								md5sum: file.md5sum,
								index_file: file.index_file?.object_id || '',
							},
						});
					}
					return acc;
				}, []);
			});
			scoreRecords.push(...records);
		}

		yield scoreRecords;
	}
}

/**
 * Getters for TSV stream
 */
const manifestFileFields: TsvFileSchema<FileRecord> = [
	{
		header: 'repository_code',
		getter: (fileObj) => fileObj.repositories.join('|'),
	},
	{ header: 'analysis_id', getter: (fileObj) => fileObj.analysis_id },
	{ header: 'object_id', getter: (fileObj) => fileObj.file.object_id },
	{ header: 'file_type', getter: (fileObj) => fileObj.file.type },
	{ header: 'file_name', getter: (fileObj) => fileObj.file.name },
	{ header: 'file_size', getter: (fileObj) => String(fileObj.file.size) },
	{ header: 'md5sum', getter: (fileObj) => fileObj.file.md5sum },
	{
		header: 'index_object_id',
		getter: (fileObj) => fileObj.file.index_file || '',
	},
	{
		header: 'donor_id',
		getter: (fileObj) => fileObj.donor_id,
	},
	{
		header: 'sample_id(s)',
		getter: (fileObj) => fileObj.sample_ids.join('|'),
	},
	{ header: 'program_id', getter: (fileObj) => fileObj.program_id },
];

export const createDownloadHandler = ({
	convertFilterToEsQuery,
	esClient,
}: {
	convertFilterToEsQuery: FilterStringParser;
	esClient: Client;
}): RequestHandler => {
	return async (req: AuthenticatedRequest, res) => {
		const { scopes, userId, authenticated } = req.auth;

		if (!authenticated) {
			logger.debug(`[data-discovery-tsv] /score-manifest: Request not authenticated.`);
			return res.status(401).json({ error: 'Must be authenticated to access resource.' });
		}
		const hasDaco = hasDacoAccess(scopes);
		if (!hasDaco) {
			logger.debug(`[data-discovery-tsv] /score-manifest: User ${userId} requesting clinical data without DACO access`);
			return res.status(403).json({ error: 'Users require DACO approval to access clinical data.' });
		}

		const { filter: filterStr }: { filter?: string } = req.query;

		let esQuery: object;
		try {
			const requestFilter = filterStr ? JSON.parse(filterStr) : undefined;
			esQuery = await convertFilterToEsQuery(requestFilter);
		} catch (err) {
			logger.error(err);
			return res.status(400).send(`${filterStr} is not a valid filter`);
		}

		const donorDocumentStream = createEsDocumentStream<DataDiscoveryESDocument>({
			esClient,
			esIndex: ELASTICSEARCH_DISCOVERY_INDEX,
			shouldContinue: () => !req.aborted,
			esQuery,
			sortField: 'donor_id',
		});

		const fileStream = donorsToFiles(donorDocumentStream);

		res.setHeader(
			'content-disposition',
			`attachment; filename=${`score-manifest.${format(Date.now(), 'yyyyMMddHHmmss')}.tsv`}`,
		);
		await writeTsvStreamToWritableTarget(fileStream, res, manifestFileFields);
		res.end();
	};
};
