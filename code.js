"use strict";
/// <reference types="@figma/plugin-typings" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, {
    width: 400,
    height: 500,
    themeColors: true
});
// Get all styles and variables
console.log("[Debug] Starting to gather styles and variables...");
function initializePlugin() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try different methods to get styles
            console.log("[Debug] Current page:", figma.currentPage.name);
            console.log("[Debug] Document:", {
                name: figma.root.name,
                type: figma.root.type,
                children: figma.root.children.length
            });
            // Get styles using different methods
            const localPaintStyles = yield figma.getLocalPaintStylesAsync();
            console.log("[Debug] Local paint styles:", {
                count: localPaintStyles.length,
                styles: localPaintStyles.map(s => ({
                    name: s.name,
                    id: s.id,
                    description: s.description,
                    key: s.key
                }))
            });
            // Try to find nodes that have styles applied
            const nodesWithStyles = figma.currentPage.findAll(node => {
                if ('fillStyleId' in node) {
                    return node.fillStyleId !== '';
                }
                return false;
            });
            console.log("[Debug] Nodes with fill styles:", {
                count: nodesWithStyles.length,
                nodes: nodesWithStyles.map(n => ({
                    name: n.name,
                    type: n.type,
                    styleId: n.fillStyleId
                }))
            });
            if (localPaintStyles.length === 0) {
                console.log("[Debug] No color styles found in the file. Please create some color styles first.");
                figma.notify("No color styles found in the file. Please create some color styles first.");
                return;
            }
            const colorVariables = yield figma.variables.getLocalVariablesAsync().then(vars => {
                const colorVars = vars.filter(v => v.resolvedType === 'COLOR');
                console.log("[Debug] Color variables:", colorVars.map(v => ({
                    name: v.name,
                    type: v.resolvedType,
                    key: v.key,
                    id: v.id
                })));
                return colorVars;
            });
            console.log('Initialized with:', {
                colorStyles: localPaintStyles.length,
                colorVariables: colorVariables.length
            });
            // Initialize UI with styles and variables
            const styleData = localPaintStyles.map(style => {
                // Get the first solid paint
                const paints = style.paints;
                console.log(`[Debug] Style "${style.name}" paints:`, {
                    count: paints.length,
                    types: paints.map(p => p.type),
                    raw: paints
                });
                const firstSolidPaint = paints.find(paint => paint.type === 'SOLID');
                console.log(`[Debug] Processing style "${style.name}":`, {
                    id: style.id,
                    paintTypes: paints.map(p => p.type),
                    firstSolidColor: firstSolidPaint === null || firstSolidPaint === void 0 ? void 0 : firstSolidPaint.color
                });
                return {
                    id: style.id,
                    name: style.name,
                    color: firstSolidPaint.color
                };
            });
            const variableData = colorVariables.map(variable => ({
                id: variable.id,
                name: variable.name
            }));
            // Create suggestions map
            const suggestions = {};
            for (const style of styleData) {
                const bestMatch = findBestVariableMatch(style.name, colorVariables);
                if (bestMatch) {
                    suggestions[style.id] = bestMatch;
                }
            }
            console.log('[Debug] Final data being sent to UI:', {
                styles: styleData,
                variables: variableData,
                suggestions
            });
            // Send initial data to UI
            figma.ui.postMessage({
                type: 'init',
                styles: styleData,
                variables: variableData,
                suggestions
            });
        }
        catch (error) {
            console.error("[Debug] Error in initializePlugin:", error);
            figma.notify("Error initializing plugin: " + error.message, { error: true });
        }
    });
}
// Function to get the similarity score between two strings
function stringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    // If the strings are exactly the same, return 1
    if (s1 === s2)
        return 1;
    // If one string contains the other, return 0.8
    if (s1.includes(s2) || s2.includes(s1))
        return 0.8;
    // Split into words and check for common words
    const words1 = new Set(s1.split(/[^a-z0-9]+/));
    const words2 = new Set(s2.split(/[^a-z0-9]+/));
    let commonWords = 0;
    for (const word of words1) {
        if (words2.has(word))
            commonWords++;
    }
    // Return a score based on common words
    return commonWords / Math.max(words1.size, words2.size);
}
// Function to find the best variable match for a style
function findBestVariableMatch(styleName, variables) {
    let bestMatch = null;
    let bestScore = 0;
    for (const variable of variables) {
        const score = stringSimilarity(styleName, variable.name);
        if (score > bestScore && score > 0.5) { // Only suggest if similarity > 50%
            bestScore = score;
            bestMatch = { id: variable.id };
        }
    }
    return bestMatch;
}
// Handle messages from UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (msg.type === 'apply-mapping') {
        try {
            console.log('Received mappings:', msg.mappings);
            let mappedCount = 0;
            // Get fresh copies of styles and variables
            const paintStyles = yield figma.getLocalPaintStylesAsync();
            const colorVariables = yield figma.variables.getLocalVariablesAsync().then(vars => vars.filter(v => v.resolvedType === 'COLOR'));
            // Apply the selected mappings
            for (const [styleId, variableId] of Object.entries(msg.mappings)) {
                console.log('Processing mapping:', { styleId, variableId });
                const style = paintStyles.find(s => s.id === styleId);
                const variable = colorVariables.find(v => v.id === variableId);
                if (!style) {
                    console.log('Style not found:', styleId);
                    continue;
                }
                if (!variable) {
                    console.log('Variable not found:', variableId);
                    continue;
                }
                console.log('Found style and variable:', {
                    styleName: style.name,
                    variableName: variable.name
                });
                try {
                    // Get the current color from the variable
                    const collection = variable.variableCollectionId;
                    const modeId = (_a = (yield figma.variables.getVariableCollectionByIdAsync(collection))) === null || _a === void 0 ? void 0 : _a.modes[0].modeId;
                    if (!modeId) {
                        console.error('Could not find mode ID for variable');
                        continue;
                    }
                    // Get the current color value
                    const currentValue = variable.valuesByMode[modeId];
                    if (typeof currentValue !== 'object' || !('r' in currentValue)) {
                        console.error('Invalid variable value:', currentValue);
                        continue;
                    }
                    // Find all nodes using this style
                    const nodes = figma.currentPage.findAll(node => {
                        // Check if node has the required properties
                        return node.type !== 'SLICE'
                            && 'fillStyleId' in node
                            && 'fills' in node
                            && node.fillStyleId === style.id;
                    });
                    console.log(`Found ${nodes.length} nodes using style ${style.name}`);
                    // Update each node to use the variable
                    for (const node of nodes) {
                        try {
                            console.log('Processing node:', {
                                name: node.name,
                                type: node.type,
                                fillStyleId: node.fillStyleId
                            });
                            // Store the original style ID
                            yield node.setPluginData('originalStyleId', style.id);
                            // Create a solid fill with the current color
                            const solidFill = {
                                type: 'SOLID',
                                color: currentValue,
                                opacity: 1
                            };
                            // Apply the fill and bind the variable
                            const boundFill = figma.variables.setBoundVariableForPaint(solidFill, 'color', variable);
                            console.log('Created bound fill:', boundFill);
                            // Apply the fill to the node
                            node.fills = [boundFill];
                            mappedCount++;
                            console.log('Successfully updated node:', node.name);
                        }
                        catch (nodeError) {
                            console.error('Error updating node:', {
                                name: node.name,
                                error: nodeError
                            });
                        }
                    }
                    // Update the style description to indicate it's been converted
                    style.description = `Converted to variable: ${variable.name}`;
                }
                catch (error) {
                    console.error('Error updating style:', {
                        styleId,
                        variableId,
                        styleName: style.name,
                        variableName: variable.name,
                        error: error.message
                    });
                }
            }
            const message = `Successfully mapped ${mappedCount} instances to variables`;
            console.log(message);
            figma.notify(message);
        }
        catch (error) {
            console.error('Error applying mappings:', error);
            figma.notify('Error applying mappings', { error: true });
        }
    }
    if (msg.type === 'close') {
        figma.closePlugin();
    }
});
// Initialize the plugin
initializePlugin().catch(error => {
    console.error('Error initializing plugin:', error);
    figma.notify('Error initializing plugin', { error: true });
});
// Log when the plugin is ready
console.log("[Debug] Plugin initialization complete");
