/**
 * Tables in rich text (notes, page content columns, the About story).
 *
 * Payload 3 ships the table feature as EXPERIMENTAL_TableFeature: "This
 * feature may be removed or receive breaking changes in the future - even
 * within a stable lexical release" (docs/rich-text/official-features, 3.93).
 * Payload 4.0 makes it stable as `TableFeature` (codemod
 * `rename-experimental-table-feature`), so the editors import it from here
 * and the 4.0 migration renames it in this one file (issue #82).
 *
 * No schema change: tables are nodes inside the rich text JSON
 * (`table` > `tablerow` > `tablecell`), rendered by apps/web/src/lib/richtext.ts.
 */
export { EXPERIMENTAL_TableFeature as TableFeature } from '@payloadcms/richtext-lexical'
