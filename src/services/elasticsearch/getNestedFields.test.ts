import { getNestedFields } from './index';
import { EsFieldMapping } from './types';

describe('getNestedFields', () => {
  it('must work', () => {
    const inputMapping: EsFieldMapping = {
      properties: {
        ['field1']: {
          type: 'nested',
          properties: {
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
