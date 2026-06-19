# sanity-duplicate-and-rename

A bulk **document-duplication** component for **Sanity Studio** that scans documents by type, search, or custom GROQ, lets you pick which ones to clone, and creates renamed copies in one pass — with templated naming, optional reference stripping, automatic slug bumping, batch processing, and a dry-run preview.

[![npm](https://img.shields.io/npm/v/@liiift-studio/sanity-duplicate-and-rename.svg)](https://www.npmjs.com/package/@liiift-studio/sanity-duplicate-and-rename)
![Sanity](https://img.shields.io/badge/Sanity-v3%20%7C%20v4%20%7C%20v5-f03e2f.svg)
![React](https://img.shields.io/badge/React-18%20%7C%2019-61dafb.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

> **Heads up — this tool writes new documents to your dataset.** Each run can
> `client.create()` many copies at once, and by **default it strips references
> and bumps slugs** on the copies (see [What it does to your data](#what-it-does-to-your-data)).
> The original documents are never modified. Use **`dryRun`** to preview before
> writing, and read the safety notes below before pointing it at production.

---

## How it works

You mount the component with a Sanity `client` and an optional list of
`documentTypes`. You scan for documents (by type, by a title/name search, or with
your own GROQ query), select the ones you want, and hit duplicate. For each
selected document the component creates a **clean copy**: it drops the system
fields (`_id`, `_rev`, `_createdAt`, `_updatedAt`), optionally removes references,
optionally rewrites the slug to stay unique, renames the fields you name via a
**naming pattern**, and `client.create()`s the result — in batches. A `dryRun`
flag runs the whole flow without writing and returns a preview.

<p align="center">
  <img
    src="https://raw.githubusercontent.com/Liiift-Studio/sanity-duplicate-and-rename/main/assets/data-flow.svg?v=1"
    alt="Data flow: scan criteria build a GROQ query against the Sanity dataset; matched documents (capped at maxDocuments) are selected, then each is cleaned (system fields stripped), references optionally removed, slug optionally rewritten, and named fields renamed via the naming pattern; dryRun returns a preview while a real run calls client.create() in batches, producing a DuplicationResult of duplicated count, errors, and new document ids."
    width="420"
  />
</p>

Regenerate the diagram with `npm run capture` (source: `scripts/data-flow.mmd`).

---

## Features

- 🔎 **Flexible scan** — find documents by `_type`, by a `title`/`name` search, or with a **custom GROQ query**.
- ✅ **Selective duplication** — preview the matches and choose exactly which documents to copy.
- 🏷️ **Templated renaming** — rename chosen fields with `{original}`, `{index}`, `{timestamp}`, and `{date}` placeholders.
- 🧹 **Clean copies** — system fields (`_id`, `_rev`, `_createdAt`, `_updatedAt`) are always stripped from the copy.
- 🔗 **Reference handling** — `removeReferences` (default **on**) drops every `_type === 'reference'` so copies don't share linked objects; turn it off to keep them.
- 🐌 **Slug bumping** — `updateSlugs` (default **on**) appends `-copy-<timestamp>` to `slug.current` to reduce collisions (best-effort, not a hard uniqueness guarantee — see [What it does to your data](#what-it-does-to-your-data)).
- 📦 **Batch processing** — copies are created `batchSize` at a time, with a `maxDocuments` cap on the scan.
- 🧪 **Dry run** — preview the full operation (counts + would-be copies) without writing anything.
- 🛡️ **Originals untouched** — the source documents are only read; copies are brand-new documents.

---

## Installation

```bash
npm install @liiift-studio/sanity-duplicate-and-rename
```

Peer dependencies (you almost certainly already have these in a Studio):

```bash
npm install sanity @sanity/ui @sanity/icons react
```

---

## Quick start

Drop the component into a Studio tool or a custom desk pane and pass it a client:

```tsx
import DuplicateAndRename from '@liiift-studio/sanity-duplicate-and-rename'
import {useClient} from 'sanity'

export function DuplicateTool() {
	const client = useClient({apiVersion: '2024-01-01'})

	return (
		<DuplicateAndRename
			client={client}
			documentTypes={['post', 'product']}
			dryRun
			onComplete={(result) => {
				console.log(`Created ${result.duplicated} copies`, result.newDocuments)
			}}
			onError={(message) => console.error('Duplication failed:', message)}
		/>
	)
}
```

A named import is also available:

```tsx
import {DuplicateAndRename} from '@liiift-studio/sanity-duplicate-and-rename'
```

Start with `dryRun` set, confirm the preview, then remove it to write for real.

---

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `client` | `SanityClient` | — (required) | Sanity client used to scan and create documents. |
| `documentTypes` | `string[]` | `[]` | Types offered in the type selector. Empty means "all document types". |
| `batchSize` | `number` | `5` | How many copies are created per batch. |
| `maxDocuments` | `number` | `100` | Upper bound on documents returned by a scan. |
| `dryRun` | `boolean` | `false` | When true, runs the full flow without writing and returns preview ids. |
| `onComplete` | `(result: DuplicationResult) => void` | — | Called after a run with the result summary. |
| `onError` | `(error: string) => void` | — | Called when a scan or duplication fails. |

`DuplicationResult` is `{ duplicated: number; errors: string[]; newDocuments: string[] }`.

> `dryRun`, `batchSize`, and `maxDocuments` are passed as props and shown read-only
> in the UI's Settings panel. Naming pattern, fields-to-update, reference removal,
> and slug updates are configured **interactively in the component**.

### Naming pattern placeholders

The naming pattern (set in the UI, default `{original} - Copy`) is applied to each
field you list under "Fields to update" (default `title,name`):

| Placeholder | Replaced with |
|---|---|
| `{original}` | The original field value (falls back to `Document`). |
| `{index}` | The copy number within the run. |
| `{timestamp}` | `Date.now()` at duplication time. |
| `{date}` | Today's date, `YYYY-MM-DD`. |

> Each placeholder is substituted once per pattern (only the first occurrence of a
> given token is replaced), so use each token at most once.

---

## What it does to your data

- **Originals are never modified.** The component only reads source documents; every
  write is a `client.create()` of a new document.
- **Copies are cleaned.** `_id`, `_rev`, `_createdAt`, and `_updatedAt` are always
  removed so Sanity assigns fresh values.
- **References are removed by default.** With `removeReferences` on (the default),
  every nested `_type === 'reference'` is dropped from the copy — the copy does **not**
  link to the same referenced documents. Turn the toggle off to keep references as-is.
- **Slugs are bumped by default.** With `updateSlugs` on (the default), `slug.current`
  becomes `…-copy-<timestamp>` to reduce duplicate-slug collisions. This is best-effort,
  not a hard guarantee — uniqueness relies on a millisecond timestamp, so copies created
  in the same millisecond (or re-copying an already-bumped slug) can still collide.
- **Renaming is field-scoped.** Only the fields you list under "Fields to update" get
  the naming pattern applied; all other field values are copied verbatim.
- **No undo.** Created copies are real documents. Use `dryRun` to preview first, and
  remember slug uniqueness relies on a millisecond timestamp.

---

## Compatibility

| Peer dependency | Supported range |
|---|---|
| `sanity` | `^3.0.0 \|\| ^4.0.0 \|\| ^5.0.0` |
| `@sanity/ui` | `^1.0.0 \|\| ^2.0.0 \|\| ^3.0.0` |
| `@sanity/icons` | `^2.0.0 \|\| ^3.0.0` |
| `react` | `^18.0.0 \|\| ^19.0.0` |

---

## Part of the Liiift Sanity Tools suite

This is one of a family of Sanity Studio utilities by [Liiift Studio](https://liiift.studio).
Related tools include `sanity-bulk-data-operations` (bulk field fills/overwrites),
`sanity-search-and-delete` (bulk delete), and `sanity-export-data` (export to JSON/CSV).

---

## License

[MIT](https://github.com/Liiift-Studio/sanity-duplicate-and-rename/blob/main/LICENSE) © Quinn Keaveney / Liiift Studio
