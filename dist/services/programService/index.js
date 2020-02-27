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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * This file dynamically generates a gRPC client from Ego.proto.
 * The content of Ego.proto is copied directly from: https://github.com/icgc-argo/argo-proto/blob/4e2aeda59eb48b7af20b462aef2f04ef5d0d6e7c/ProgramService.proto
 */
const lodash_1 = require("lodash");
const grpc_1 = __importDefault(require("grpc"));
const loader = __importStar(require("@grpc/proto-loader"));
const program_service_proto_1 = __importDefault(require("@icgc-argo/program-service-proto"));
const config_1 = require("../../config");
const grpcUtils_1 = require("../../utils/grpcUtils");
const packageDefinition = loader.loadSync(program_service_proto_1.default, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto = grpc_1.default.loadPackageDefinition(packageDefinition).program_service;
/**
 * this config was taken from: https://cs.mcgill.ca/~mxia3/2019/02/23/Using-gRPC-in-Production/
 */
const GRPC_CONFIG = {
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.http2.min_time_between_pings_ms': 10000,
    'grpc.http2.min_ping_interval_without_data_ms': 5000,
};
const programServiceRegex = RegExp(/:443$/);
const programService = grpcUtils_1.withRetries(programServiceRegex.test(config_1.PROGRAM_SERVICE_ROOT)
    ? new proto.ProgramService(config_1.PROGRAM_SERVICE_ROOT, grpc_1.default.credentials.createSsl(), GRPC_CONFIG)
    : new proto.ProgramService(config_1.PROGRAM_SERVICE_ROOT, grpc_1.default.credentials.createInsecure(), GRPC_CONFIG));
/*
 * Read-only Methods
 */
const getProgram = (shortName, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.getProgram({ short_name: grpcUtils_1.wrapValue(shortName) }, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.getProgram'));
    });
});
const getJoinProgramInvite = (id, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.getJoinProgramInvite({ invite_id: grpcUtils_1.wrapValue(id) }, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.getJoinProgramInvite'));
    });
});
const listPrograms = (jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listPrograms({}, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listPrograms'));
    });
});
const listUsers = (shortName, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listUsers({ program_short_name: grpcUtils_1.wrapValue(shortName) }, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listUsers'));
    });
});
/* Read Options Lists */
const listCountries = (jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listCountries({}, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listCountries'));
    });
});
const listCancers = (jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listCancers({}, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listCancers'));
    });
});
const listPrimarySites = (jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listPrimarySites({}, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listPrimarySites'));
    });
});
const listRegions = (jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listRegions({}, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listRegions'));
    });
});
const listInstitutions = (jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
        programService.listInstitutions({}, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.listInstitutions'));
    });
});
/*
 * Mutating Methods
 */
