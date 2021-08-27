import { EgoClient, EgoApplicationCredential } from '.';
import egoTokenUtils from 'utils/egoTokenUtils';
import { loadVaultSecret } from 'services/vault';
import logger from '../../utils/logger';
import {
  USE_VAULT,
  EGO_SCORE_PROXY_CLIENT_ID,
  EGO_SCORE_PROXY_CLIENT_SECRET,
  EGO_VAULT_SCORE_PROXY_SECRET_PATH,
} from 'config';

export type ScoreAuthClient = {
  getAuth: () => Promise<string>;
};

export const createScoreAuthClient = async (egoClient: EgoClient) => {
  /**
   * Internal Closure Data
   * */

  let latestJwt: string;

  const vaultSecretLoader = await loadVaultSecret();

  const scoreProxyAppCredentials = USE_VAULT
    ? ((await vaultSecretLoader(EGO_VAULT_SCORE_PROXY_SECRET_PATH).catch((err: any) => {
        logger.error(`could not read Vault secret at path ${EGO_VAULT_SCORE_PROXY_SECRET_PATH}`);
        throw err; //fail fast
      })) as EgoApplicationCredential)
    : ({
        clientId: EGO_SCORE_PROXY_CLIENT_ID,
        clientSecret: EGO_SCORE_PROXY_CLIENT_SECRET,
      } as EgoApplicationCredential);

  /**
   * Returned Methods
   * */

  const getAuth = async () => {
    if (latestJwt && egoTokenUtils.isValidJwt(latestJwt)) {
      return latestJwt;
    }
    logger.debug(`Score Proxy JWT is no longer valid, fetching new token from ego...`);
    return await egoClient.getApplicationJwt(scoreProxyAppCredentials);
  };

  return {
    getAuth,
  };
};
