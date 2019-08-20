const INVALID_VALUE_ERROR_MESSAGE = 'The value is not permissible for this field.';
export const ERROR_MESSAGES = {
  NEW_SAMPLE_CONFLICT:
    'Sample is attached to two different specimens in your file. Samples can only be linked to a single specimen.',
  NEW_SPECIMEN_CONFLICT:
    'Specimen is attached to two different donors in your file. Specimens can only be linked to a single donor.',
  NEW_DONOR_CONFLICT: 'NEW DONOR CONFLICT', //TODO: Update once message is defined
  SAMPLE_BELONGS_TO_OTHER_SPECIMEN:
    'Sample has already been registered with a specimen. Samples can only be linked to a single specimen. Please correct your file or contact DCC to update the registered data.',
  SPECIMEN_BELONGS_TO_OTHER_DONOR:
    'Specimen has already been registered with a donor. Samples can only be linked to a single donor. Please correct your file or contact DCC to update the registered data.',
  INVALID_PROGRAM_ID:
    'Program ID does not match the program you are uploading to. Please include the correct Program ID.',
  MUTATING_EXISTING_DATA:
    'The value does not match the previously registered value for this sample. Please correct your file or contact DCC to update the registered data.',
  INVALID_FIELD_VALUE_TYPE: INVALID_VALUE_ERROR_MESSAGE,
  INVALID_BY_REGEX: INVALID_VALUE_ERROR_MESSAGE,
  INVALID_BY_SCRIPT: INVALID_VALUE_ERROR_MESSAGE,
  INVALID_ENUM_VALUE: INVALID_VALUE_ERROR_MESSAGE,
};
