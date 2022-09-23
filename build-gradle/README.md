# `build.gradle` Extension for Phylum
This extension will take a provided `build.gradle` project and attempt to determine the concrete dependencies in use, before submitting to the Phylum API.

## Installation and Basic Usage
Clone the repository and install the extension via the Phylum CLI.

```console
git clone https://github.com/phylum-dev/community-extensions
phylum extension install community-extensions/build-gradle/
```

## Running
From a directory containing a `build.gradle` file, run `phylum build-gradle` to analyze the project and all subprojects.
