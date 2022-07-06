export type EsScalarFieldMapping = {
  type: 'keyword' | 'long' | 'integer';
};

export type EsNestedFieldMapping = {
  type: 'nested';
  properties: {
    [k: string]: EsFieldMapping;
  };
};

export type EsObjectFieldMapping = {
  properties: {
    [k: string]: EsFieldMapping;
  };
};

export type EsFieldMapping =
  | EsScalarFieldMapping
  | EsNestedFieldMapping
  | EsObjectFieldMapping;

export type EsIndexMapping = {
  [k: string]: {
    mappings: {
      properties: {
        [field: string]: EsFieldMapping;
      };
    };
  };
};
