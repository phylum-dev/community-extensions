# `sbomb` Extension for Phylum
This extension will take a provided lock file, submit it to Phylum for analysis and return the job data in structured SBOMB format.

## Installation and Basic Usage
Clone the repository and install the extension via the Phylum CLI.

```console
git clone https://github.com/phylum-dev/community-extensions
phylum extension install community-extensions/sbomb/
```

## Running
From a directory containing a lock file, run `phylum sbom <lockfile>`.