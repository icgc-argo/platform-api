import {
	EGO_SCORE_PROXY_CLIENT_ID,
	EGO_SCORE_PROXY_CLIENT_SECRET,
	EGO_VAULT_SCORE_PROXY_SECRET_PATH,
} from 'config';

import { createAuthClient, initializeEgoCredentials } from './authClient';

import { EgoClient } from '.';

export const createScoreAuthClient = async (egoClient: EgoClient) => {
	const credentials = await initializeEgoCredentials({
		vaultSecretPath: EGO_VAULT_SCORE_PROXY_SECRET_PATH,
		clientId: EGO_SCORE_PROXY_CLIENT_ID,
		clientSecret: EGO_SCORE_PROXY_CLIENT_SECRET,
	});
	return createAuthClient(egoClient, credentials, 'Score Proxy');
};
