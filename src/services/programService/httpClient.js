/*
 * Copyright (c) 2022 The Ontario Institute for Cancer Research. All rights reserved
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

/*
 * This file dynamically generates a gRPC client from Ego.proto.
 * The content of Ego.proto is copied directly from: https://github.com/icgc-argo/argo-proto/blob/4e2aeda59eb48b7af20b462aef2f04ef5d0d6e7c/ProgramService.proto
 */

import fetch from 'node-fetch';
import urljoin from 'url-join';

import logger from 'utils/logger';

import { PROGRAM_SERVICE_HTTP_ROOT } from '../../config';
import { restErrorResponseHandler } from '../../utils/restUtils';

import authorizationHeader from './utils/authorizationHeader';

//data formatters
const formatPublicProgram = (program) => ({
	name: program.name,
	shortName: program.shortName,
	description: program.description,
	website: program.website,
	institutions: program.programInstitutions?.map((institution) => institution.name) || [],
	countries: program.programCountries?.map((country) => country.name) || [],
	regions: program.processingRegions?.map((region) => region.name) || [],
	cancerTypes: program.programCancers?.map((cancer) => cancer.name) || [],
	primarySites: program.programPrimarySites?.map((primarySite) => primarySite.name) || [],
});

const formatPrivateProgram = (program) => program.program;
const formatPrivateProgramList = (programList) => programList.map(formatPrivateProgram);

const getDataCenterByShortName = (shortName, dataCenterResponse) =>
	dataCenterResponse.filter((dataCenterObject) => dataCenterObject.shortName === shortName);

const formatJoinProgramInvite = (invitation) => {
	const formattedObj = {
		...invitation,
		createdAt: new Date(invitation.createdAt),
		expiresAt: new Date(invitation.expiresAt),
		acceptedAt: new Date(invitation.acceptedAt),
		user: { ...invitation.user, role: invitation.user.role.value },
		program: {
			...invitation.program,
			institutions: invitation.program.programInstitutions,
			countries: invitation.program.programCountries,
			cancerTypes: invitation.program.programCancers,
			primarySite: invitation.program.programPrimarySites,
		},
	};

	delete formattedObj.program.programInstitutions;
	delete formattedObj.program.programCountries;
	delete formattedObj.program.programCancers;
	delete formattedObj.program.programPrimarySites;
	return formattedObj;
};

const formatUsersList = (usersList) =>
	usersList.map((userItem) => ({
		email: userItem.user.email,
		firstName: userItem.user.first_name,
		lastName: userItem.user.last_name,
		role: userItem.user.role.value,
		isDacoApproved: userItem.dacoApproved,
		inviteStatus: userItem.status?.value,
		inviteAcceptedAt: new Date(userItem.acceptedAt),
	}));

const formatCreateProgramInput = (programInput) => ({
	program: {
		short_name: programInput.shortName,
		description: programInput.description,
		name: programInput.name,
		membership_type: { value: programInput.membershipType },
		commitment_donors: programInput.commitmentDonors,
		submitted_donors: programInput.submittedDonors,
		genomic_donors: programInput.genomicDonors,
		website: programInput.website,
		cancer_types: programInput.cancerTypes,
		primary_sites: programInput.primarySites,
		institutions: programInput.institutions,
		countries: programInput.countries,
	},
	admins: programInput.admins.map((admin) => ({
		email: admin.email,
		first_name: admin.firstName,
		last_name: admin.lastName,
		role: { value: admin.role },
	})),
});

const formatInviteUserInput = (userInput) => ({
	programShortName: userInput.programShortName,
	firstName: userInput.userFirstName,
	lastName: userInput.userLastName,
	email: userInput.userEmail,
	role: {
		value: userInput.userRole,
	},
});

const formatJoinProgramInput = (joinProgramInput) => ({
	join_program_invitation_id: joinProgramInput.invitationId,
	institute: joinProgramInput.institute,
	affiliate_pi_first_name: joinProgramInput.piFirstName,
	affiliate_pi_last_name: joinProgramInput.piLastName,
	department: joinProgramInput.department,
});

const formatJoinProgramResponse = (joinProgramResponse) => ({
	...joinProgramResponse.user,
	role: joinProgramResponse.user.role.value,
});

const formatUpdateUserInput = (updateUserInput) => ({
	shortName: updateUserInput.shortName,
	userEmail: updateUserInput.userEmail,
	role: { value: updateUserInput.role },
});

const formatDeleteUserInput = (deleteUserInput) => ({
	programShortName: deleteUserInput.programShortName,
	userEmail: deleteUserInput.userEmail,
});

//this data formatter is used on multiple lists, such as listCancers, listPrimarySites, listInstitutions, listCountries
const formatAndSortMultipleLists = (cancersList) =>
	cancersList.map((cancerItem) => cancerItem.name).sort();

