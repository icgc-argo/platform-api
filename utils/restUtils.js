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
    case 404:
      let notFoundData;
      try {
        // This was built for the response structure from Clincial Service which returns a message value in the 404 response.
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
