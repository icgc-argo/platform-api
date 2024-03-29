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

import { AuthenticationError } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { FileUpload } from 'graphql-upload';
import get from 'lodash/get';

import { GlobalGqlContext } from 'app';
import egoTokenUtils from 'utils/egoTokenUtils';

import clinicalService from '../../services/clinical';

import typeDefs from './gqlTypeDefs';

const ARRAY_DELIMETER_CHAR = '|';

function convertToString(val: unknown) {
	return val === undefined || val === null ? '' : `${val}`;
}

function normalizeValue(val: unknown) {
	if (Array.isArray(val)) {
		return val.map(convertToString).join(ARRAY_DELIMETER_CHAR);
	}
	return convertToString(val);
}

const convertRegistrationStatsToGql = (
	statsEntry: {
		submitterId: string;
		rowNumbers: (string | number)[];
	}[],
) => {
	const output = {
		count: 0,
		rows: [] as (string | number)[],
		names: [] as string[],
		values: [] as { name: string; rows: (string | number)[] }[],
	};
	const names = statsEntry.map((se) => se.submitterId) || ([] as string[]);
	output.count = names.length;
	names.forEach((name) => {
		output.names.push(name);
		const rows = statsEntry.find((se) => se.submitterId == name)?.rowNumbers || [];
		rows.forEach((row) => !output.rows.includes(row) && output.rows.push(row));
		output.values.push({ name, rows });
	});

	return output;
};

type RegistrationErrorData = ErrorData & {
	info: {
		value: string;
		sampleSubmitterId: string;
		donorSubmitterId: string;
		specimenSubmitterId: string;
	};
};
const convertRegistrationErrorToGql = (errorData: RegistrationErrorData) => ({
	type: errorData.type,
	message: errorData.message,
	row: errorData.index,
	field: errorData.fieldName,
	value: normalizeValue(errorData.info.value),
	sampleId: errorData.info.sampleSubmitterId,
	donorId: errorData.info.donorSubmitterId,
	specimenId: errorData.info.specimenSubmitterId,
});

const convertRegistrationDataToGql = (
	programShortName: string,
	data: {
		registration: {
			_id: string;
			creator: string;
			batchName: string;
			createdAt: string | number;
			records: EntityDataRecord[];
		};
		errors?: RegistrationErrorData[];
		batchErrors?: unknown[];
	},
) => {
	const registration = get(data, 'registration', {} as Partial<typeof data.registration>);
	const schemaAndValidationErrors = get(data, 'errors', [] as typeof data.errors);
	const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
	return {
		id: registration._id || null,
		programShortName,
		creator: registration.creator || null,
		fileName: registration.batchName || null,
		createdAt: registration.createdAt || null,
		records: () =>
			get(registration, 'records', [] as Required<typeof registration>['records']).map(
				(record, i) => convertClinicalRecordToGql(i, record),
			),
		errors: schemaAndValidationErrors?.map(convertRegistrationErrorToGql),
		fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
		newDonors: () => convertRegistrationStatsToGql(get(registration, 'stats.newDonorIds', [])),
		newSpecimens: () =>
			convertRegistrationStatsToGql(get(registration, 'stats.newSpecimenIds', [])),
		newSamples: () => convertRegistrationStatsToGql(get(registration, 'stats.newSampleIds', [])),
		alreadyRegistered: () =>
			convertRegistrationStatsToGql(get(registration, 'stats.alreadyRegistered', [])),
	};
};

