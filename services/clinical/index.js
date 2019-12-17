import fetch, { Response } from 'node-fetch';
import FormData from 'form-data';

import { CLINICAL_SERVICE_ROOT } from '../../config';
import { restErrorResponseHandler } from '../../utils/restUtils';

const getRegistrationData = async (programShortName, Authorization) => {
  const url = `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const uploadRegistrationData = async (programShortName, filename, fileStream, Authorization) => {
  const formData = new FormData();

  // Need to buffer whole file from stream to ensure it all gets added to form data.
  const fileBuffer = await new Response(fileStream).buffer();

  // For FormData to send a buffer as a file, it requires a filename in the options.
  formData.append('registrationFile', fileBuffer, {
    filename,
  });

  const url = `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration`;
  const response = await fetch(url, {
    method: 'post',
    headers: { Authorization },
    body: formData,
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const clearRegistrationData = async (programShortName, registrationId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration/${registrationId}`,
    {
      method: 'delete',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => true);
  return response;
};

const commitRegistrationData = async (programShortName, registrationId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration/${registrationId}/commit`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const getClinicalSubmissionTypesList = async () => {
  const url = `${CLINICAL_SERVICE_ROOT}/submission/schema/list`;
  const response = await fetch(url, {
    method: 'get',
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const getClinicalSubmissionSchemaVersion = async () => {
  const url = `${CLINICAL_SERVICE_ROOT}/submission/schema`;
  const response = await fetch(url, {
    method: 'get',
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  console.log(response.version);
  return response.version;
};

const getClinicalSubmissionData = async (programShortName, Authorization) => {
  const url = `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const uploadClinicalSubmissionData = async (programShortName, filesMap, Authorization) => {
  const formData = new FormData();
  for (var filename in filesMap) {
    const fileBuffer = await new Response(filesMap[filename]).buffer();
    formData.append('clinicalFiles', fileBuffer, {
      filename,
    });
  }
  const url = `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/upload`;
  const response = await fetch(url, {
    method: 'post',
    headers: { Authorization },
    body: formData,
  })
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const clearClinicalSubmissionData = async (
  programShortName,
  versionId,
  fileType,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/${versionId}/${fileType}`,
    {
      method: 'delete',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const validateClinicalSubmissionData = async (programShortName, versionId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/validate/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const commitClinicalSubmissionData = async (programShortName, versionId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/commit/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const reopenClinicalSubmissionData = async (programShortName, versionId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/reopen/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response.json());
  return response;
};

const approveClinicalSubmissionData = async (programShortName, versionId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/approve/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then(response => response);
  return true;
};

export default {
  getRegistrationData,
  uploadRegistrationData,
  clearRegistrationData,
  commitRegistrationData,
  getClinicalSubmissionTypesList,
  getClinicalSubmissionSchemaVersion,
  getClinicalSubmissionData,
  uploadClinicalSubmissionData,
  clearClinicalSubmissionData,
  validateClinicalSubmissionData,
  commitClinicalSubmissionData,
  reopenClinicalSubmissionData,
  approveClinicalSubmissionData,
};
