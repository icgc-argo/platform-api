import { CLINICAL_SERVICE_ROOT } from '../../config';
import fetch, { Response } from 'node-fetch';

import FormData from 'form-data';

const getRegistrationData = async (programShortName, Authorization) => {
  const url = `${CLINICAL_SERVICE_ROOT}/program/${programShortName}/registration`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(response => response.json())
    .catch(err => console.error('Error fetching Clinical Registration Data: ', err));
  return response;
};

const uploadRegistrationData = async (programShortName, fileStream, Authorization) => {
  const formData = new FormData();

  // Need to buffer whole file from stream to ensure it all gets added to form data.
  const fileBuffer = await new Response(fileStream).buffer();

  // For FormData to send a buffer as a file, it requires a filename in the options.
  formData.append('registrationFile', fileBuffer, {
    filename: 'registrationFile.tsv',
  });

  const url = `${CLINICAL_SERVICE_ROOT}/program/${programShortName}/registration`;
  const response = await fetch(url, {
    method: 'post',
    headers: { Authorization },
    body: formData,
  })
    .then(response => response.json())
    .catch(err => {
      console.error('Error occurred sending uploadRegistrationData to Clinical Service: ', err);
      throw err;
    });
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
    .then(response => (response.ok ? true : response.json()))
    .catch(err => {
      console.error(
        `Error occurred attempting to delete registration data from Clinical Service (${programShortName}, ${registrationid}): `,
        err,
      );
    });
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
    .then(response => true)
    .catch(err =>
      console.error(
        `Error occurred attempting to commit registration data in Clinical Service (${programShortName}, ${registrationid}): `,
        err,
      ),
    );
  return response;
};

export default {
  getRegistrationData,
  uploadRegistrationData,
  clearRegistrationData,
  commitRegistrationData,
};