const convertClinicalSubmissionDataToGql = (
	programShortName: string,
	data: {
		submission: {
			_id: string;
			state: string;
			version: string;
			updatedBy: string;
			updatedAt: string;
			clinicalEntities: { [k: string]: SubmissionEntity };
		};
		batchErrors?: unknown[];
	},
) => {
	const submission = get(data, 'submission', {} as Partial<typeof data.submission>);
	const fileErrors = get(data, 'batchErrors', [] as typeof data.batchErrors);
	const clinicalEntities = get(
		submission,
		'clinicalEntities',
		{} as typeof data.submission.clinicalEntities,
	);

	return {
		id: submission._id || null,
		programShortName,
		state: submission.state || null,
		version: submission.version || null,
		updatedBy: submission.updatedBy || null,
		updatedAt: submission.updatedAt ? new Date(submission.updatedAt) : null,
		clinicalEntities: async () => {
			const clinicalSubmissionTypeList = await clinicalService.getClinicalSubmissionTypesList();
			const filledClinicalEntities = clinicalSubmissionTypeList.map((clinicalType) => ({
				clinicalType,
				...(clinicalEntities[clinicalType] || {}),
			}));
			return filledClinicalEntities.map((clinicalEntity) =>
				convertClinicalSubmissionEntityToGql(clinicalEntity.clinicalType, clinicalEntity),
			);
		},
		fileErrors: fileErrors?.map(convertClinicalFileErrorToGql),
	};
};

// GQL Formatting
type EntityDisplayRecord = { name: string; value: string };

// Generic Record
type EntityDataRecord = { [k: string]: any; donor_id?: number };

// FE Query Response Payload
type ClinicalEntityData = {
	programShortName: string;
	clinicalEntities: ClinicalEntityRecord[];
	clinicalErrors?: ClinicalErrors;
};

// FE Search Query Response Payload
type ClinicalSearchData = {
	programShortName: string;
	searchResults: ClinicalEntityRecord[];
	totalResults: number;
};

// Response from Sevice
type ClinicalResponseData = {
	clinicalEntities: ClinicalEntityRecord[];
};

type ClinicalErrors = {
	donorId: number;
	submitterDonorId: string;
	errors: ClinicalErrorRecord[];
}[];

// Entity Data
interface ClinicalEntityRecord {
	entityName: string;
	totalDocs: number;
	records: EntityDisplayRecord[][] | EntityDataRecord[];
	entityFields: string[];
	completionStats?: CompletionStats[];
}

// Query Arguments
type ClinicalVariables = {
	programShortName: string;
	filters: {
		entityTypes: string[];
		page: number;
		pageSize: number;
		donorIds: number[];
		submitterDonorIds: string[];
		completionState: string;
		sort: string;
	};
};

enum CoreClinicalEntities {
	donor = 'donor',
	specimens = 'specimens',
	primaryDiagnosis = 'primaryDiagnosis',
	followUps = 'followUps',
	treatments = 'treatments',
	familyHistory = 'familyHistory',
}

type CompletionStats = {
	coreCompletion: CoreCompletionFields;
	coreCompletionDate: string;
	coreCompletionPercentage: number;
	overriddenCoreCompletion: [CoreClinicalEntities];
	donorId: number;
	entityData: CompletionEntityData;
};

type CompletionEntityData = {
	specimens: SpecimenCoreCompletion;
};

type SpecimenCoreCompletion = {
	coreCompletionPercentage: number;
	normalSpecimensPercentage: number;
	tumourSpecimensPercentage: number;
	normalRegistrations: number;
	normalSubmissions: number;
	tumourRegistrations: number;
	tumourSubmissions: number;
};

type CoreCompletionFields = {
	donor: number;
	specimens: number;
	primaryDiagnosis: number;
	followUps: number;
	treatments: number;
	tumourSpecimens?: number;
	normalSpecimens?: number;
};

interface ClinicalEntityRecord {
	entityName: string;
	totalDocs: number;
	records: EntityDisplayRecord[][] | EntityDataRecord[];
	entityFields: string[];
	completionStats?: CompletionStats[];
}

type ClinicalErrorRecord = {
	entityName: string;
	errorType: string;
	fieldName: string;
	message: string;
	index: number;
	info: { value: string[]; message?: string };
};

