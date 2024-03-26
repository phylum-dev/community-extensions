type Uses = {
    [packageName: string]: string;
}

type Package = {
    name: string;
    package_version: string;
    language: string;
    uses: Uses[];
    used_by: Uses[];
    sources: string[];
};

type LanguagePackage = {
    [packageName: string]: Package[];
};

export type GrootDeepJson = {
    javascript: LanguagePackage;
    python: LanguagePackage; 
    ruby: LanguagePackage;
    kotlin: LanguagePackage;
    java: LanguagePackage;
    go: LanguagePackage;
}

export enum Ecosystem {
    Npm = "npm",
    Pypi = "pypi",
    RubyGems = "rubygems",
    Java = "maven",
    Go = "golang",
}
