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
function initializePlugin() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("[Debug] Starting plugin initialization...");
            // Get selected node details
            const selection = figma.currentPage.selection;
            if (selection.length === 0) {
                console.log("[Debug] No selection");
                figma.notify("Please select a node with styles applied");
                return;
            }
            const node = selection[0];
            // Log EVERYTHING about the node
            console.log("[Debug] Full node dump:", {
                name: node.name,
                type: node.type,
                id: node.id,
                visible: node.visible,
                locked: node.locked,
                opacity: node.opacity,
                blendMode: node.blendMode,
                effectStyleId: node.effectStyleId,
                fillStyleId: node.fillStyleId,
                strokeStyleId: node.strokeStyleId,
                backgroundStyleId: node.backgroundStyleId,
                textStyleId: node.textStyleId,
                gridStyleId: node.gridStyleId,
                styles: node.styles,
                fills: node.fills,
                strokes: node.strokes,
                effects: node.effects,
                characters: node.characters
            });
            // Check if node has any fills
            if ('fills' in node) {
                const fills = node.fills;
                console.log("[Debug] Node fills detailed:", fills === null || fills === void 0 ? void 0 : fills.map((fill) => ({
                    type: fill.type,
                    visible: fill.visible,
                    blendMode: fill.blendMode,
                    color: fill.type === 'SOLID' ? fill.color : undefined,
                    gradientStops: fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL' ? fill.gradientStops : undefined,
                    imageHash: fill.type === 'IMAGE' ? fill.imageHash : undefined,
                    scaleMode: fill.type === 'IMAGE' ? fill.scaleMode : undefined,
                    scalingFactor: fill.type === 'IMAGE' ? fill.scalingFactor : undefined,
                    rotation: fill.type === 'GRADIENT_LINEAR' ? fill.rotation : undefined,
                    opacity: fill.opacity
                })));
            }
            // Check if the node has any styles object
            if ('styles' in node) {
                const styles = node.styles;
                console.log("[Debug] Node styles object:", styles);
                // Try to get each style referenced in the styles object
                for (const [styleType, styleId] of Object.entries(styles)) {
                    try {
                        const style = figma.getStyleById(styleId);
                        console.log(`[Debug] Found style for ${styleType}:`, {
                            id: styleId,
                            name: style === null || style === void 0 ? void 0 : style.name,
                            type: style === null || style === void 0 ? void 0 : style.type,
                            remote: style === null || style === void 0 ? void 0 : style.remote,
                            key: style === null || style === void 0 ? void 0 : style.key,
                            description: style === null || style === void 0 ? void 0 : style.description
                        });
                        // If it's a paint style, log its paint properties
                        if ((style === null || style === void 0 ? void 0 : style.type) === 'PAINT') {
                            const paintStyle = style;
                            console.log(`[Debug] Paint style details for ${styleType}:`, {
                                paints: paintStyle.paints,
                                description: paintStyle.description
                            });
                        }
                    }
                    catch (e) {
                        console.log(`[Debug] Error getting style for ${styleType}:`, e);
                    }
                }
            }
            // Try to get all paint styles in the document
            const localPaintStyles = yield figma.getLocalPaintStylesAsync();
            console.log("[Debug] Local paint styles:", localPaintStyles.map(style => ({
                id: style.id,
                name: style.name,
                type: style.type,
                remote: style.remote,
                key: style.key,
                description: style.description,
                paints: style.paints
            })));
            // Get all variables
            const variables = yield figma.variables.getLocalVariablesAsync();
            const colorVariables = variables.filter(v => v.resolvedType === 'COLOR');
            console.log("[Debug] Found variables:", {
                total: variables.length,
                colors: colorVariables.length,
                variables: colorVariables.map(v => ({
                    name: v.name,
                    id: v.id,
                    type: v.resolvedType,
                    remote: v.remote,
                    key: v.key,
                    description: v.description,
                    valuesByMode: v.valuesByMode
                }))
            });
            // Try to match styles with variables
            const suggestions = new Map();
            localPaintStyles.forEach(style => {
                // Find matching variable by name
                const matchingVar = colorVariables.find(v => {
                    const styleName = style.name.toLowerCase();
                    const varName = v.name.toLowerCase();
                    return styleName === varName ||
                        styleName.endsWith('/' + varName) ||
                        varName.endsWith('/' + styleName);
                });
                if (matchingVar) {
                    suggestions.set(style.id, matchingVar.id);
                    console.log("[Debug] Found style-variable match:", {
                        style: style.name,
                        variable: matchingVar.name
                    });
                }
            });
            // Send data to UI
            figma.ui.postMessage({
                type: 'init',
                data: {
                    styles: localPaintStyles.map(s => ({
                        id: s.id,
                        name: s.name,
                        remote: s.remote,
                        key: s.key,
                        paints: s.paints
                    })),
                    variables: colorVariables.map(v => ({
                        id: v.id,
                        name: v.name,
                        remote: v.remote,
                        valuesByMode: v.valuesByMode
                    })),
                    suggestions: Object.fromEntries(suggestions)
                }
            });
        }
        catch (error) {
            console.error("[Debug] Error in initializePlugin:", error);
            figma.notify("Error initializing plugin: " + error.message, { error: true });
        }
    });
}
// Initialize the plugin
initializePlugin().catch(error => {
    console.error('Error initializing plugin:', error);
    figma.notify('Error initializing plugin', { error: true });
});
// Handle messages from UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'apply-mapping') {
        try {
            const { styleId, variableId } = msg;
            // Get the style and variable
            const style = figma.getStyleById(styleId);
            const variable = (yield figma.variables.getLocalVariablesAsync())
                .find(v => v.id === variableId);
            if (!style || !variable) {
                throw new Error("Style or variable not found");
            }
            // Find all nodes using this style
            const nodesWithStyle = figma.currentPage.findAll(node => ('fillStyleId' in node && node.fillStyleId === styleId) ||
                ('strokeStyleId' in node && node.strokeStyleId === styleId));
            // Update each node
            let updatedCount = 0;
            for (const node of nodesWithStyle) {
                try {
                    if ('fills' in node) {
                        // Create a new fill with the variable
                        const newFill = {
                            type: 'SOLID',
                            color: { r: 0, g: 0, b: 0 },
                            opacity: 1
                        };
                        // Bind the variable to the fill
                        const boundFill = figma.variables.setBoundVariableForPaint(newFill, 'color', variable);
                        // Apply the fill
                        node.fills = [boundFill];
                        updatedCount++;
                    }
                }
                catch (e) {
                    console.error("[Debug] Error updating node:", e);
                }
            }
            figma.notify(`Updated ${updatedCount} instances`);
        }
        catch (error) {
            console.error("[Debug] Error in apply-mapping:", error);
            figma.notify("Error applying mapping: " + error.message, { error: true });
        }
    }
    if (msg.type === 'close') {
        figma.closePlugin();
    }
});
