import { formatISO } from 'date-fns';
import logger from 'utils/logger';

export const convertStringToISODate = (dateInput: string | Date) => {
  const date = new Date(dateInput);
  try {
    const result = formatISO(date);
    return result;
  } catch (err) {
    logger.error(`Date string couldn't be converted to ISO string: ${err}`);
    return false;
  }
};