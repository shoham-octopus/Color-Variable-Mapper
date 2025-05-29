/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { 
  width: 400, 
  height: 500,
  themeColors: true
});

async function initializePlugin() {
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
      locked: (node as any).locked,
      opacity: (node as any).opacity,
      blendMode: (node as any).blendMode,
      effectStyleId: (node as any).effectStyleId,
      fillStyleId: (node as any).fillStyleId,
      strokeStyleId: (node as any).strokeStyleId,
      backgroundStyleId: (node as any).backgroundStyleId,
      textStyleId: (node as any).textStyleId,
      gridStyleId: (node as any).gridStyleId,
      styles: (node as any).styles,
      fills: (node as any).fills,
      strokes: (node as any).strokes,
      effects: (node as any).effects,
      characters: (node as any).characters
    });

    // Check if node has any fills
    if ('fills' in node) {
      const fills = (node as any).fills;
      console.log("[Debug] Node fills detailed:", fills?.map((fill: any) => ({
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
      const styles = (node as any).styles;
      console.log("[Debug] Node styles object:", styles);
      
      // Try to get each style referenced in the styles object
      for (const [styleType, styleId] of Object.entries(styles)) {
        try {
          const style = figma.getStyleById(styleId as string);
          console.log(`[Debug] Found style for ${styleType}:`, {
            id: styleId,
            name: style?.name,
            type: style?.type,
            remote: style?.remote,
            key: style?.key,
            description: style?.description
          });

          // If it's a paint style, log its paint properties
          if (style?.type === 'PAINT') {
            const paintStyle = style as PaintStyle;
            console.log(`[Debug] Paint style details for ${styleType}:`, {
              paints: paintStyle.paints,
              description: paintStyle.description
            });
          }
        } catch (e) {
          console.log(`[Debug] Error getting style for ${styleType}:`, e);
        }
      }
    }

    // Try to get all paint styles in the document
    const localPaintStyles = await figma.getLocalPaintStylesAsync();
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
    const variables = await figma.variables.getLocalVariablesAsync();
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
    const suggestions = new Map<string, string>();
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

  } catch (error) {
    console.error("[Debug] Error in initializePlugin:", error);
    figma.notify("Error initializing plugin: " + (error as Error).message, { error: true });
  }
}

// Initialize the plugin
initializePlugin().catch(error => {
  console.error('Error initializing plugin:', error);
  figma.notify('Error initializing plugin', { error: true });
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'apply-mapping') {
    try {
      const { styleId, variableId } = msg;
      
      // Get the style and variable
      const style = figma.getStyleById(styleId);
      const variable = (await figma.variables.getLocalVariablesAsync())
        .find(v => v.id === variableId);

      if (!style || !variable) {
        throw new Error("Style or variable not found");
      }

      // Find all nodes using this style
      const nodesWithStyle = figma.currentPage.findAll(node => 
        ('fillStyleId' in node && node.fillStyleId === styleId) ||
        ('strokeStyleId' in node && node.strokeStyleId === styleId)
      );

      // Update each node
      let updatedCount = 0;
      for (const node of nodesWithStyle) {
        try {
          if ('fills' in node) {
            // Create a new fill with the variable
            const newFill: SolidPaint = {
              type: 'SOLID',
              color: { r: 0, g: 0, b: 0 },
              opacity: 1
            };

            // Bind the variable to the fill
            const boundFill = figma.variables.setBoundVariableForPaint(
              newFill,
              'color',
              variable
            );

            // Apply the fill
            (node as any).fills = [boundFill];
            updatedCount++;
          }
        } catch (e) {
          console.error("[Debug] Error updating node:", e);
        }
      }

      figma.notify(`Updated ${updatedCount} instances`);
    } catch (error) {
      console.error("[Debug] Error in apply-mapping:", error);
      figma.notify("Error applying mapping: " + (error as Error).message, { error: true });
    }
  }
  
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};