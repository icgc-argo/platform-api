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

import { PROGRAM_SERVICE_HTTP_ROOT } from '../../config';
import { restErrorResponseHandler } from '../../utils/restUtils';

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

const formatPrivateProgram = (program) => {
	return program.program;
};

const formatPrivateProgramList = (programList) => programList.map(formatPrivateProgram);

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
		email: userItem.user?.email,
		firstName: userItem.user.first_name,
		lastName: userItem.user.last_name,
		role: userItem.user.role.value,
		isDacoApproved: userItem.dacoApproved,
		inviteStatus: userItem.status?.value,
		inviteAcceptedAt: new Date(userItem.acceptedAt),
	}));

//this data formatter is used on multiple lists, such as listCancers, listPrimarySites, listInstitutions, listCountries
const formatAndSortMultipleLists = (cancersList) =>
	cancersList.map((cancerItem) => cancerItem.name).sort();

//private fields
export const listPrivatePrograms = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatPrivateProgramList(data);
			} else {
				console.log('Error: no data is returned from /programs');
				throw new Error('Unable to retrieve programs data.');
			}
		});
};

export const getPrivateProgram = async (jwt = null, programShortName) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/${programShortName}`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data) {
				return formatPrivateProgram(data);
			} else {
				console.log('Error: no data is returned from /programs/{shortName}');
				throw new Error('Unable to retrieve program data.');
			}
		});
};

export const getJoinProgramInvite = async (jwt = null, id) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/joinProgramInvite/${id}`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data.invitation) {
				return formatJoinProgramInvite(data.invitation);
			} else {
				console.log('Error: no data is returned from /programs/joinProgramInvite/{invite_id}');
				throw new Error('Unable to retrieve joinProgramInvite data.');
			}
		});
};

export const listUsers = async (jwt = null, programShortName) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/users/${programShortName}`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatUsersList(data);
			} else {
				console.log('Error: no data is returned from /programs/users/{shortName}');
				throw new Error('Unable to retrieve users data.');
			}
		});
};

export const listCancers = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/cancers`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				console.log('Error: no data is returned from /programs/cancers');
				throw new Error('Unable to retrieve cancers data.');
			}
		});
};

export const listInstitutions = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/institutions`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				console.log('Error: no data is returned from /programs/institutions');
				throw new Error('Unable to retrieve institutions data.');
			}
		});
};

export const listPrimarySites = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/primarySites`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				console.log('Error: no data is returned from /programs/primarySites');
				throw new Error('Unable to retrieve primarySites data.');
			}
		});
};

export const listRegions = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/regions`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				console.log('Error: no data is returned from /programs/regions');
				throw new Error('Unable to retrieve regions data.');
			}
		});
};

export const listCountries = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs/countries`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data)) {
				return formatAndSortMultipleLists(data);
			} else {
				console.log('Error: no data is returned from /programs/countries');
				throw new Error('Unable to retrieve countries data.');
			}
		});
};

export const createProgram = async (program, jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs`;
	const formattedProgram = {
		program: {
			short_name: program.shortName,
			description: program.description,
			name: program.name,
			membership_type: { value: program.membershipType },
			commitment_donors: program.commitmentDonors,
			submitted_donors: program.submittedDonors,
			genomic_donors: program.genomicDonors,
			website: program.website,
			cancer_types: program.cancerTypes,
			primary_sites: program.primarySites,
			institutions: program.institutions,
			countries: program.countries,
		},
		admins: program.admins.map((admin) => ({
			email: admin.email,
			first_name: admin.firstName,
			last_name: admin.lastName,
			role: { value: admin.role },
		})),
	};
	return await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${jwt}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formattedProgram),
	})
		.then(restErrorResponseHandler)
		.then((response) => response.body);
};

// public fields
export const getPublicProgram = async (programShortName) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/public/program?name=${programShortName}`;
	return await fetch(url, {
		method: 'get',
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then(formatPublicProgram);
};
