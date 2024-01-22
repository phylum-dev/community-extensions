# `sarif` Extension for Phylum

This extension will take a Phylum project name (and optional group name),
retrieve the JSON for the latest job and produce a valid SARIF output.

## Installation and Basic Usage

Clone the repository and install the extension via the Phylum CLI:

```console
git clone https://github.com/phylum-dev/community-extensions
phylum extension install community-extensions/sarif/
```

## Running

To generate a SARIF file for a project, run:

```sh
phylum sarif --project <name>
```

Or optionally, if your project is in a group:

```sh
phylum sarif --project <name> --group <name>
```