//private fields
export const listPrivatePrograms = async (jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatPrivateProgramList(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs. Data must be an array.',
				);
				throw new Error(
					'no data or wrong data type is returned from GET /programs. Data must be an array.',
				);
			}
		});
};

export const getPrivateProgram = async (jwt = null, programShortName) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/${programShortName}`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data) {
				return formatPrivateProgram(data);
			} else {
				logger.error('Error: no data is returned from GET /program/{shortName}.');
				throw new Error('No data is returned from GET /program/{shortName}.');
			}
		});
};

export const getJoinProgramInvite = async (id) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/joinProgramInvite/${id}`);
	return await fetch(url, {
		method: 'get',
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data.invitation) {
				return formatJoinProgramInvite(data.invitation);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs/joinProgramInvite/{invite_id}. Data must be an object with a property of "invitation".',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /programs/joinProgramInvite/{invite_id}. Data must be an object with a property of "invitation".',
				);
			}
		});
};

export const listUsers = async (jwt = null, programShortName) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `programs/users/${programShortName}`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatUsersList(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs/users/{shortName}. Data must be an array',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /programs/users/{shortName}. Data must be an array.',
				);
			}
		});
};

export const listCancers = async (jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/cancers`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs/cancers. Data must be an array.',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /programs/cancers. Data must be an array.',
				);
			}
		});
};

export const listInstitutions = async (jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/institutions`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs/institutions. Data must be an array.',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /programs/institutions. Data must be an array.',
				);
			}
		});
};

export const listPrimarySites = async (jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/primarySites`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs/primarySites. Data must be an array.',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /programs/primarySites. Data must be an array.',
				);
			}
		});
};

export const listRegions = async (jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/regions`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from /programs/regions. Data must be an array.',
				);
				throw new Error('Unable to retrieve regions data.');
			}
		});
};

export const listCountries = async (jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/countries`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /programs/countries. Data must be an array.',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /programs/countries. Data must be an array.',
				);
			}
		});
};

export const listDataCenters = async (shortName, jwt) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/datacenters`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return shortName ? getDataCenterByShortName(shortName, data) : data;
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from GET /datacenters. Data must be an array.',
				);
				throw new Error(
					'No data or wrong data type is returned from GET /datacenters. Data must be an array.',
				);
			}
		});
};

export const createProgram = async (programInput, jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs`);
	const formattedProgram = formatCreateProgramInput(programInput);
	return await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: authorizationHeader(jwt),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formattedProgram),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.body);
};

//need endpoint to do testing #TODO
export const updateProgram = async (programInput, jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs`);
	return await fetch(url, {
		method: 'PUT',
		headers: {
			Authorization: authorizationHeader(jwt),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(programInput),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.body);
};

export const inviteUser = async (userInput, jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/users`);
	const formattedUserInput = formatInviteUserInput(userInput);
	return await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: authorizationHeader(jwt),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formattedUserInput),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data.inviteId) {
				return userInput.userEmail;
			} else {
				logger.error(
					'Error: user invite is unsuccessful. POST /programs/users did not return anything. Ensure short name follow its format',
				);
				throw new Error(
					'user invite is unsuccessful. POST /programs/users did not return anything. Ensure short name follow its format',
				);
			}
		});
};

export const joinProgram = async (joinProgramInput, jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/join`);
	const formattedJoinProgramInput = formatJoinProgramInput(joinProgramInput);
	return await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: authorizationHeader(jwt),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formattedJoinProgramInput),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && data.user) {
				console.log('FETCH DATA!', data);
				return formatJoinProgramResponse(data);
			} else {
				logger.error(
					'Error: join program is unsuccessful. POST /programs/join did not return anything or did not return an object with a user property.',
				);
				throw new Error(
					'user invite is unsuccessful. POST /programs/join did not return anything or did not return an object with a user property.',
				);
			}
		});
};

export const updateUser = async (updateUserInput, jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/users`);
	const formattedUpdateUserInput = formatUpdateUserInput(updateUserInput);
	return await fetch(url, {
		method: 'PUT',
		headers: {
			Authorization: authorizationHeader(jwt),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formattedUpdateUserInput),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.body);
};

export const removeUser = async (deleteUserInput, jwt = null) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/users`);
	const formattedDeleteUserInput = formatDeleteUserInput(deleteUserInput);
	return await fetch(url, {
		method: 'DELETE',
		headers: {
			Authorization: authorizationHeader(jwt),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formattedDeleteUserInput),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data.message) {
				return data;
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from DELETE /programs/users. Data must be an object with a property of "message". No message is returned from the endpoint.',
				);
				throw new Error(
					'no data or wrong data type is returned from DELETE /programs/users. Data must be an object with a property of "message". No message is returned from the endpoint.',
				);
			}
		});
};

// public fields
export const getPublicProgram = async (programShortName) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `public/program?name=${programShortName}`);
	return await fetch(url, {
		method: 'get',
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then(formatPublicProgram);
};
