export type ArrayFieldKeys = 'in' | 'is' | 'filter';

export type ScalarFieldKeys = '>=' | '<=' | '>' | '<';

export type CombinationKeys = 'and' | 'or' | 'not';

export type ArrayFieldValue = Array<string | number> | string;
export type ScalarFieldValue = number;

export type ArrangerFilterFieldOperation = {
	op: ArrayFieldKeys | ScalarFieldKeys;
	content: {
		field: string;
		value: ArrayFieldValue;
	};
};

export type ArrangerFilterNode = ArrangerFilterFieldOperation | ArrangerFilter;

export type ArrangerFilter = {
	op: CombinationKeys;
	content: Array<ArrangerFilterNode>;
};
