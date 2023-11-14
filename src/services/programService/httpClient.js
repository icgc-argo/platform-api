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

import { PROGRAM_SERVICE_HTTP_ROOT } from '../../config';
import { restErrorResponseHandler } from '../../utils/restUtils';

import authorizationHeader from './utils/authorizationHeader';

import logger from 'utils/logger';

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

const getDataCenterByShortName = (shortName, dataCenterResponse) =>
	dataCenterResponse.filter((dataCenterObject) => dataCenterObject.shortName === shortName);
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
					'Error: no data or wrong data type is returned from /programs. Data must be an array',
				);
				throw new Error(
					'no data or wrong data type is returned from /programs. Data must be an array',
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
				logger.error('Error: no data is returned from /program/{shortName}');
				throw new Error('No data is returned from /program/{shortName}');
			}
		});
};

export const getJoinProgramInvite = async (jwt = null, id) => {
	const url = urljoin(PROGRAM_SERVICE_HTTP_ROOT, `/programs/joinProgramInvite/${id}`);
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: authorizationHeader(jwt),
		},
	})
		.then(restErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data.invitation) {
				return formatJoinProgramInvite(data.invitation);
			} else {
				logger.error(
					'Error: no data or wrong data type is returned from /programs/joinProgramInvite/{invite_id}. Data must be an object with a property of "invitation"',
				);
				throw new Error(
					'No data or wrong data type is returned from /programs/joinProgramInvite/{invite_id}. Data must be an object with a property of "invitation"',
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
					'Error: no data or wrong data type is returned from /datacenters. Data must be an array',
				);
				throw new Error(
					'No data or wrong data type is returned from /datacenters. Data must be an array',
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