const convertClinicalDataToGql = (
	programShortName: string,
	clinicalEntities: ClinicalEntityRecord[],
) => {
	const clinicalDisplayData: ClinicalEntityRecord[] = clinicalEntities.map(
		(entity: ClinicalEntityRecord) => {
			const records: EntityDisplayRecord[][] = [];

			entity.records.forEach((record: EntityDataRecord) => {
				const displayRecords: EntityDisplayRecord[] = [];
				for (const [key, val] of Object.entries(record)) {
					const name = key === 'submitter_id' ? false : key;
					const value = name && Array.isArray(val) ? val.join(', ') : val;
					if (name) displayRecords.push({ name, value });
				}
				records.push(displayRecords);
			});

			const entityData: ClinicalEntityRecord = {
				...entity,
				records,
			};

			return entityData;
		},
	);

	const clinicalData = {
		programShortName,
		clinicalEntities: clinicalDisplayData,
	};

	return clinicalData;
};

const convertClinicalFileErrorToGql = (fileError: {
	message: string;
	batchNames: string[];
	code: string;
}) => {
	return {
		message: fileError.message,
		fileNames: fileError.batchNames,
		code: fileError.code,
	};
};

type SubmissionEntity = {
	batchName: string;
	creator: string;
	records: EntityDataRecord[];
	stats: unknown;
	dataUpdates: UpdateData[];
	schemaErrors: ErrorData[];
	dataErrors: ErrorData[];
	dataWarnings: ErrorData[];
	createdAt: string | number;
};

const convertClinicalSubmissionEntityToGql = (clinicalType: string, entity: SubmissionEntity) => {
	return {
		clinicalType,
		batchName: entity.batchName || null,
		creator: entity.creator || null,
		records: () =>
			get(entity, 'records', [] as typeof entity.records).map((record, index) =>
				convertClinicalRecordToGql(index, record),
			),
		stats: entity.stats || null,
		schemaErrors: () => {
			const entityErrors = entity.schemaErrors || [];
			return entityErrors.map((error) =>
				convertClinicalSubmissionSchemaErrorToGql(clinicalType, error),
			);
		},
		dataErrors: () =>
			get(entity, 'dataErrors', [] as typeof entity.dataErrors).map((error: ErrorData) =>
				convertClinicalSubmissionDataErrorToGql(error),
			),
		dataWarnings: () =>
			get(entity, 'dataWarnings', [] as typeof entity.dataWarnings).map((warning: ErrorData) =>
				convertClinicalSubmissionDataErrorToGql(warning),
			),
		dataUpdates: () =>
			get(entity, 'dataUpdates', [] as typeof entity.dataUpdates).map((update) =>
				convertClinicalSubmissionUpdateToGql(update),
			),
		createdAt: entity.createdAt ? new Date(entity.createdAt) : null,
	};
};

const convertClinicalRecordToGql = (index: number | string, record: EntityDataRecord) => {
	const fields = [];
	for (const field in record) {
		const value = normalizeValue(record[field]);
		fields.push({ name: field, value: value });
	}
	return {
		row: index,
		fields: fields,
	};
};

type ErrorData = {
	type: string;
	message: string;
	index: number | string;
	fieldName: string;
};
const convertClinicalSubmissionDataErrorToGql = (errorData: ErrorData) => {
	// errorData.info.value may come back as null if not provided in uploaded file
	const errorValue = get(errorData, 'info.value', '') || '';
	return {
		type: errorData.type,
		message: errorData.message,
		row: errorData.index,
		field: errorData.fieldName,
		donorId: get(errorData, 'info.donorSubmitterId', '') || '',
		value: normalizeValue(errorValue),
	};
};

const convertClinicalSubmissionSchemaErrorToGql = (
	clinicalType: unknown,
	errorData: ErrorData,
) => ({
	...convertClinicalSubmissionDataErrorToGql(errorData),
	clinicalType,
});

