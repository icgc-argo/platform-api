import { JIRA_ORGANIZATION_ID, JIRA_ADMIN_EMAIL, JIRA_ADMIN_PASS, JIRA_REST_URI, JIRA_SERVICEDESK_ID } from 'config';
import { restErrorResponseHandler } from 'utils/restUtils';
import fetch from 'node-fetch';
import { UserInputError } from 'apollo-server-express';
import { loadVaultSecret } from 'services/vault';
import {
  USE_VAULT,
  JIRA_ADMIN_VAULT_CREDENTIALS_PATH,
} from 'config';
import logger from 'utils/logger';

type JiraCredentials = {
  email: string;
  password: string;
};

const isCredentials = (data: { [k: string]: any }): data is JiraCredentials => {
  return typeof data['email'] === 'string' && typeof data['password'] === 'string';
};

const getJiraBasicAuth = async (): Promise<string> => {
  let basicAuthString: string;
  if (USE_VAULT) {
    const secretData = await loadVaultSecret()(JIRA_ADMIN_VAULT_CREDENTIALS_PATH).catch(err => {
      logger.error(
        `could not read Jira Credentials secret at path ${JIRA_ADMIN_VAULT_CREDENTIALS_PATH}`,
      );
      throw err;
    });
    if (isCredentials(secretData)) {
      basicAuthString = `${secretData.email}:${secretData.password}`
    } else {
      throw new Error(`vault secret at ${JIRA_ADMIN_VAULT_CREDENTIALS_PATH} could not be read`);
    }
  } else {
    basicAuthString = `${JIRA_ADMIN_EMAIL}:${JIRA_ADMIN_PASS}`
  }

  return `Basic ${Buffer.from(basicAuthString).toString('base64')}`
};


const getJiraRequestHeader = async () => {

  const auth = await getJiraBasicAuth();
  return {
    Authorization: auth,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}


export const createServiceRequest = async (customerIdentifier: string, requestTypeId: string, requestText:string, summaryPrependText: string) => {

    const url = `${JIRA_REST_URI}/request`;

    const characterLimit = 60;
    const summaryText = requestText.length > characterLimit ? `${requestText.substring(0,characterLimit)}...` : requestText;

    // summary is a required field, that cannot accept newlines
    const request = {
      raiseOnBehalfOf: customerIdentifier,
      serviceDeskId: JIRA_SERVICEDESK_ID,
      requestTypeId: requestTypeId,
      requestFieldValues: {
        summary: `${summaryPrependText}: ${summaryText.replace(/(\r\n|\n|\r)/gm, "")}`,
        description: requestText
      }
    }
    const bodyData = JSON.stringify(request)
  
    const response = await fetch(url, {
      method: 'post',
      headers: await getJiraRequestHeader(),
      body: bodyData,
    })

    .then(restErrorResponseHandler)
  
    .then( async response => {
      return {requestOk: response.ok, statusText: response.statusText}

    });

    return response;
  };


/* -------------------- Alternative Method for Filing Request on Behalf Of a Customer --------------------------- */


type OrganizationCustomer = {
  // relevant details 
  accountId: string;
  emailAddress: string;
  displayName: string;
}
type ErrorBody = {
  i18nErrorMessage: {
    parameters : Array<string>
  }
}

const EMAIL_ALREADY_EXISTS_MESSAGE = 'email : An account already exists for this email'


/**
 * If you ever wish to create a customer using their name, and get back their client ID.
 * Client IDs are alternative identifiers used for making service requests, opposed to email
 * This method requires a Jira Customer Organization
 * @param email 
 * @param displayName 
 * @returns The client id of a new or an existing (based on email) customer
 */
export const createCustomer = async (email: string, displayName: string) => {

  const url = `${JIRA_REST_URI}/customer`;

  const bodyData = JSON.stringify({
    displayName: displayName,
    email: email,
  });


  const response = await fetch(url, {
    method: 'post',
    headers: await getJiraRequestHeader(),
    body: bodyData,
  })

    .then(async response => {

      if (response.status === 400) {
        // there is a particular error which is an indication that the customer exists already
        // can use this information to still obtain their id
        const errorData = await response.json() as ErrorBody;

        try {
          const isAlreadyCustomer = errorData.i18nErrorMessage.parameters.includes(
            EMAIL_ALREADY_EXISTS_MESSAGE,
          );
          if (isAlreadyCustomer) {
            return await getCustomerId(email);
          }
          else {
            console.debug('An Error Occured, and the error body couldnt be correctly parsed.');
             return await restErrorResponseHandler(response)
          }
        } catch {
          console.debug('An Error Occured, and the error body couldnt be correctly parsed.');
          return await restErrorResponseHandler(response)
        }
      } else if (response.ok) {

        const newCustomer: OrganizationCustomer = await response.json() ;
        addCustomerToOrganization(newCustomer.accountId);
        return newCustomer.accountId;
      }
    });

  return response;
};

/**
 * Get the clientid of someone by their email
 * @param emailAddress 
 */
const getCustomerId = async (emailAddress: string) => {
  const url = `${JIRA_REST_URI}/organization/${JIRA_ORGANIZATION_ID}/user`;
  
  type ResponseBody = {
    values: Array<OrganizationCustomer>;
  }
  const response = await fetch(url, {
    method: 'get',
    headers: await getJiraRequestHeader(),
  }) .then(restErrorResponseHandler).then(response=>response.json() as ResponseBody )

  
    const id = response.values.find(customer => customer.emailAddress === emailAddress.toLowerCase())?.accountId;

    if (!id){
      throw new UserInputError('An existing customer with a duplicate email was detected, but an error occurred when retreiving their ID');
    }

    return id;

};

const addCustomerToOrganization = async (accountId: string) => {
  const url = `${JIRA_REST_URI}/organization/${JIRA_ORGANIZATION_ID}/user`;

  const bodyData = JSON.stringify({ "accountIds": [accountId] });

  const response = await fetch(url, {
    method: 'post',
    headers: await getJiraRequestHeader(),
    body: bodyData,
  }).then(restErrorResponseHandler)
  .then(response => response.json());

  return response;

};



