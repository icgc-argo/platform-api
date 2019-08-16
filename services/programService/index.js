/*
 * This file dynamically generates a gRPC client from Ego.proto.
 * The content of Ego.proto is copied directly from: https://github.com/icgc-argo/argo-proto/blob/4e2aeda59eb48b7af20b462aef2f04ef5d0d6e7c/ProgramService.proto
 */
import { get } from 'lodash';
import grpc from 'grpc';
import * as loader from '@grpc/proto-loader';
import protoPath from '@icgc-argo/program-service-proto';

import { PROGRAM_SERVICE_ROOT } from '../../config';
import { getAuthMeta, wrapValue, withRetries, defaultPromiseCallback } from '../../utils/grpcUtils';
import retry from 'retry';

const packageDefinition = loader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition).program_service;

const programService = withRetries(
  new proto.ProgramService(PROGRAM_SERVICE_ROOT, grpc.credentials.createInsecure()),
);

/*
 * Read-only Methods
 */
const getProgram = async (shortName, jwt = null) => {
  return await new Promise((resolve, reject) => {
    programService.getProgram(
      { short_name: wrapValue(shortName) },
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.getProgram'),
    );
  });
};

const getJoinProgramInvite = async (id, jwt = null) => {
  return await new Promise((resolve, reject) => {
    programService.getJoinProgramInvite(
      { invite_id: wrapValue(id) },
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.getJoinProgramInvite'),
    );
  });
};

const listPrograms = async (jwt = null) => {
  return await new Promise((resolve, reject) => {
    programService.listPrograms(
      {},
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.listPrograms'),
    );
  });
};

const listUsers = async (shortName, jwt = null) => {
  return await new Promise((resolve, reject) => {
    programService.listUsers(
      { program_short_name: wrapValue(shortName) },
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.listUsers'),
    );
  });
};

/*
 * Mutating Methods
 */
const createProgram = async (
  {
    name,
    shortName,
    description,
    commitmentDonors,
    submittedDonors,
    genomicDonors,
    website,
    institutions,
    countries,
    regions,
    membershipType,
    cancerTypes,
    primarySites,
    admins,
  },
  jwt = null,
) => {
  const createProgramRequest = {
    program: {
      name: wrapValue(name),
      short_name: wrapValue(shortName),
      description: wrapValue(description),
      commitment_donors: wrapValue(commitmentDonors),
      submitted_donors: wrapValue(submittedDonors),
      genomic_donors: wrapValue(genomicDonors),
      website: wrapValue(website),

      institutions: institutions,
      countries: countries,
      regions: regions,
      cancer_types: cancerTypes,
      primary_sites: primarySites,

      membership_type: wrapValue(membershipType),
    },
    admins: (admins || []).map(admin => ({
      email: wrapValue(get(admin, 'email')),
      first_name: wrapValue(get(admin, 'firstName')),
      last_name: wrapValue(get(admin, 'lastName')),
      role: wrapValue(get(admin, 'role')),
    })),
  };

  return await new Promise((resolve, reject) => {
    programService.createProgram(
      createProgramRequest,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.createProgram'),
    );
  });
};

const updateProgram = async (
  shortName,
  {
    name,
    description,
    commitmentDonors,
    submittedDonors,
    genomicDonors,
    website,
    institutions,
    countries,
    regions,
    membershipType,
    cancerTypes,
    primarySites,
  },
  jwt = null,
) => {
  const updateProgramRequest = {
    program: {
      short_name: wrapValue(shortName),
      name: wrapValue(name),
      description: wrapValue(description),
      commitment_donors: wrapValue(commitmentDonors),
      website: wrapValue(website),
      submitted_donors: wrapValue(submittedDonors),
      genomic_donors: wrapValue(genomicDonors),

      institutions: institutions,
      countries: countries,
      regions: regions,
      cancer_types: cancerTypes,
      primary_sites: primarySites,

      membership_type: wrapValue(membershipType),
    },
  };

  return await new Promise((resolve, reject) => {
    programService.updateProgram(
      updateProgramRequest,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.updateProgram'),
    );
  });
};

const inviteUser = async (
  { programShortName, userFirstName, userLastName, userEmail, userRole },
  jwt = null,
) => {
  const inviteUserRequest = {
    program_short_name: wrapValue(programShortName),
    first_name: wrapValue(userFirstName),
    last_name: wrapValue(userLastName),
    email: wrapValue(userEmail),
    role: wrapValue(userRole),
  };

  return await new Promise((resolve, reject) => {
    programService.inviteUser(
      inviteUserRequest,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.inviteUser'),
    );
  });
};

const joinProgram = async (
  { invitationId, institute, piFirstName, piLastName, department },
  jwt = null,
) => {
  const inviteUserRequest = {
    join_program_invitation_id: wrapValue(invitationId),
    institute: wrapValue(institute),
    affiliate_pi_first_name: wrapValue(piFirstName),
    affiliate_pi_last_name: wrapValue(piLastName),
    department: wrapValue(department),
  };

  return await new Promise((resolve, reject) => {
    programService.joinProgram(
      inviteUserRequest,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.joinProgram'),
    );
  });
};

const updateUser = async (email, shortName, role, jwt = null) => {
  const updateUserRequest = {
    user_email: wrapValue(email),
    role: wrapValue(role),
    short_name: wrapValue(shortName),
  };

  return await new Promise((resolve, reject) => {
    programService.updateUser(
      updateUserRequest,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.updateUser'),
    );
  });
};

const removeUser = async (email, shortName, jwt = null) => {
  const removeUserRequest = {
    user_email: wrapValue(email),
    program_short_name: wrapValue(shortName),
  };

  return await new Promise((resolve, reject) => {
    programService.removeUser(
      removeUserRequest,
      getAuthMeta(jwt),
      defaultPromiseCallback(resolve, reject, 'ProgramService.removeUser'),
    );
  });
};

// const inviteUser = async ({programShortName, }, jwt=null)
export default {
  getProgram,
  listPrograms,
  getJoinProgramInvite,
  listUsers,
  createProgram,
  updateProgram,

  inviteUser,
  joinProgram,
  updateUser,
  removeUser,
};