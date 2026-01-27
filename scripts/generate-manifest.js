const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const FEATURES_DIR = path.join(SRC_DIR, 'features');
const PACKAGE_BASE_PATH = path.join(ROOT_DIR, 'package.base.json');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const FEATURE_SCHEMA_PATH = path.join(__dirname, 'feature-schema.json');

// 初始化 JSON Schema 验证器
const ajv = new Ajv({ allErrors: true, strict: false });
let featureSchema = null;
let validateFeature = null;

/**
 * 加载并编译 feature.json schema
 */
function loadFeatureSchema() {
    try {
        if (fs.existsSync(FEATURE_SCHEMA_PATH)) {
            featureSchema = JSON.parse(fs.readFileSync(FEATURE_SCHEMA_PATH, 'utf-8'));
            validateFeature = ajv.compile(featureSchema);
            console.log('✓ Feature schema loaded');
            return true;
        } else {
            console.warn('⚠ Feature schema not found, skipping validation');
            return false;
        }
    } catch (error) {
        console.warn('⚠ Failed to load feature schema:', error.message);
        return false;
    }
}

/**
 * 验证 feature.json 配置
 * @param {object} config - feature.json 内容
 * @param {string} featureName - 功能模块名称
 * @returns {boolean} 是否验证通过
 */
function validateFeatureConfig(config, featureName) {
    if (!validateFeature) {
        return true; // 没有 schema 时跳过验证
    }

    const valid = validateFeature(config);
    if (!valid) {
        console.warn(`⚠ Validation warnings for ${featureName}/feature.json:`);
        for (const error of validateFeature.errors) {
            const path = error.instancePath || '(root)';
            console.warn(`   - ${path}: ${error.message}`);
        }
        return false;
    }
    return true;
}

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

    // 加载 feature schema
    loadFeatureSchema();

    const basePackage = loadJson(PACKAGE_BASE_PATH);
    if (!basePackage) {
        console.error('Failed to load package.base.json');
        process.exit(1);
    }

    // Initialize contributes if not present
    if (!basePackage.contributes) {
        basePackage.contributes = {};
    }

    let validationWarnings = 0;

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
                // 验证 feature.json
                if (!validateFeatureConfig(featureConfig, featureName)) {
                    validationWarnings++;
                }

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

    if (validationWarnings > 0) {
        console.log(`\n⚠ Generated package.json with ${validationWarnings} validation warning(s)`);
    } else {
        console.log('✓ Successfully generated package.json');
    }
}

main();
