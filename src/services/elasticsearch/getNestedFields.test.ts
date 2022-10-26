import { getNestedFields } from './index';
import { EsFieldMapping } from './types';

describe('getNestedFields', () => {
	it('can retrieve all and only nested fields', () => {
		const inputMapping: EsFieldMapping = {
			properties: {
				['field1']: {
					type: 'nested',
					properties: {
						['some_field']: {
							type: 'keyword',
						},
						['child1']: {
							properties: {
								['child2']: {
									type: 'nested',
									properties: {
										['num']: {
											type: 'integer',
										},
									},
								},
							},
						},
					},
				},
			},
		};
		const expectedOutput = ['field1', 'field1.child1.child2'];
		expect(getNestedFields(inputMapping)).toEqual(expectedOutput);
	});
});
