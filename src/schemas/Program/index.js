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
import programService from '../../services/programService';
import { grpcToGql } from '../../utils/grpcUtils';
import costDirectiveTypeDef from '../costDirectiveTypeDef';
import customScalars from '../customScalars';
import logger from '../../utils/logger';
import { UserInputError, ApolloError } from 'apollo-server-express';

const typeDefs = gql`
	${costDirectiveTypeDef}

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

	type Program @cost(complexity: 10) {
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

		membershipType: MembershipType

		users: [ProgramUser]
	}

	type ProgramUser @cost(complexity: 10) {
		email: String!
		firstName: String!
		lastName: String!
		role: UserRole!
		isDacoApproved: Boolean
		inviteStatus: InviteStatus
		inviteAcceptedAt: String
	}

	type ProgramOptions {
		cancerTypes: [String]! @cost(complexity: 5)
		primarySites: [String]! @cost(complexity: 5)
		institutions: [String]! @cost(complexity: 5)
		regions: [String]! @cost(complexity: 5)
		countries: [String]! @cost(complexity: 5)
	}

	input ProgramUserInput {
		email: String!
		firstName: String!
		lastName: String!
		role: UserRole!
	}

	input ProgramInput {
		name: String!
		shortName: String!
		description: String
		commitmentDonors: Int!
		website: String!
		institutions: [String!]!
		countries: [String!]!
		regions: [String!]!
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
		regions: [String]
		cancerTypes: [String]
		primarySites: [String]
		membershipType: MembershipType
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
		programs: [Program]

		"""
		retrieve join program invitation by id
		"""
		joinProgramInvite(id: ID!): JoinProgramInvite

		programOptions: ProgramOptions!
	}

	type Mutation {
		"""
		Create new program
		For lists (Cancer Type, Primary Site, Institution, Regions, Countries) the entire new value must be provided, not just values being added.
		Returns Program object details of created program
		"""
		createProgram(program: ProgramInput!): Program @cost(complexity: 40)

		"""
		Update Program
		Returns shortName of the program if succesfully updated
		"""
		updateProgram(shortName: String!, updates: UpdateProgramInput!): String @cost(complexity: 20)

		"""
		Invite a user to join a program
		Returns the email of the user if the invite is successfully sent
		"""
		inviteUser(invite: InviteUserInput!): String @cost(complexity: 10)

		"""
		Join a program by accepting an invitation
		Returns the user data
		"""
		joinProgram(join: JoinProgramInput!): ProgramUser @cost(complexity: 10)

		"""
		Update a user's role in a prgoram
		Returns the user data
		"""
		updateUser(userEmail: String!, programShortName: String!, userRole: UserRole!): Boolean
			@cost(complexity: 10)

		"""
		Remove a user from a program
		Returns message from server
		"""
		removeUser(userEmail: String!, programShortName: String!): String @cost(complexity: 10)
	}
`;

/* =========
    Convert GRPC Response to GQL output
 * ========= */
const getIsoDate = (time) => (time ? new Date(parseInt(time) * 1000).toISOString() : null);

const convertGrpcProgramToGql = (programDetails) => ({
	name: get(programDetails, 'program.name.value'),
	shortName: get(programDetails, 'program.short_name.value'),
	description: get(programDetails, 'program.description.value'),
	commitmentDonors: get(programDetails, 'program.commitment_donors.value'),
	submittedDonors: get(programDetails, 'program.submitted_donors.value'),
	genomicDonors: get(programDetails, 'program.genomic_donors.value'),
	website: get(programDetails, 'program.website.value'),
	institutions: get(programDetails, 'program.institutions', []),
	countries: get(programDetails, 'program.countries', []),
	regions: get(programDetails, 'program.regions', []),
	cancerTypes: get(programDetails, 'program.cancer_types', []),
	primarySites: get(programDetails, 'program.primary_sites', []),
	membershipType: get(programDetails, 'program.membership_type.value'),
});

const convertGrpcUserToGql = (userDetails) => ({
	email: get(userDetails, 'user.email.value'),
	firstName: get(userDetails, 'user.first_name.value'),
	lastName: get(userDetails, 'user.last_name.value'),
	role: get(userDetails, 'user.role.value'),
	isDacoApproved: get(userDetails, 'daco_approved.value'),
	inviteStatus: get(userDetails, 'status.value'),
	inviteAcceptedAt: getIsoDate(get(userDetails, 'accepted_at.seconds')),
});

