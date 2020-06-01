import fetch from 'node-fetch';
import { USE_VAULT, RECAPTCHA_SECRET_KEY, RECAPTCHA_VAULT_SECRET_PATH } from 'config';
import { loadVaultSecret } from 'services/vault';
import logger from 'utils/logger';

type ReCaptchaVerificationErrorCode =
  | 'missing-input-secret'
  | 'invalid-input-secret'
  | 'missing-input-response'
  | 'invalid-input-response'
  | 'bad-request'
  | 'timeout-or-duplicate';
type ReCaptchaVerificationResult = {
  // modeled after https://developers.google.com/recaptcha/docs/verify
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: Array<ReCaptchaVerificationErrorCode>;
};
type ReCaptchaVaultSecret = {
  secret_key: string;
};
export type ReCaptchaClient = {
  verifyUserResponse: (response: string) => Promise<ReCaptchaVerificationResult>;
};

const isReCaptchaSecretData = (data: { [k: string]: unknown }): data is ReCaptchaVaultSecret => {
  return typeof data['secret_key'] === 'string';
};

const getReCaptchaSecret = async () => {
  let secret: string;
  if (USE_VAULT) {
    const vaultData = await loadVaultSecret()(RECAPTCHA_VAULT_SECRET_PATH);
    if (isReCaptchaSecretData(vaultData)) {
      secret = vaultData.secret_key;
    } else {
      throw new Error('invalid reCaptcha secret retrieved from vault');
    }
  } else {
    secret = RECAPTCHA_SECRET_KEY;
  }
  return secret;
};

const createReCaptchaClient = async (): Promise<ReCaptchaClient> => {
  let reCaptchaSecretKey = await getReCaptchaSecret();
  const verifyUserResponse = async (response: string): Promise<ReCaptchaVerificationResult> =>
    fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${reCaptchaSecretKey}&response=${response}`,
      {
        method: 'POST',
      },
    ).then(res => res.json());

  logger.info('verifying reCaptcha secret');
  const testVerificationResponse = await verifyUserResponse('');
  const verificationErrorCodes =
    testVerificationResponse['error-codes'] || ([] as ReCaptchaVerificationErrorCode[]);
  if (
    verificationErrorCodes.includes('invalid-input-secret') ||
    verificationErrorCodes.includes('missing-input-secret')
  ) {
    throw new Error(
      'Failed to initialize ReCaptcha client, missing or invalid secret key. For local development, provide a reCaptcha secret key through the RECAPTCHA_SECRET_KEY env var. Contact your admin for a secret, or create your own through google for local dev.',
    );
  }

  logger.info('successfully created reCaptcha client');
  return {
    verifyUserResponse,
  };
};

export default createReCaptchaClient;
