# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development build with watch mode using ESBuild
- `npm run build` - Production build with TypeScript type checking and bundling
- `npm run version` - Bump version in manifest.json and versions.json, then stage changes

## Architecture Overview

This is an Obsidian plugin that transforms nested tag hierarchies (e.g., `#parent|child|grandchild`) into structured graph relationships with custom node coloring capabilities.

**Core Plugin Architecture (`src/main.ts`)**
- `GraphNestedTagsPlugin` extends Obsidian's Plugin base class
- Uses method injection pattern to intercept the graph renderer's `setData` method
- Employs MutationObserver for persistent DOM color monitoring
- Processes nested tags before graph rendering to create hierarchical relationships

**Method Injection System**
- Preserves original `setData` method as `originalSetData` 
- Replaces `setData` with custom implementation that:
  - Parses nested tags using "|" separator
  - Creates missing parent tag nodes with proper metadata
  - Transfers file connections from nested tags to root tags
  - Establishes bidirectional parent-child links
  - Maintains search functionality with proper aliases

**Color Management System**
- Dual-layer color application: CSS injection + direct DOM manipulation
- MutationObserver monitors DOM changes for persistent color reapplication
- Supports both predefined color categories and custom node-name-based coloring
- Uses multiple CSS selector strategies and inline style forcing to override Obsidian's styling

**Settings Architecture (`src/settings.ts` & `src/settingsTab.ts`)**
- `GraphNestedTagsSettings` interface defines color configuration structure
- `CustomNodeColor` interface for user-defined node name to color mappings
- GUI settings tab with color pickers, toggles, and dynamic rule management
- Real-time color updates with immediate graph refresh

**Type System (`src/interfaces/`)**
- `GraphLeafWithCustomRenderer` - extends WorkspaceLeaf for graph renderer access
- `LeafRenderer` - defines renderer interface with setData method injection points

**Key Technical Details**
- Plugin relies on reverse-engineered Obsidian graph internals (not public API)
- Node processing creates comprehensive metadata (nodeType, level, cssClass, aliases)
- Color system uses CSS variables, attribute selectors, and style.setProperty for maximum override power
- File connections are intelligently transferred to maintain graph connectivity while creating hierarchy
- Search functionality preserved through alias system that includes file references

**Build Configuration**
- ESBuild bundles TypeScript source to `main.js` in CommonJS format
- External dependencies include Obsidian API and CodeMirror modules
- Development mode provides inline sourcemaps and watch mode
- Production build includes TypeScript type checking