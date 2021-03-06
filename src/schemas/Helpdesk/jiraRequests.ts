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

/**
 * Obtains and tests the Jira Admin Credentials
 * @returns the base64 encoded string of the admin credentials
 */
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

  const encodedAuthString = `Basic ${Buffer.from(basicAuthString).toString('base64')}`

  // to ensure user credentials work, test a simple request and process the response
  try {
    const url = `${JIRA_REST_URI}/request`;

    await fetch(url, {
      method: 'get',
      headers: {
        'Authorization': encodedAuthString,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })

    .then(restErrorResponseHandler)
    .then(async response => {
      logger.info(await response.json())
    });

  } catch (err) {
    logger.error(`failed to make a request to JIRA using the authentication`);
    throw err;
  }
  logger.info(`successfully obtained and tested credentials for JIRA Service Desk API `);

  return encodedAuthString
};
export type JiraClient = {
  createServiceRequest: (customerIdentifier: string, requestTypeId: string, requestText: string, summaryPrependText: string) => Promise<any>;
  createCustomer: (email: string, displayName: string) => Promise<any>
}
export const createJiraClient = async ():Promise<JiraClient> => {

  const basicAuthentication = await getJiraBasicAuth();

  const requestHeaders = {
    Authorization: basicAuthentication,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  // these types only include relevant fields
  type OrganizationCustomer = {
    accountId: string;
    emailAddress: string;
    displayName: string;
  }

  type ErrorBody = {
    i18nErrorMessage: {
      parameters : Array<string>
    }
  }
  
  const EMAIL_ALREADY_EXISTS_MESSAGE = 'email : An account already exists for this email';

  /**
   * Adds a customer to an organization for future reference.
   * 
   * Requires a customer organization.
   */
  const addCustomerToOrganization = async (accountId: string) => {
    const url = `${JIRA_REST_URI}/organization/${JIRA_ORGANIZATION_ID}/user`;

    const bodyData = JSON.stringify({ "accountIds": [accountId] });

    const response = await fetch(url, {
      method: 'post',
      headers: requestHeaders,
      body: bodyData,
    }).then(restErrorResponseHandler)
    .then(response => response.json());

    return response;

  };

  /**
   * Gets a customer's account id via an email search within a customer organization.
   * 
   * Requires a customer organization.
   */
  const getAccountId = async (emailAddress: string) => {
    const url = `${JIRA_REST_URI}/organization/${JIRA_ORGANIZATION_ID}/user`;
    
    type ResponseBody = {
      values: Array<OrganizationCustomer>;
    }
    const response = await fetch(url, {
      method: 'get',
      headers: requestHeaders,
    }) .then(restErrorResponseHandler).then(response=>response.json() as ResponseBody )

    
      const id = response.values.find(customer => customer.emailAddress === emailAddress.toLowerCase())?.accountId;

      if (!id){
        throw new UserInputError('An existing customer with a duplicate email was detected, but an error occurred when retreiving their ID');
      }

      return id;

  };


  return {
    /**
     * Creates a service request using the admin credentials, on behalf of a customer. 
     * @param customerIdentifier An email address, or an accountid
     * @param requestTypeId The designated id associated with the request, set from Jira's end
     * @param requestText What goes in the description box
     * @param summaryPrependText Text that prepends the summary so the tickets can be easily discerned
     * @returns The json body from the request
     */
    createServiceRequest: async (customerIdentifier: string, requestTypeId: string, requestText:string, summaryPrependText: string) => {

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
        headers: requestHeaders,
        body: bodyData,
      })
  
      .then(restErrorResponseHandler)
    
      .then( async response => {
        return response.json()
  
      });
  
      return response;
    },
    /**
   * Creates a customer and returns their account ID, an alternate customer identifier to just an email. This method will show the customer name by default.
   * 
   * This method requires that a customer organization within the service desk is created, and relies on the organization's id!
   * @returns the accountid of the customer
   */
    createCustomer: async (email: string, displayName: string) => {

      const url = `${JIRA_REST_URI}/customer`;
    
      const bodyData = JSON.stringify({
        displayName: displayName,
        email: email,
      });
    
      const response = await fetch(url, {
        method: 'post',
        headers: requestHeaders,
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
                return await getAccountId(email);
              }
              else {
                logger.error('An unexpected error occured during the client creation process.');
                 return await restErrorResponseHandler(response)
              }
            } catch {
              logger.error('An Error Occured, and the error body couldnt be correctly parsed.');
              return await restErrorResponseHandler(response)
            }
          } else if (response.ok) {
    
            const newCustomer: OrganizationCustomer = await response.json() ;
            addCustomerToOrganization(newCustomer.accountId);
            return newCustomer.accountId;
          }
        });
    
      return response;
    }
  }
}
