module.exports = {
	env: {
		es6: true,
		node: true,
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'prettier',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 'latest',
		extraFileExtensions: ['.json'],
		project: ['./tsconfig.json'],
	},
	plugins: ['@typescript-eslint', 'prettier'],
	root: true,
	rules: {
		'@typescript-eslint/no-empty-interface': [
			'warn',
			{
				allowSingleExtends: false,
			},
		],
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-unused-vars': [
			'warn', // or "error"
			{
				argsIgnorePattern: '^_',
			},
		],
		'@typescript-eslint/no-var-requires': 'off',
		'import/first': ['warn', 'absolute-first'],
		'import/order': [
			'warn',
			{
				groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
				'newlines-between': 'always',
				warnOnUnassignedImports: true,
			},
		],
		'import/newline-after-import': 'warn',

		'prettier/prettier': [
			'error',
			{
				printWidth: 100,
				trailingComma: 'all',
				semi: true,
				singleQuote: true,
				useTabs: true,
			},
		],
	},
	settings: {
		// 'import/internal-regex': '^@/', //we should aim at using declarative internal imports
		'import/resolver': {
			typescript: {
				project: './tsconfig.json',
			},
		},
		'import/parsers': {
			'@typescript-eslint/parser': ['.js', '.jsx', '.ts', '.tsx'],
		},
	},
};
