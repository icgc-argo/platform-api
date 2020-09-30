import { EsFileCentricDocument } from 'utils/commonTypes/EsFileCentricDocument';

const validateFileAccess = async (config: {
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

export default validateFileAccess;
