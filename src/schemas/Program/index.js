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

import { makeExecutableSchema } from 'graphql-tools';
import { get, merge, pick } from 'lodash';
import typeDefs from './gqlTypeDefs';

import customScalars from 'schemas/customScalars';
import programService from 'services/programService';

/* =========
HTTP resolvers
 * ========= */

const resolvePrivateProgramList = async (egoToken) => {
	const response = await programService.listPrivatePrograms(egoToken);
	return response || null;
};

const resolvePrivateSingleProgram = async (egoToken, programShortName) => {
	const response = await programService.getPrivateProgram(egoToken, programShortName);
	return response || null;
};

const resolvePublicSingleProgram = async (programShortName) => {
	const response = await programService.getPublicProgram(programShortName);
	return response || null;
};

const programServicePrivateFields = [
	'commitmentDonors',
	'submittedDonors',
	'genomicDonors',
	'membershipType',
	'users',
	'dataCenter',
];

const resolvers = {
	ProgramOptions: {
		cancerTypes: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listCancers(egoToken);
			return response || null;
		},
		primarySites: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listPrimarySites(egoToken);
			return response || null;
		},
		institutions: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listInstitutions(egoToken);
			return response || null;
		},
		countries: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listCountries(egoToken);
			return response || null;
		},
		dataCenters: async (obj, args, context, info) => {
			return resolvers.Query.dataCenters(obj, args, context, info) || null;
		},
	},
	Program: {
		users: async (program, args, context, info) => {
			const { egoToken } = context;
			const users = await programService.listUsers(egoToken, program.shortName);
			return users || null;
		},
	},
	Query: {
		program: async (obj, args, context, info) => {
			const requestedFields = info.fieldNodes.flatMap((fieldNode) =>
				fieldNode.selectionSet.selections.map((selection) => selection.name.value),
			);
			const { egoToken } = context;
			const { shortName } = args;

			//create a condition to determine using either public or private endpoint
			const hasPrivateField = requestedFields.some((field) => programServicePrivateFields.includes(field));

			const program = hasPrivateField
				? await resolvePrivateSingleProgram(egoToken, shortName)
				: await resolvePublicSingleProgram(shortName);

			return program;
		},

		programs: async (obj, args, context) => {
			const { egoToken } = context;
			const { dataCenter } = args;

			const programs = await resolvePrivateProgramList(egoToken);

			const filteredPrograms = dataCenter
				? programs.filter((program) => program.dataCenter?.shortName === dataCenter)
				: programs;

			return filteredPrograms;
		},

		joinProgramInvite: async (obj, args, context, info) => {
			const response = await programService.getJoinProgramInvite(args.id);
			return response || null;
		},
		programOptions: () => ({}),
		dataCenters: async (obj, args, context, info) => {
			const { egoToken } = context;
			const shortName = get(args, 'shortName', null);
			const response = await programService.listDataCenters(shortName, egoToken);
			return response || null;
		},
	},
	Mutation: {
		createProgram: async (obj, args, context, info) => {
			const { egoToken } = context;

			// Submitted and Genomic donors are not part of input, need to be set to 0 to start.
			const program = {
				...get(args, 'program', {}),
				submittedDonors: 0,
				genomicDonors: 0,
			};

			const createResponse = await programService.createProgram(program, egoToken);
			return resolvePrivateSingleProgram(egoToken, program.shortName);
		},

		updateProgram: async (obj, args, context, info) => {
			// extract information from query parameters
			const { egoToken } = context;
			const { shortName: programShortName } = args;
			const updates = args.updates;

			//make a request to get dataCenter data using dataCenterShortName (from query paramenter, updates) and format response
			const dataCenterResponse = updates.dataCenter
				? await programService.listDataCenters(undefined, egoToken, updates.dataCenter)
				: undefined;

			const dataCenter =
				dataCenterResponse && Array.isArray(dataCenterResponse)
					? pick(dataCenterResponse[0], ['id', 'shortName', 'name', 'uiUrl', 'gatewayUrl'])
					: {};

			// // Update program takes the complete program object future state
			const currentProgramResponse = await programService.getPrivateProgram(egoToken, programShortName);

			//prepare the payload for the fetch endpoint from the previous steps
			const combinedUpdates = {
				...currentProgramResponse,
				...updates,
				dataCenter,
			};

			//make a request to the PUT updateProgram endpoint with the formatted payload
			const response = await programService.updateProgram(combinedUpdates, egoToken);

			return response === 200 ? programShortName : null;
		},

		inviteUser: async (obj, args, context, info) => {
			const { egoToken } = context;
			const invite = get(args, 'invite', {});
			const response = await programService.inviteUser(invite, egoToken);
			return response || null;
		},

		joinProgram: async (obj, args, context, info) => {
			const { egoToken } = context;
			const joinProgramInput = get(args, 'join', {});
			const response = await programService.joinProgram(joinProgramInput, egoToken);
			return response || null;
		},

		updateUser: async (obj, args, context, info) => {
			const { egoToken } = context;
			const shortName = get(args, 'programShortName');
			const role = get(args, 'userRole');
			const userEmail = get(args, 'userEmail');
			const input = { shortName, role, userEmail };
			const response = await programService.updateUser(input, egoToken);
			return true;
		},

		removeUser: async (obj, args, context, info) => {
			const { egoToken } = context;
			const programShortName = get(args, 'programShortName');
			const userEmail = get(args, 'userEmail');
			const input = { programShortName, userEmail };
			const response = await programService.removeUser(input, egoToken);
			return get(response, 'message', '');
		},
	},
};

merge(resolvers, customScalars);

export default makeExecutableSchema({
	typeDefs,
	resolvers,
});
