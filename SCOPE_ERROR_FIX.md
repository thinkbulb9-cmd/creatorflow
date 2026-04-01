# Scope Error Fix - editingConcept is not defined

**Date:** April 1, 2026
**Error:** `ReferenceError: editingConcept is not defined` at line 1819 in app/page.js

## Root Cause

The state variables `editingConcept` and `editedConcept` were declared in the main `App` component, but were being used inside the `ProjectDetailView` component, which is a separate function component without access to the parent's scope.

## Solution

Moved the state variables to the correct component scope and passed necessary functions as props.

### Changes Made:

1. **Added Local State to ProjectDetailView:**
```javascript
function ProjectDetailView({ ... }) {
  // Local states for concept editing
  const [editingConcept, setEditingConcept] = useState(false);
  const [editedConcept, setEditedConcept] = useState('');
  
  // ... rest of component
}
```

2. **Updated ProjectDetailView Props:**
```javascript
function ProjectDetailView({ 
  project, 
  onBack, 
  onDelete, 
  onRunStep, 
  onSelectThumbnail, 
  onUpdateConcept,        // NEW
  onApplySuggestedTopic,  // NEW
  onRunFullPipeline,      // NEW
  loading, 
  pollingVideo, 
  youtubeStatus, 
  pipelineRunning,        // NEW
  calculateProgress, 
  getCurrentStep 
}) {
  // ...
}
```

3. **Updated Parent Component to Pass Props:**
```javascript
<ProjectDetailView 
  project={selectedProject}
  onBack={() => { ... }}
  onDelete={deleteProject}
  onRunStep={runPipelineStep}
  onSelectThumbnail={selectThumbnail}
  onUpdateConcept={updateProjectConcept}           // NEW
  onApplySuggestedTopic={applySuggestedTopic}      // NEW
  onRunFullPipeline={runFullPipeline}              // NEW
  loading={loading}
  pollingVideo={pollingVideo}
  youtubeStatus={youtubeStatus}
  pipelineRunning={pipelineRunning}                // NEW
  calculateProgress={calculateProgress}
  getCurrentStep={getCurrentStep}
/>
```

4. **Updated Function Calls in UI:**
- Changed `updateProjectConcept()` → `onUpdateConcept()`
- Changed `applySuggestedTopic()` → `onApplySuggestedTopic()`
- Changed `runFullPipeline()` → `onRunFullPipeline()`

5. **Removed Duplicate State from App Component:**
Removed the unused state declarations from the main App component since they're now in ProjectDetailView.

## Files Modified

- `/app/app/page.js`
  - Line 1648-1651: Added local state to ProjectDetailView
  - Line 1644-1659: Updated function signature with new props
  - Lines 727-744: Updated parent component to pass new props
  - Line 1868: Changed to `onUpdateConcept`
  - Line 1906: Changed to `onApplySuggestedTopic`
  - Line 1985: Changed to `onRunFullPipeline`
  - Lines 70-74: Removed duplicate state declarations

## Testing

✅ App compiles without errors
✅ No runtime errors in browser
✅ Server logs clean
✅ Page loads successfully

## Lesson Learned

When using component composition in React:
1. State must be declared in the component that uses it, or passed as props
2. Child components don't have access to parent component's state unless explicitly passed
3. Callback functions should be passed as props when child needs to trigger parent's state changes

## Next Steps

- Manual testing of the Idea Evaluation editing flow
- Testing the suggested topics functionality
- Testing the One-Click Pipeline button
