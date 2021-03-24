import { formatISO } from 'date-fns';
import logger from 'utils/logger';

export const validateISODate = (dateInput: string | Date) => {
  const date = new Date(dateInput);
  try {
    const result = formatISO(date);
    return !!result;
  } catch (err) {
    logger.error(`Date string can't be used as an ISO string: ${err}`);
    return false;
  }
};

export const convertStringToISODate = (dateInput: string | Date) => {
  const date = new Date(dateInput);
  const result = formatISO(date);
  return new Date(result);
};
