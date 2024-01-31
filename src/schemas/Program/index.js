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

import { gql } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { get, merge, pickBy } from 'lodash';

import customScalars from 'schemas/customScalars';
import programService from 'services/programService';

const typeDefs = gql`
	scalar DateTime

	enum MembershipType {
		FULL
		ASSOCIATE
	}

	enum UserRole {
		COLLABORATOR
		ADMIN
		CURATOR
		SUBMITTER
		BANNED
	}

	enum InviteStatus {
		REVOKED
		PENDING
		ACCEPTED
		EXPIRED
	}

	type JoinProgramInvite {
		id: ID!
		createdAt: DateTime!
		expiresAt: DateTime!
		acceptedAt: DateTime
		program: Program!
		user: ProgramUser!
		emailSent: Boolean!
		status: InviteStatus!
	}

	type Program {
		shortName: String!
		description: String
		name: String
		commitmentDonors: Int
		submittedDonors: Int
		genomicDonors: Int
		website: String
		institutions: [String]
		countries: [String]
		regions: [String]
		cancerTypes: [String]
		primarySites: [String]
		dataCenter: DataCenter

		membershipType: MembershipType

		users: [ProgramUser]
	}

	type ProgramUser {
		email: String
		firstName: String
		lastName: String
		role: UserRole
		isDacoApproved: Boolean
		inviteStatus: InviteStatus
		inviteAcceptedAt: String
	}

	type ProgramOptions {
		cancerTypes: [String]!
		primarySites: [String]!
		institutions: [String]!
		regions: [String]!
		countries: [String]!
	}

	type DataCenter {
		id: ID
		shortName: String!
		name: String
		organization: String
		email: String
		uiUrl: String
		gatewayUrl: String
		analysisSongCode: String
		analysisSongUrl: String
		analysisScoreUrl: String
		submissionSongCode: String
		submissionSongUrl: String
		submissionScoreUrl: String
	}

	input ProgramUserInput {
		email: String!
		firstName: String!
		lastName: String!
		role: UserRole!
	}

	"""
	ProgramInput will throw a bad user input error in the following cases:
	if using name that is already in the database,
	if using a shortName format that is not "NAME-AREA", a working example is "BOB-CA"
	using cancerTypes or countries that doesn't exist or is not in the same format as the database ex. a working example of cancerTypes is "Lung cancer". Bad example are "lung", "lung cancer"
	admin's email must be in an email format ex. use @
	"""
	input ProgramInput {
		name: String!
		shortName: String!
		description: String
		commitmentDonors: Int!
		website: String!
		institutions: [String!]!
		countries: [String!]!

		cancerTypes: [String]!
		primarySites: [String]!

		membershipType: MembershipType!

		admins: [ProgramUserInput!]!
	}

	input UpdateProgramInput {
		# This intentionally does not provide access to submittedDonors or genomicDonors
		# Those are maintained by an internal service and should not be updated by any client through the gateway
		name: String
		description: String
		commitmentDonors: Int
		website: String
		institutions: [String]
		countries: [String]
		cancerTypes: [String]
		primarySites: [String]
		membershipType: MembershipType
		dataCenterShortName: String
	}

	input InviteUserInput {
		programShortName: String!
		userFirstName: String!
		userLastName: String!
		userEmail: String!

		userRole: UserRole!
	}

	input JoinProgramInput {
		invitationId: ID!
		institute: String!
		piFirstName: String!
		piLastName: String!
		department: String!
	}

	type Query {
		"""
		retrieve Program data by id
		"""
		program(shortName: String!): Program

		"""
		retrieve all Programs
		"""
		programs(dataCenter: String): [Program]

		"""
		retrieve join program invitation by id
		"""
		joinProgramInvite(id: ID!): JoinProgramInvite

		programOptions: ProgramOptions!

		"""
		retrieve all DataCenters
		"""
		dataCenters(shortName: String): [DataCenter]
	}

	type Mutation {
		"""
		Create new program
		For lists (Cancer Type, Primary Site, Institution, Regions, Countries) the entire new value must be provided, not just values being added.
		Returns Program object details of created program
		"""
		createProgram(program: ProgramInput!): Program

		"""
		Update Program
		Returns shortName of the program if succesfully updated
		"""
		updateProgram(shortName: String!, updates: UpdateProgramInput!): String

		"""
		Invite a user to join a program
		Returns the email of the user if the invite is successfully sent
		"""
		inviteUser(invite: InviteUserInput!): String

		"""
		Join a program by accepting an invitation
		Returns the user data
		"""
		joinProgram(join: JoinProgramInput!): ProgramUser

		"""
		Update a user's role in a prgoram
		Returns the user data
		"""
		updateUser(userEmail: String!, programShortName: String!, userRole: UserRole!): Boolean

		"""
		Remove a user from a program
		Returns message from server
		"""
		removeUser(userEmail: String!, programShortName: String!): String
	}
`;

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
		regions: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listRegions(egoToken);
			return response || null;
		},
		countries: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listCountries(egoToken);
			return response || null;
		},
	},
	Program: {
		users: async (program, args, context, info) => {
			const { egoToken } = context;
			
			const response = await programService.listUsers(egoToken, program.shortName);

			return response || null;
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
			const hasPrivateField = requestedFields.some((field) =>
				programServicePrivateFields.includes(field),
			);

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
			const updates = pickBy(get(args, 'updates', {}), (v) => v !== undefined);
			const programShortName = get(args, 'shortName', {});
			const dataCenterShortName = args.updates.dataCenterShortName;
			delete updates.dataCenterShortName;

			//make a request to get dataCenter data using dataCenterShortName (from query paramenter, updates) and format response
			const [dataCenterResponse] = await programService.listDataCenters(
				dataCenterShortName,
				egoToken,
			);
			const { id, shortName, name, uiUrl, gatewayUrl } = dataCenterResponse;
			// // Update program takes the complete program object future state
			const currentProgramResponse = await programService.getPrivateProgram(
				egoToken,
				programShortName,
			);

			//prepare the payload for the fetch endpoint from the previous steps
			const combinedUpdates = {
				...currentProgramResponse,
				...updates,
				dataCenter: {
					id,
					shortName,
					name,
					uiUrl,
					gatewayUrl,
				},
			};
			//make a request to the PUT updateProgram endpoint with the formatted payload
			const response = await programService.updateProgram(combinedUpdates, egoToken);
			return response === null ? null : programShortName;
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
