import { CLINICAL_SERVICE_ROOT } from '../../config';
import fetch, { Response } from 'node-fetch';
import { AuthenticationError, UserInputError, ServerError } from 'apollo-server-express';

import FormData from 'form-data';

/*
convert the REST status codes to GQL errors, or return the response if passing
*/
const registrationResponseHandler = async response => {
  switch (response.status) {
    case 200:
    case 201:
      return response;
    case 401:
    case 403:
      throw new AuthenticationError(response.status);
    case 404:
      let notFoundData;
      try {
        notFoundData = await response.json();
      } catch {
        notFoundData = { message: '' };
      }
      throw new UserInputError(notFoundData.message);
    case 500:
      throw new ServerError();
    default:
      return response;
  }
};

const getRegistrationData = async (programShortName, Authorization) => {
  const url = `${CLINICAL_SERVICE_ROOT}/program/${programShortName}/registration`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(registrationResponseHandler)
    .then(response => response.json());
  // .catch(err => console.error('Error fetching Clinical Registration Data: ', err));
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

  const url = `${CLINICAL_SERVICE_ROOT}/program/${programShortName}/registration`;
  const response = await fetch(url, {
    method: 'post',
    headers: { Authorization },
    body: formData,
  })
    .then(registrationResponseHandler)
    .then(response => response.json());
  return response;
};

const clearRegistrationData = async (programShortName, registrationId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/program/${programShortName}/registration/${registrationId}`,
    {
      method: 'delete',
      headers: { Authorization },
    },
  )
    .then(registrationResponseHandler)
    .then(response => true);
  return response;
};

const commitRegistrationData = async (programShortName, registrationId, Authorization) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/program/${programShortName}/registration/${registrationId}/commit`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(registrationResponseHandler)
    .then(response => response.json());
  return response;
};

export default {
  getRegistrationData,
  uploadRegistrationData,
  clearRegistrationData,
  commitRegistrationData,
};
