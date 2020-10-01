import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';

export const hasSufficientProgramMembershipAccess = async (config: {
  egoJwtOrApiKey?: string;
  file?: EsFileCentricDocument;
}): Promise<boolean> => {
  /**
   * @todo: actually implement this function
   */
  if (config.egoJwtOrApiKey && config.file) {
    return true;
  } else {
    return true;
  }
};

export const hasSufficientDacoAccess = async (config: {
  egoJwtOrApiKey?: string;
  file?: EsFileCentricDocument;
}): Promise<boolean> => {
  return true;
};
