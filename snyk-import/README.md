# Snyk Import Extension

This extension imports Snyk projects into Phylum by retrieving dependency
information from the Snyk API and submitting the dependencies as a new analysis
job to a Phylum project of the same name.

## Installation

Clone the repository and install the extension via the Phylum CLI:

```console
git clone https://github.com/phylum-dev/community-extensions
phylum extension install community-extensions/snyk-import/
```

## Running

To import all of your current Snyk projects:

```
phylum snyk-import --group <phylum_group>
```

Or, setup a [Snyk service account] and use the token to import all projects in a
Snyk org:

```
SNYK_TOKEN=<service_token> phylum snyk-import --group <phylum_group>
```

[Snyk service account]: https://docs.snyk.io/enterprise-setup/service-accounts

## Behavior

The extension enumerates all accessible projects for the given token and
attempts to import each of them. Projects with no dependencies are skipped.
