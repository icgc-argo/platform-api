import { Client } from '@elastic/elasticsearch';
import { json } from 'body-parser';
import * as esb from 'elastic-builder';
import * as express from 'express';
import { z as zod } from 'zod';

import { ADVERTISED_HOST, ARRANGER_FILE_CENTRIC_INDEX } from 'config';
import authenticatedRequestMiddleware, { AuthenticatedRequest } from 'routes/middleware/authenticatedRequestMiddleware';
import { hasDacoAccess, hasSufficientProgramMembershipAccess } from 'routes/utils/accessValidations';
import { downloadDonorTsv } from 'services/clinical/api';
import { EgoClient } from 'services/ego';
import createClinicalApiAuthClient from 'services/ego/clinicalApiAuthClient';
import { EsHits } from 'services/elasticsearch';
import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';

import { get } from 'lodash';
import fetch from 'node-fetch';
import { createEsDocumentStream, createFilterToEsQueryConverter } from 'routes/file-centric-tsv/utils';
import urljoin from 'url-join';
import logger from '../../utils/logger';

const createClincalApiRouter = async (esClient: Client, egoClient: EgoClient) => {
	const router = express.Router();

	router.use(json());
	router.use(authenticatedRequestMiddleware({ egoClient }));

	const clinicalAuthClient = await createClinicalApiAuthClient(egoClient);

	const convertFilterToEsQuery = await createFilterToEsQueryConverter(esClient, ARRANGER_FILE_CENTRIC_INDEX);

	/* **************************************
	 * Download clinical donor data for files
	 *
	 * This enables download of clinical data from the ARGO Platform Data Discovery page
	 * The request includes a list of file IDs that they want the clinical data for.
	 * The donor for each file is found from the file_centric index, as well as a confirmation that the file's donor has complete clinical data.
	 * The file_centric record for each file is also used to check that he user has permission
	 *  to access the file, and the request is rejected with an error message if the user is unable to access any of the requested files.
	 * The clinical data will be requested from the clinical API and returned as a zip file containing TSVs. Each TSV is of a clinical data type and will
	 *  include the data from all requested donors.
	 *
	 * There is a maximum number of files set in the file indices, based on max_result_window. This is 10k by default, so we should not hit it.
	 * It would be prudent to limit this number based on UI convenience and also to reduce server load. Suggested at 100 hits.
	 *  ************************************** */

	const FileDownloadRequestBody = zod.object({
		objectIds: zod.string().array().min(1),
	});

	router.use('/donors/data-for-files', async (req: AuthenticatedRequest, res) => {
		try {
			// 0. Grab requester JWT
			const { scopes, userId, authenticated } = req.auth;

			if (!authenticated) {
				logger.debug(`[clinical-routes] /donors/data-for-files: Request not authenticated.`);
				return res.status(401).json({ error: 'Must be authenticated to access resource.' });
			}
			const hasDaco = hasDacoAccess(scopes);
			if (!hasDaco) {
				logger.debug(
					`[clinical-routes] /donors/data-for-files: User ${userId} requesting clinical data without DACO access`,
				);
				return res.status(403).json({ error: 'Users require DACO approval to access clinical data.' });
			}

			// 1. validate request body
			const bodyParseResult = FileDownloadRequestBody.safeParse(req.body);
			if (!bodyParseResult.success) {
				logger.debug(
					`[clinical-routes] /donors/data-for-files: Received invalid request body: ${JSON.stringify(
						bodyParseResult.error,
					)}`,
				);
				return res.status(400).json({ error: `Request body is invalid.` });
			}
			const body = bodyParseResult.data;

			// 2. retrieve related files from ES
			const query = esb
				.requestBodySearch()
				.size(body.objectIds.length)
				.query(esb.boolQuery().must([esb.termsQuery('object_id', body.objectIds)]));

			const filesResponse = await esClient
				.search<EsHits<EsFileCentricDocument>>({
					index: ARRANGER_FILE_CENTRIC_INDEX,
					body: query,
				})
				.catch((err) => {
					logger.error(
						`Error fetching files from ${ARRANGER_FILE_CENTRIC_INDEX} index during attempt to download clinical file data: ${err}`,
					);
				});

			const files = filesResponse ? filesResponse.body?.hits?.hits?.map((doc) => doc._source) : [];

			// 3. validations
			// 3a. all files were found
			const missingFiles = body.objectIds.filter((objectId) => !files.find((doc) => doc.object_id === objectId));

			if (missingFiles.length > 0) {
				logger.info(
					`[clinical-routes] /donors/data-for-files: Unable to find requested files in file_centric - ${missingFiles}`,
				);
				return res.status(400).json({
					error: `File(s) from the request could not be found: ${missingFiles}`,
				});
			}

			// 3b. all have clinical data
			const missingClinicalData = files.filter((file) => !file.has_clinical_data);
			if (missingClinicalData.length > 0) {
				logger.info(
					`[clinical-routes] /donors/data-for-files: Requested files are indexed as missing clinical data - ${missingClinicalData.map(
						(doc) => doc.file_id,
					)}`,
				);
				return res.status(400).json({
					error: `File(s) from the request do not have available clinical data: ${missingClinicalData.map(
						(doc) => doc.file_id,
					)}`,
				});
			}
			// 3c. user has access to each file
			const forbiddenFiles = files.filter((file) => !hasSufficientProgramMembershipAccess({ scopes, file }));
			if (forbiddenFiles.length > 0) {
				logger.info(
					`[clinical-routes] /donors/data-for-files: User ${userId} missing permissions to access requested files - ${forbiddenFiles.map(
						(doc) => doc.file_id,
					)}.`,
				);
				return res.status(400).json({
					error: `User has insufficient permissions to access the following files: ${forbiddenFiles.map(
						(doc) => doc.file_id,
					)}`,
				});
			}

			// 4. fetch files for the donors of the files with data
			const donorIds = files.flatMap((file) => file.donors.map((donor) => donor.donor_id)).filter((id) => !!id);

			const uniqueDonors = Array.from(new Set(donorIds));

			// 6. return all files in a zip with a manifest
			const filename = `clinical_data_${Date.now()}`;
			try {
				const response = await downloadDonorTsv(clinicalAuthClient, uniqueDonors);
				res
					.status(200)
					.contentType('application/octet-stream')
					.setHeader('content-disposition', `filename=${filename}.zip`);
				return res.send(response);
			} catch (e) {
				logger.error(`Error retrieving clinical donor data from clinical-service ${e}`);
				return res.status(500).json({
					error: e.message || 'An unexpected error occurred retrieving clinical file data.',
				});
			}
		} catch (e) {
			logger.error(`[clinical-routes] /donors/data-for-files: unexpected error occurred: ${e}`);
			return res.status(500).json({
				error: e.message || 'An unexpected error occurred retrieving clinical file data.',
			});
		}
	});

	router.use('/donors/data-for-all-files', async (req: AuthenticatedRequest, res) => {
		try {
			// Grab requester JWT
			const { scopes, userId, authenticated, egoJwt } = req.auth;

			if (!authenticated) {
				logger.debug(`[clinical-routes] /donors/data-for-all-files: Request not authenticated.`);
				return res.status(401).json({ error: 'Must be authenticated to access resource.' });
			}
			const hasDaco = hasDacoAccess(scopes);
			if (!hasDaco) {
				logger.debug(
					`[clinical-routes] /donors/data-for-all-files: User ${userId} requesting clinical data without DACO access`,
				);
				return res.status(403).json({ error: 'Users require DACO approval to access clinical data.' });
			}

			// Get request SQON filter
			const { filter: filterString }: { filter?: string } = req.query;
			let requestFilter = {};
			try {
				requestFilter = filterString ? JSON.parse(filterString) : undefined;
			} catch (err) {
				res.status(400).send(`${filterString} is not a valid filter`);
				logger.error(err);
				throw err;
			}

			// query GQL Arranger
			// version 2.19 does not have direct access to Arranger apis directly
			const gqlQuery = JSON.stringify({
				query: `
				query test($filters: JSON) {
					file {
    				hits(filters: $filters) {
      				total
							edges {
								node {
									has_clinical_data
									donors {
										hits {
											edges {
												node {
													donor_id
												}
											}
										}
									}
								}
							}
    				}
					}
				}`,
				variables: { filters: requestFilter },
			});
			const url = urljoin(ADVERTISED_HOST, '/graphql');
			const response = await fetch(url, {
				method: 'post',
				headers: { Authorization: `Bearer ${egoJwt}`, 'Content-Type': 'application/json' },
				body: gqlQuery,
			});
			const data = await response.json();

			const donorIdPath = 'node.donors.hits.edges[0].node.donor_id';
			const donorEdgePath = 'data.file.hits.edges';
			const records = get(data, donorEdgePath, undefined);
			if (!records) {
				res.status(200).send(`No records available.`);
			}

			const uniqueDonors: string[] = Array.from(
				new Set(records.map((record: Record<string, unknown>) => get(record, donorIdPath))),
			);

			console.log('donors', uniqueDonors);

			// Return all files in a zip with a manifest
			const filename = `clinical_data_${Date.now()}`;
			try {
				const response = await downloadDonorTsv(clinicalAuthClient, uniqueDonors);
				res
					.status(200)
					.contentType('application/octet-stream')
					.setHeader('content-disposition', `filename=${filename}.zip`);
				return res.send(response);
			} catch (e) {
				logger.error(`Error retrieving clinical donor data from clinical-service ${e}`);
				return res.status(500).json({
					error: e.message || 'An unexpected error occurred retrieving clinical file data.',
				});
			}
		} catch (e) {
			logger.error(`[clinical-routes] /donors/data-for-all-files: unexpected error occurred: ${e}`);
			return res.status(500).json({
				error: e.message || 'An unexpected error occurred retrieving clinical file data.',
			});
		}
	});

	return router;
};

export default createClincalApiRouter;
