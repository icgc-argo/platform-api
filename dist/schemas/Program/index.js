"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
const graphql_tools_1 = require("graphql-tools");
const lodash_1 = require("lodash");
const programService_1 = __importDefault(require("../../services/programService"));
const grpcUtils_1 = require("../../utils/grpcUtils");
const costDirectiveTypeDef_1 = __importDefault(require("../costDirectiveTypeDef"));
const customScalars_1 = __importDefault(require("../customScalars"));
const apollo_server_express_2 = require("apollo-server-express");
const typeDefs = apollo_server_express_1.gql `
  ${costDirectiveTypeDef_1.default}

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
const getIsoDate = time => (time ? new Date(parseInt(time) * 1000).toISOString() : null);
const convertGrpcProgramToGql = programDetails => ({
    name: lodash_1.get(programDetails, 'program.name.value'),
    shortName: lodash_1.get(programDetails, 'program.short_name.value'),
    description: lodash_1.get(programDetails, 'program.description.value'),
    commitmentDonors: lodash_1.get(programDetails, 'program.commitment_donors.value'),
    submittedDonors: lodash_1.get(programDetails, 'program.submitted_donors.value'),
    genomicDonors: lodash_1.get(programDetails, 'program.genomic_donors.value'),
    website: lodash_1.get(programDetails, 'program.website.value'),
    institutions: lodash_1.get(programDetails, 'program.institutions', []),
    countries: lodash_1.get(programDetails, 'program.countries', []),
    regions: lodash_1.get(programDetails, 'program.regions', []),
    cancerTypes: lodash_1.get(programDetails, 'program.cancer_types', []),
    primarySites: lodash_1.get(programDetails, 'program.primary_sites', []),
    membershipType: lodash_1.get(programDetails, 'program.membership_type.value'),
});
const convertGrpcUserToGql = userDetails => ({
    email: lodash_1.get(userDetails, 'user.email.value'),
    firstName: lodash_1.get(userDetails, 'user.first_name.value'),
    lastName: lodash_1.get(userDetails, 'user.last_name.value'),
    role: lodash_1.get(userDetails, 'user.role.value'),
    inviteStatus: lodash_1.get(userDetails, 'status.value'),
    inviteAcceptedAt: getIsoDate(lodash_1.get(userDetails, 'accepted_at.seconds')),
});
const resolveProgramList = (egoToken) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield programService_1.default.listPrograms(egoToken);
    const programs = lodash_1.get(response, 'programs', []);
    return programs.map(program => convertGrpcProgramToGql(program));
});
const resolveSingleProgram = (egoToken, programShortName) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield programService_1.default.getProgram(programShortName, egoToken);
    const programDetails = lodash_1.get(response, 'program');
    return response ? convertGrpcProgramToGql(programDetails) : null;
});
const resolvers = {
    ProgramOptions: {
        cancerTypes: (constants, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.listCancers(egoToken);
            return lodash_1.get(response, 'cancers', [])
                .map(cancerType => cancerType.name.value)
                .sort();
        }),
        primarySites: (constants, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.listPrimarySites(egoToken);
            return lodash_1.get(response, 'primary_sites', [])
                .map(site => site.name.value)
                .sort();
        }),
        institutions: (constants, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.listInstitutions(egoToken);
            return lodash_1.get(response, 'institutions', [])
                .map(institution => institution.name.value)
                .sort();
        }),
        regions: (constants, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.listRegions(egoToken);
            return lodash_1.get(response, 'regions', [])
                .map(region => region.name.value)
                .sort();
        }),
        countries: (constants, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.listCountries(egoToken);
            return lodash_1.get(response, 'countries', [])
                .map(country => country.name.value)
                .sort();
        }),
    },
    Program: {
        users: (program, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.listUsers(program.shortName, egoToken);
            const users = response ? lodash_1.get(response, 'userDetails', []).map(convertGrpcUserToGql) : null;
            return users;
        }),
    },
    Query: {
        program: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const { shortName } = args;
            return resolveSingleProgram(egoToken, shortName);
        }),
        programs: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            return resolveProgramList(egoToken);
        }),
        joinProgramInvite: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const response = yield programService_1.default.getJoinProgramInvite(args.id, egoToken);
            const joinProgramDetails = lodash_1.get(response, 'invitation');
            return response ? grpcUtils_1.grpcToGql(joinProgramDetails) : null;
        }),
        programOptions: () => ({}),
    },
    Mutation: {
        createProgram: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            // Submitted and Genomic donors are not part of input, need to be set to 0 to start.
            const program = Object.assign(Object.assign({}, lodash_1.get(args, 'program', {})), { submittedDonors: 0, genomicDonors: 0 });
            try {
                const createResponse = yield programService_1.default.createProgram(program, egoToken);
                return resolveSingleProgram(egoToken, program.shortName);
            }
            catch (err) {
                const GRPC_INVALID_ARGUMENT_ERROR_CODE = 3;
                if (err.code === GRPC_INVALID_ARGUMENT_ERROR_CODE) {
                    //this just wraps it into standard apollo semantics
                    throw new apollo_server_express_2.UserInputError(err);
                }
                else {
                    throw new apollo_server_express_2.ApolloError(err);
                }
            }
        }),
        updateProgram: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const updates = lodash_1.pickBy(lodash_1.get(args, 'updates', {}), v => v !== undefined);
            const shortName = lodash_1.get(args, 'shortName', {});
            // // Update program takes the complete program object future state
            const currentPorgramResponse = yield programService_1.default.getProgram(shortName, egoToken);
            const currentProgramDetails = convertGrpcProgramToGql(lodash_1.get(currentPorgramResponse, 'program', {}));
            const combinedUpdates = Object.assign(Object.assign({}, currentProgramDetails), updates);
            const response = yield programService_1.default.updateProgram(shortName, combinedUpdates, egoToken);
            return response === null ? null : lodash_1.get(args, 'shortName');
        }),
        inviteUser: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const invite = lodash_1.get(args, 'invite', {});
            const response = yield programService_1.default.inviteUser(invite, egoToken);
            return lodash_1.get(args, 'invite.userEmail');
        }),
        joinProgram: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const joinProgramInput = lodash_1.get(args, 'join', {});
            const response = yield programService_1.default.joinProgram(joinProgramInput, egoToken);
            return convertGrpcUserToGql(lodash_1.get(response, 'user'));
        }),
        updateUser: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const shortName = lodash_1.get(args, 'programShortName');
            const role = lodash_1.get(args, 'userRole');
            const userEmail = lodash_1.get(args, 'userEmail');
            const response = yield programService_1.default.updateUser(userEmail, shortName, role, egoToken);
            return true;
        }),
        removeUser: (obj, args, context, info) => __awaiter(void 0, void 0, void 0, function* () {
            const { egoToken } = context;
            const shortName = lodash_1.get(args, 'programShortName');
            const email = lodash_1.get(args, 'userEmail');
            const response = yield programService_1.default.removeUser(email, shortName, egoToken);
            return lodash_1.get(response, 'message.value', '');
        }),
    },
};
lodash_1.merge(resolvers, customScalars_1.default);
exports.default = graphql_tools_1.makeExecutableSchema({
    typeDefs,
    resolvers,
});
//# sourceMappingURL=index.js.map