const resolveProgramList = async (egoToken) => {
	const response = await programService.listPrograms(egoToken);
	const programs = get(response, 'programs', []);
	return programs.map((program) => convertGrpcProgramToGql(program));
};

const resolveSingleProgram = async (egoToken, programShortName) => {
	const response = await programService.getProgram(programShortName, egoToken);
	const programDetails = get(response, 'program');
	return response ? convertGrpcProgramToGql(programDetails) : null;
};

const resolvers = {
	ProgramOptions: {
		cancerTypes: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listCancers(egoToken);
			return get(response, 'cancers', [])
				.map((cancerType) => cancerType.name.value)
				.sort();
		},
		primarySites: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listPrimarySites(egoToken);
			return get(response, 'primary_sites', [])
				.map((site) => site.name.value)
				.sort();
		},
		institutions: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listInstitutions(egoToken);
			return get(response, 'institutions', [])
				.map((institution) => institution.name.value)
				.sort();
		},
		regions: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listRegions(egoToken);
			return get(response, 'regions', [])
				.map((region) => region.name.value)
				.sort();
		},
		countries: async (constants, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listCountries(egoToken);
			return get(response, 'countries', [])
				.map((country) => country.name.value)
				.sort();
		},
	},
	Program: {
		users: async (program, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.listUsers(program.shortName, egoToken);
			const users = response ? get(response, 'userDetails', []).map(convertGrpcUserToGql) : null;
			return users;
		},
	},
	Query: {
		program: async (obj, args, context, info) => {
			const { egoToken } = context;
			const { shortName } = args;
			return resolveSingleProgram(egoToken, shortName);
		},
		programs: async (obj, args, context, info) => {
			const { egoToken } = context;
			return resolveProgramList(egoToken);
		},
		joinProgramInvite: async (obj, args, context, info) => {
			const { egoToken } = context;
			const response = await programService.getJoinProgramInvite(args.id, egoToken);
			const joinProgramDetails = get(response, 'invitation');
			return response ? grpcToGql(joinProgramDetails) : null;
		},
		programOptions: () => ({}),
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

			try {
				const createResponse = await programService.createProgram(program, egoToken);
				return resolveSingleProgram(egoToken, program.shortName);
			} catch (err) {
				const GRPC_INVALID_ARGUMENT_ERROR_CODE = 3;
				if (err.code === GRPC_INVALID_ARGUMENT_ERROR_CODE) {
					//this just wraps it into standard apollo semantics
					throw new UserInputError(err);
				} else {
					throw new ApolloError(err);
				}
			}
		},

		updateProgram: async (obj, args, context, info) => {
			const { egoToken } = context;
			const updates = pickBy(get(args, 'updates', {}), (v) => v !== undefined);
			const shortName = get(args, 'shortName', {});

			// // Update program takes the complete program object future state
			const currentPorgramResponse = await programService.getProgram(shortName, egoToken);
			const currentProgramDetails = convertGrpcProgramToGql(
				get(currentPorgramResponse, 'program', {}),
			);

			const combinedUpdates = { ...currentProgramDetails, ...updates };

			const response = await programService.updateProgram(shortName, combinedUpdates, egoToken);
			return response === null ? null : get(args, 'shortName');
		},

		inviteUser: async (obj, args, context, info) => {
			const { egoToken } = context;
			const invite = get(args, 'invite', {});
			const response = await programService.inviteUser(invite, egoToken);
			return get(args, 'invite.userEmail');
		},

		joinProgram: async (obj, args, context, info) => {
			const { egoToken } = context;
			const joinProgramInput = get(args, 'join', {});
			const response = await programService.joinProgram(joinProgramInput, egoToken);
			return convertGrpcUserToGql(get(response, 'user'));
		},

		updateUser: async (obj, args, context, info) => {
			const { egoToken } = context;
			const shortName = get(args, 'programShortName');
			const role = get(args, 'userRole');
			const userEmail = get(args, 'userEmail');
			const response = await programService.updateUser(userEmail, shortName, role, egoToken);
			return true;
		},

		removeUser: async (obj, args, context, info) => {
			const { egoToken } = context;
			const shortName = get(args, 'programShortName');
			const email = get(args, 'userEmail');
			const response = await programService.removeUser(email, shortName, egoToken);
			return get(response, 'message.value', '');
		},
	},
};

merge(resolvers, customScalars);

export default makeExecutableSchema({
	typeDefs,
	resolvers,
});