type UpdateData = {
	index: string | number;
	fieldName: string;
	info: {
		newValue: unknown;
		oldValue: unknown;
		donorSubmitterId: string;
	};
};
const convertClinicalSubmissionUpdateToGql = (updateData: UpdateData) => {
	return {
		row: updateData.index,
		field: updateData.fieldName,
		newValue: normalizeValue(updateData.info.newValue),
		oldValue: normalizeValue(updateData.info.oldValue),
		donorId: updateData.info.donorSubmitterId,
	};
};

const resolvers = {
	Query: {
		clinicalRegistration: async (
			obj: unknown,
			args: { shortName: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { shortName } = args;

			const response = await clinicalService.getRegistrationData(shortName, Authorization);
			return convertRegistrationDataToGql(shortName, {
				registration: response,
			});
		},
		clinicalData: async (
			obj: unknown,
			args: ClinicalVariables,
			context: GlobalGqlContext,
		): Promise<ClinicalEntityData> => {
			const { Authorization } = context;
			const { programShortName } = args;
			const { clinicalEntities }: ClinicalResponseData = await clinicalService.getClinicalData(
				args,
				Authorization,
			);

			const formattedEntityData: ClinicalEntityData = convertClinicalDataToGql(
				programShortName,
				clinicalEntities,
			);

			return formattedEntityData;
		},
		clinicalErrors: async (
			obj: unknown,
			args: { programShortName: string; donorIds?: number[] },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;

			const errorResponse: ClinicalErrors = await clinicalService.getClinicalErrors(
				args.programShortName,
				args.donorIds,
				Authorization,
			);

			return errorResponse;
		},
		clinicalSearchResults: async (
			obj: unknown,
			args: ClinicalVariables,
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName } = args;
			const searchResults: ClinicalSearchData = (await clinicalService.getClinicalSearchResults(
				args,
				Authorization,
			)) || { searchResults: [] };

			return { ...searchResults, programShortName };
		},
		clinicalSubmissions: async (
			obj: unknown,
			args: { programShortName: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName } = args;

			const response = await clinicalService.getClinicalSubmissionData(
				programShortName,
				Authorization,
			);
			return convertClinicalSubmissionDataToGql(programShortName, {
				submission: response,
			});
		},
		clinicalSubmissionTypesList: async (obj: unknown, args: {}, context: GlobalGqlContext) => {
			return await clinicalService.getClinicalSubmissionTypesList();
		},
		clinicalSubmissionSchemaVersion: async (obj: unknown, args: {}, context: GlobalGqlContext) => {
			return await clinicalService.getClinicalSubmissionSchemaVersion();
		},
		clinicalSubmissionSystemDisabled: async (obj: unknown, args: {}, context: GlobalGqlContext) => {
			return await clinicalService.getClinicalSubmissionSystemDisabled();
		},
	},
	Mutation: {
		uploadClinicalRegistration: async (
			obj: unknown,
			args: {
				shortName: string;
				registrationFile: FileUpload;
			},
			context: GlobalGqlContext,
		) => {
			const { Authorization, egoToken } = context;
			const { shortName, registrationFile } = args;
			const permissions = egoTokenUtils.getPermissionsFromToken(egoToken);
			// Here we are confirming that the user has at least some ability to write Program Data
			// This is to reduce the opportunity for spamming the gateway with file uploads
			if (!egoTokenUtils.canWriteSomeProgramData(permissions)) {
				throw new AuthenticationError('User is not authorized to write data');
			}

			const { filename, createReadStream } = await registrationFile;
			const fileStream = createReadStream();

			// try {
			const response = await clinicalService.uploadRegistrationData(
				shortName,
				filename,
				fileStream,
				Authorization,
			);

			return convertRegistrationDataToGql(shortName, response);
		},
		clearClinicalRegistration: async (
			obj: unknown,
			args: {
				shortName: string;
				registrationId: string;
			},
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { shortName, registrationId } = args;
			const response = await clinicalService.clearRegistrationData(
				shortName,
				registrationId,
				Authorization,
			);
			return true;
		},
		commitClinicalRegistration: async (
			obj: unknown,
			args: { shortName: string; registrationId: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { shortName, registrationId } = args;
			const response = await clinicalService.commitRegistrationData(
				shortName,
				registrationId,
				Authorization,
			);
			return get(response, 'newSamples', []);
		},
		uploadClinicalSubmissions: async (
			obj: unknown,
			args: { programShortName: string; clinicalFiles: Array<FileUpload> },
			context: GlobalGqlContext,
		) => {
			const { Authorization, egoToken } = context;
			const { programShortName, clinicalFiles } = args;
			const permissions = egoTokenUtils.getPermissionsFromToken(egoToken);

			// see reason in uploadRegistration
			if (!egoTokenUtils.canWriteSomeProgramData(permissions)) {
				throw new AuthenticationError('User is not authorized to write data');
			}

			const filesMap: {
				[k: string]: ReturnType<FileUpload['createReadStream']>;
			} = {};

			await Promise.all(clinicalFiles).then((val) =>
				val.forEach((file) => (filesMap[file.filename] = file.createReadStream())),
			);
			const response = await clinicalService.uploadClinicalSubmissionData(
				programShortName,
				filesMap,
				Authorization,
			);
			return convertClinicalSubmissionDataToGql(programShortName, response);
		},
		clearClinicalSubmission: async (
			obj: unknown,
			args: { programShortName: string; fileType: string; version: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName, fileType, version } = args;

			const response = await clinicalService.clearClinicalSubmissionData(
				programShortName,
				version,
				fileType || 'all',
				Authorization,
			);

			return convertClinicalSubmissionDataToGql(programShortName, {
				submission: response,
			});
		},
		validateClinicalSubmissions: async (
			obj: unknown,
			args: { programShortName: string; version: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName, version } = args;
			const response = await clinicalService.validateClinicalSubmissionData(
				programShortName,
				version,
				Authorization,
			);
			return convertClinicalSubmissionDataToGql(programShortName, response);
		},
		commitClinicalSubmission: async (
			obj: unknown,
			args: { programShortName: string; version: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName, version } = args;
			const response = await clinicalService.commitClinicalSubmissionData(
				programShortName,
				version,
				Authorization,
			);
			return convertClinicalSubmissionDataToGql(programShortName, {
				submission: response,
			});
		},
		reopenClinicalSubmission: async (
			obj: unknown,
			args: { programShortName: string; version: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName, version } = args;
			const response = await clinicalService.reopenClinicalSubmissionData(
				programShortName,
				version,
				Authorization,
			);
			return convertClinicalSubmissionDataToGql(programShortName, {
				submission: response,
			});
		},
		approveClinicalSubmission: async (
			obj: unknown,
			args: { programShortName: string; version: string },
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const { programShortName, version } = args;
			const response = await clinicalService.approveClinicalSubmissionData(
				programShortName,
				version,
				Authorization,
			);
			return response ? true : false;
		},
	},
	ClinicalData: {
		clinicalErrors: async (
			parent: ClinicalEntityData,
			_: ClinicalVariables,
			context: GlobalGqlContext,
		) => {
			const { Authorization } = context;
			const donorIds: Set<string> = new Set();

			parent.clinicalEntities.forEach((entity) =>
				entity.records.forEach((displayRecord: EntityDisplayRecord[]) => {
					const donor = displayRecord.find(({ name }) => name === 'donor_id');
					if (donor && donor.value) {
						donorIds.add(donor.value);
					}
				}),
			);

			const { clinicalErrors }: { clinicalErrors: ClinicalErrors } = await clinicalService
				.getClinicalErrors(parent.programShortName, Array.from(donorIds), Authorization)
				.then((clinicalErrors) => clinicalErrors);

			return clinicalErrors;
		},
	},
};

export default makeExecutableSchema({
	typeDefs,
	resolvers,
	resolverValidationOptions: {
		requireResolversForResolveType: false,
	},
});
