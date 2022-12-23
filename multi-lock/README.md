# Multi-lock

This extension allows a user to submit multiple lockfiles to a single phylum project.

## Usage

To analyze multiple lockfiles in a single job:

```
$ phylum multi-lock backend/go.sum frontend/package-lock.json
```

## Details

This extension simply parses each provided lockfile and combines the packages
in a single list. It then submits that list for analysis.

Note: Information about which lockfile contains a given package is discarded in
this process. The results in the UI will be shown as if all packages came from
a single lockfile.
