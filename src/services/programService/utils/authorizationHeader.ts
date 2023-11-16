/**
 * Format JWT as Bearer Token for Authorization header.
 * @param {string} jwt
 * @returns {string}
 *
 * @example
 * ```
 * await fetch(url, {
 * 	method: 'get',
 * 	headers: {
 * 		Authorization: authorizationHeader(jwt),
 * 	},
 * })
 * ```
 */
const authorizationHeader = (jwt: string) => `Bearer ${jwt}`;

export default authorizationHeader;
