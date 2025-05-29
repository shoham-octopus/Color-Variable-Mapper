# Color Variable Mapper

A Figma plugin that helps designers map color styles to color variables, making it easier to maintain consistent color systems across designs.

## Features

- Map existing color styles to color variables
- Automatic suggestions for matching styles based on name similarity
- Batch update all instances of a color style to use variables
- Modern UI with color previews and easy selection

## Development

### Prerequisites

- Node.js (Latest LTS version recommended)
- Figma Desktop app for testing

### Setup

1. Clone the repository
```bash
git clone [your-repo-url]
cd Color-Variable-Mapper
```

2. Install dependencies
```bash
npm install
```

3. Build the plugin
```bash
npm run build
```

4. To watch for changes during development
```bash
npm run watch
```

### Loading the Plugin in Figma

1. In Figma, go to Plugins > Development > Import plugin from manifest
2. Select the `manifest.json` file from this project

## Project Structure

- `code.ts` - Main plugin logic
- `ui.html` - Plugin UI implementation
- `manifest.json` - Plugin configuration
- `package.json` - Project dependencies and scripts

## License

MIT

## Author

[Your Name] 