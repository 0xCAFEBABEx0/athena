import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import reactHooks from 'eslint-plugin-react-hooks'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // react-hooks v7 promoted these to errors; the flagged patterns
      // (theme hydration from localStorage, clickable-card refs) predate
      // the upgrade and come from the Payload website template.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    ignores: ['.next/', 'src/app/(payload)/admin/importMap.js', 'src/migrations/'],
  },
]

export default eslintConfig
