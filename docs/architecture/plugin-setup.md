# Health Connect Plugin Setup Plan

## Current Issues
- Plugin resolution failing during prebuild
- TypeScript file not being compiled
- Plugin location may not be optimal

## Solution Steps

1. **Create Plugin Directory Structure**
   - Create `plugins` directory in project root
   - Move `withHealthConnectManifest.ts` to `plugins/health-connect/`
   - Ensure proper TypeScript compilation setup

2. **Update Plugin Configuration**
   - Create a package.json for the plugin
   - Set up TypeScript compilation
   - Ensure proper exports

3. **Update App Configuration**
   - Update plugin reference in app.config.js
   - Ensure proper plugin resolution

4. **Testing**
   - Run prebuild to verify plugin resolution
   - Verify Android manifest modifications

## Implementation Details

### Plugin Directory Structure
```
plugins/
  health-connect/
    package.json
    tsconfig.json
    src/
      withHealthConnectManifest.ts
    build/
      withHealthConnectManifest.js
```

### Required Changes
1. Move plugin to dedicated directory
2. Set up TypeScript compilation
3. Update app.config.js reference
4. Test with prebuild command

### Expected Outcome
- Successful plugin resolution during prebuild
- Proper Android manifest modification
- Clean project structure