const createProgram = ({ name, shortName, description, commitmentDonors, submittedDonors, genomicDonors, website, institutions, countries, regions, membershipType, cancerTypes, primarySites, admins, }, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const createProgramRequest = {
        program: {
            name: grpcUtils_1.wrapValue(name),
            short_name: grpcUtils_1.wrapValue(shortName),
            description: grpcUtils_1.wrapValue(description),
            commitment_donors: grpcUtils_1.wrapValue(commitmentDonors),
            submitted_donors: grpcUtils_1.wrapValue(submittedDonors),
            genomic_donors: grpcUtils_1.wrapValue(genomicDonors),
            website: grpcUtils_1.wrapValue(website),
            institutions: institutions,
            countries: countries,
            regions: regions,
            cancer_types: cancerTypes,
            primary_sites: primarySites,
            membership_type: grpcUtils_1.wrapValue(membershipType),
        },
        admins: (admins || []).map(admin => ({
            email: grpcUtils_1.wrapValue(lodash_1.get(admin, 'email')),
            first_name: grpcUtils_1.wrapValue(lodash_1.get(admin, 'firstName')),
            last_name: grpcUtils_1.wrapValue(lodash_1.get(admin, 'lastName')),
            role: grpcUtils_1.wrapValue(lodash_1.get(admin, 'role')),
        })),
    };
    return yield new Promise((resolve, reject) => {
        programService.createProgram(createProgramRequest, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.createProgram'));
    });
});
const updateProgram = (shortName, { name, description, commitmentDonors, submittedDonors, genomicDonors, website, institutions, countries, regions, membershipType, cancerTypes, primarySites, }, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const updateProgramRequest = {
        program: {
            short_name: grpcUtils_1.wrapValue(shortName),
            name: grpcUtils_1.wrapValue(name),
            description: grpcUtils_1.wrapValue(description),
            commitment_donors: grpcUtils_1.wrapValue(commitmentDonors),
            website: grpcUtils_1.wrapValue(website),
            submitted_donors: grpcUtils_1.wrapValue(submittedDonors),
            genomic_donors: grpcUtils_1.wrapValue(genomicDonors),
            institutions: institutions,
            countries: countries,
            regions: regions,
            cancer_types: cancerTypes,
            primary_sites: primarySites,
            membership_type: grpcUtils_1.wrapValue(membershipType),
        },
    };
    return yield new Promise((resolve, reject) => {
        programService.updateProgram(updateProgramRequest, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.updateProgram'));
    });
});
const inviteUser = ({ programShortName, userFirstName, userLastName, userEmail, userRole }, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const inviteUserRequest = {
        program_short_name: grpcUtils_1.wrapValue(programShortName),
        first_name: grpcUtils_1.wrapValue(userFirstName),
        last_name: grpcUtils_1.wrapValue(userLastName),
        email: grpcUtils_1.wrapValue(userEmail),
        role: grpcUtils_1.wrapValue(userRole),
    };
    return yield new Promise((resolve, reject) => {
        programService.inviteUser(inviteUserRequest, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.inviteUser'));
    });
});
const joinProgram = ({ invitationId, institute, piFirstName, piLastName, department }, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const inviteUserRequest = {
        join_program_invitation_id: grpcUtils_1.wrapValue(invitationId),
        institute: grpcUtils_1.wrapValue(institute),
        affiliate_pi_first_name: grpcUtils_1.wrapValue(piFirstName),
        affiliate_pi_last_name: grpcUtils_1.wrapValue(piLastName),
        department: grpcUtils_1.wrapValue(department),
    };
    return yield new Promise((resolve, reject) => {
        programService.joinProgram(inviteUserRequest, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.joinProgram'));
    });
});
const updateUser = (email, shortName, role, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const updateUserRequest = {
        user_email: grpcUtils_1.wrapValue(email),
        role: grpcUtils_1.wrapValue(role),
        short_name: grpcUtils_1.wrapValue(shortName),
    };
    return yield new Promise((resolve, reject) => {
        programService.updateUser(updateUserRequest, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.updateUser'));
    });
});
const removeUser = (email, shortName, jwt = null) => __awaiter(void 0, void 0, void 0, function* () {
    const removeUserRequest = {
        user_email: grpcUtils_1.wrapValue(email),
        program_short_name: grpcUtils_1.wrapValue(shortName),
    };
    return yield new Promise((resolve, reject) => {
        programService.removeUser(removeUserRequest, grpcUtils_1.getAuthMeta(jwt), grpcUtils_1.defaultPromiseCallback(resolve, reject, 'ProgramService.removeUser'));
    });
});
// const inviteUser = async ({programShortName, }, jwt=null)
exports.default = {
    getProgram,
    listPrograms,
    getJoinProgramInvite,
    listUsers,
    listCancers,
    listPrimarySites,
    listRegions,
    listInstitutions,
    listCountries,
    createProgram,
    updateProgram,
    inviteUser,
    joinProgram,
    updateUser,
    removeUser,
};
//# sourceMappingURL=index.js.map