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
    .then((response) => response.json());
  return response;
};

const uploadRegistrationData = async (
  programShortName,
  filename,
  fileStream,
  Authorization,
) => {
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
    .then((response) => response.json());
  return response;
};

const clearRegistrationData = async (
  programShortName,
  registrationId,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration/${registrationId}`,
    {
      method: 'delete',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then((response) => true);
  return response;
};

const commitRegistrationData = async (
  programShortName,
  registrationId,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/registration/${registrationId}/commit`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

/**
 * @returns {Promise<string[]>}
 */
const getClinicalSubmissionTypesList = async () => {
  const url = `${CLINICAL_SERVICE_ROOT}/dictionary/list`;
  const response = await fetch(url, {
    method: 'get',
  })
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

/**
 * @returns {Promise<string>}
 */
const getClinicalSubmissionSchemaVersion = async () => {
  const url = `${CLINICAL_SERVICE_ROOT}/dictionary`;
  const response = await fetch(url, {
    method: 'get',
  })
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  console.log(response.version);
  return response.version;
};

/**
 * @returns {Promise<boolean>}
 */
const getClinicalSubmissionSystemDisabled = async () => {
  const url = `${CLINICAL_SERVICE_ROOT}/submission/configs/submission-disabled`;
  const response = await fetch(url, {
    method: 'get',
  })
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

const getClinicalSubmissionData = async (programShortName, Authorization) => {
  const url = `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then((response) => response.json());

  return response;
};

const getClinicalData = async (variables, Authorization) => {
  const { programShortName, filters } = variables;

  const query = new URLSearchParams(filters).toString();

  const url = `${CLINICAL_SERVICE_ROOT}/clinical/program/${programShortName}/clinical-data?${query}`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

const getClinicalErrors = async (programShortName, donorIds, Authorization) => {
  const url = `${CLINICAL_SERVICE_ROOT}/clinical/program/${programShortName}/clinical-errors?donorIds=${donorIds}`;
  const response = await fetch(url, {
    method: 'get',
    headers: { Authorization },
  })
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

const uploadClinicalSubmissionData = async (
  programShortName,
  filesMap,
  Authorization,
) => {
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
    .then((response) => response.json());
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
    .then((response) => response.json());
  return response;
};

const validateClinicalSubmissionData = async (
  programShortName,
  versionId,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/validate/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

const commitClinicalSubmissionData = async (
  programShortName,
  versionId,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/commit/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

const reopenClinicalSubmissionData = async (
  programShortName,
  versionId,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/reopen/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then((response) => response.json());
  return response;
};

const approveClinicalSubmissionData = async (
  programShortName,
  versionId,
  Authorization,
) => {
  const response = await fetch(
    `${CLINICAL_SERVICE_ROOT}/submission/program/${programShortName}/clinical/approve/${versionId}`,
    {
      method: 'post',
      headers: { Authorization },
    },
  )
    .then(restErrorResponseHandler)
    .then((response) => response);
  return true;
};

export default {
  getRegistrationData,
  uploadRegistrationData,
  clearRegistrationData,
  commitRegistrationData,
  getClinicalSubmissionTypesList,
  getClinicalSubmissionSchemaVersion,
  getClinicalSubmissionSystemDisabled,
  getClinicalSubmissionData,
  getClinicalData,
  getClinicalErrors,
  uploadClinicalSubmissionData,
  clearClinicalSubmissionData,
  validateClinicalSubmissionData,
  commitClinicalSubmissionData,
  reopenClinicalSubmissionData,
  approveClinicalSubmissionData,
};
