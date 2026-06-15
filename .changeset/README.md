# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
Each markdown file here describes a set of package changes and the semver bump
(`major` / `minor` / `patch`) they require. They are consumed by the release
workflow and removed when a release is cut.

## Adding a changeset

After making a change that should ship in a release, run:

```sh
pnpm changeset
```

Pick the affected packages and the bump type, then write a short summary. Commit
the generated file in `.changeset/` alongside your code.
