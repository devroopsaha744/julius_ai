# Duplicate Key Error Fix

## Issue
React was throwing an error about duplicate keys when transitioning between interview stages:
```
Error: Encountered two children with the same key, `1756378926203`. Keys should be unique...
```

## Root Cause
The issue was caused by using `Date.now()` as the key for message components. When multiple messages were added rapidly (like during stage transitions), they could get the same timestamp, resulting in duplicate keys.

## Fixes Applied

### 1. Unique ID Generator
```typescript
// Unique ID generator to prevent duplicate keys
const generateUniqueId = (() => {
  let counter = 0;
  return () => `${Date.now()}-${++counter}`;
})();
```

### 2. Updated Message Functions
- `addMessage()` and `addSystemMessage()` now use `generateUniqueId()` instead of `Date.now().toString()`
- Added duplicate prevention logic to avoid adding the same message twice within 1 second

### 3. Stage Change Debouncing
- Modified `stage_changed` event handler to only update if the stage actually changed
- Prevents duplicate stage transition messages

## Result
- ✅ Each message now has a guaranteed unique key
- ✅ Duplicate messages are prevented
- ✅ Stage transitions work smoothly without duplicate key errors
- ✅ React rendering is stable and efficient

The fix ensures that even during rapid stage transitions or multiple quick events, each React component will have a unique key, eliminating the duplicate key warning.
