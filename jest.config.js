module.exports = {
  // [...]
  // Replace `ts-jest` with the preset you want to use
  // from the above list
  preset: 'ts-jest',
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    paralleljs: '<rootDir>/node_modules/paralleljs/lib/parallel.js',
  },
};
