const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const FEATURES_DIR = path.join(SRC_DIR, 'features');
const PACKAGE_BASE_PATH = path.join(ROOT_DIR, 'package.base.json');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}

function mergeArrays(target, source) {
    if (!source) return target;
    if (!target) return source;
    // Simple concatenation for arrays like commands, configuration properties (if array)
    // For arrays of objects with unique IDs (like views), we might want to check for duplicates, 
    // but VS Code usually handles duplicates by overriding or showing both. 
    // Let's just concat for now.
    return [...target, ...source];
}

function mergeObjects(target, source) {
    if (!source) return target;
    if (!target) return source;
    
    const result = { ...target };
    for (const key in source) {
        if (Array.isArray(source[key])) {
            result[key] = mergeArrays(result[key], source[key]);
        } else if (typeof source[key] === 'object' && source[key] !== null) {
            result[key] = mergeObjects(result[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

function main() {
    console.log('Generating package.json...');

    const basePackage = loadJson(PACKAGE_BASE_PATH);
    if (!basePackage) {
        console.error('Failed to load package.base.json');
        process.exit(1);
    }

    // Initialize contributes if not present
    if (!basePackage.contributes) {
        basePackage.contributes = {};
    }

    if (!fs.existsSync(FEATURES_DIR)) {
        console.warn('Features directory not found:', FEATURES_DIR);
    } else {
        let features = fs.readdirSync(FEATURES_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        // Sorting logic: core first, then others alphabetically
        features.sort((a, b) => {
            if (a === 'core') return -1;
            if (b === 'core') return 1;
            return a.localeCompare(b);
        });
        
        for (const featureName of features) {
            const featureJsonPath = path.join(FEATURES_DIR, featureName, 'feature.json');
            const featureConfig = loadJson(featureJsonPath);

            if (featureConfig) {
                console.log(`Merging feature: ${featureName}`);

                // Merge activationEvents
                if (featureConfig.activationEvents) {
                    basePackage.activationEvents = [
                        ...(basePackage.activationEvents || []),
                        ...featureConfig.activationEvents
                    ];
                    // Deduplicate activationEvents
                    basePackage.activationEvents = [...new Set(basePackage.activationEvents)];
                }

                // Merge contributes
                if (featureConfig.contributes) {
                    basePackage.contributes = mergeObjects(basePackage.contributes, featureConfig.contributes);
                }
            }
        }
    }

    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(basePackage, null, 2));
    console.log('Successfully generated package.json');
}

main();
