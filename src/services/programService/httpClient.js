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
	const objTemplate = {
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

	delete objTemplate.program.programInstitutions;
	delete objTemplate.program.programCountries;
	delete objTemplate.program.programCancers;
	delete objTemplate.program.programPrimarySites;
	return objTemplate;
};

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
			console.log('data!!!!!!', data);
		})
		.then((data) => {
			if (data && Array.isArray(data.programs)) {
				return formatPrivateProgramList(data.programs);
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
			if (data.program) {
				return formatPrivateProgram(data.program);
			} else {
				console.log('Error: no data is returned from /program/{shortName}');
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
