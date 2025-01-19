import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
})

const eslintConfig = [
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        'varsIgnorePattern': '^mousePosition$',
        'argsIgnorePattern': '^_',
        'ignoreRestSiblings': true
      }]
    }
  }),
]

export default eslintConfig
