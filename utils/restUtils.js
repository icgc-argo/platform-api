import { AuthenticationError, UserInputError, ApolloError } from 'apollo-server-express';
import logger from './logger';
/*
convert the REST status codes to GQL errors, or return the response if passing
*/
export const restErrorResponseHandler = async response => {
  switch (response.status) {
    case 200:
    case 201:
      return response;
    case 401:
    case 403:
      throw new AuthenticationError(response.status);
    case 400:
    case 404:
      let notFoundData;
      try {
        // This was built for the response structure from Clincial Service which returns a message value in the 404 response.
        notFoundData = await response.json();
      } catch {
        notFoundData = { message: '' };
      }
      // throw error with message and properties in response (if any)
      throw new UserInputError(notFoundData.message, notFoundData);
    case 500:
    case 503:
      logger.debug(`Server 5xx response: ${JSON.stringify(await response.json())}`);
      throw new ApolloError();
    default:
      return response;
  }
};
