/** @todo: use these types */

export type ArrayFieldKeys = 'in' | 'is' | 'filter';

export type ScalarFieldKeys = '>=' | '<=' | '>' | '<';

export type CombinationKeys = 'and' | 'or' | 'not';

export type ArrayFieldValue = Array<string | number> | string;
export type ScalarFieldValue = number;

export interface FilterField {
  fields: string[];
  value: ArrayFieldValue;
}

export interface FilterFieldOperator {
  op: ArrayFieldKeys;
  content: FilterField;
}

export interface ArrayField {
  field: string;
  value: ArrayFieldValue;
}

export interface ScalarField {
  field: string;
  value: ScalarFieldValue;
}

export interface ArrayFieldOperator {
  op: ArrayFieldKeys;
  content: ArrayField;
}

export interface ScalarFieldOperator {
  op: ScalarFieldKeys;
  content: ScalarField;
}

export type FieldOperator = ArrayFieldOperator | ScalarFieldOperator;

export type RecursiveFilter = {
  op: CombinationKeys;
  content: Array<RecursiveFilter | FieldOperator | FilterFieldOperator>;
};
