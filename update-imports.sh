#!/bin/bash

# Update absolute imports
find . -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|@/src/providers/AuthProvider|@/src/providers/auth|g'

# Update relative imports
find . -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../providers/AuthProvider|../../providers/auth|g'
find . -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|../../../src/providers/AuthProvider|../../../src/providers/auth|g' 