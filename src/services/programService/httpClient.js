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

import { programServicePublicErrorResponseHandler } from '../../utils/restUtils';

const { PROGRAM_SERVICE_HTTP_ROOT } = require('config');

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

const formatPrivateProgram = (program) => ({});

const formatPrivateProgramList = (programList) => programList.map(formatPrivateProgram);
//private fields
export const listPrograms = async (jwt = null) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/programs`;
	return await fetch(url, {
		method: 'get',
		headers: {
			Authorization: `Bearer ${jwt}`,
		},
	})
		.then(programServicePublicErrorResponseHandler)
		.then((response) => response.json())
		.then((data) => {
			if (data && Array.isArray(data.programs)) {
				return formatPrivateProgramList(data.programs);
			} else {
				console.log('Error: no data is returned from /programs');
				throw new Error('Unable to retrieve programs data.');
			}
		});
};

// public fields
export const getProgramPublicFields = async (programShortName) => {
	const url = `${PROGRAM_SERVICE_HTTP_ROOT}/public/program?name=${programShortName}`;
	return await fetch(url, {
		method: 'get',
	})
		.then(programServicePublicErrorResponseHandler)
		.then((response) => response.json())
		.then(formatPublicProgram);
};
