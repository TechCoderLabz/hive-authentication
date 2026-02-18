# CSS Conflict Resolution Guide

This guide helps you resolve CSS conflicts when using the Hive Authentication package in your project.

## 🚨 Common CSS Issues

### 1. **CSS Not Loading**
If you see unstyled components, the CSS file might not be imported.

**Solution**: Import the CSS file in your project:
```tsx
import 'hive-authentication/build.css';
```

### 2. **CSS Conflicts with Existing Styles**
Your project's CSS might be overriding the package styles.

**Solution**: The build.css file is designed to avoid conflicts, but you can customize if needed.

### 3. **Z-index Issues**
Modals might appear behind other elements.

**Solution**: The package uses high z-index values (9999) to avoid conflicts.

## 🎯 Solutions

### Solution 1: Import CSS File (Recommended)

The package includes a pre-built CSS file that you can import:

```tsx
import 'hive-authentication/build.css';
import { AuthButton } from 'hive-authentication';

function App() {
  return (
    <div>
      <AuthButton encryptionKey="your-encryption-key" {...requiredAuthButtonProps} /> {/* Uses pre-built CSS */}
    </div>
  );
}
```

**Benefits**:
- ✅ No CSS conflicts
- ✅ Pre-built and optimized
- ✅ Easy to import
- ✅ Consistent styling

### Solution 2: Manual CSS Import

Copy the CSS file to your project and import it:

```bash
cp node_modules/hive-authentication/dist/build.css src/styles/hive-auth.css
```

```tsx
import './styles/hive-auth.css';
import { AuthButton } from 'hive-authentication';
```

### Solution 3: Custom CSS Classes

Override package styles with your own CSS:

```css
/* Your project's CSS */
.btn-primary {
  background-color: #your-color !important;
  border-radius: 8px !important;
}

.modal {
  z-index: 10000 !important;
}
```

## 🔧 Advanced Configuration

### Custom Theme Integration

Override CSS variables or use custom classes:

```css
/* Your project's CSS */
:root {
  --p: 220 13% 18%; /* Primary color */
  --s: 215 27% 96%; /* Secondary color */
}

.btn-primary {
  background-color: hsl(var(--p)) !important;
}
```

### CSS-in-JS Integration

Use with styled-components or emotion:

```tsx
import styled from 'styled-components';
import { AuthButton } from 'hive-authentication';

const StyledAuthButton = styled(AuthButton)`
  background-color: ${props => props.theme.primaryColor};
  border-radius: ${props => props.theme.borderRadius};
`;

function App() {
  return (
    <div>
      <StyledAuthButton encryptionKey="your-encryption-key" {...requiredAuthButtonProps} />
    </div>
  );
}
```

## 📱 Responsive Design

The package includes mobile-first responsive design:

- **Mobile**: Bottom-up modals, compact layouts
- **Desktop**: Centered modals, full layouts
- **Tablet**: Adaptive layouts

## 🎨 Customization Examples

### Example 1: Brand Colors
```css
/* Your project's CSS */
.btn-primary {
  background-color: #FF6B6B !important;
  border-color: #FF6B6B !important;
}

.btn-primary:hover {
  background-color: #FF5252 !important;
}
```

### Example 2: Custom Modal Styling
```css
/* Your project's CSS */
.modal-box {
  background-color: #1a1a1a !important;
  color: #ffffff !important;
  border: 2px solid #333 !important;
}
```

## 🚀 Performance Tips

1. **Import CSS Once**: Import the CSS file only once in your app
2. **Avoid !important**: Use CSS specificity instead when possible
3. **Minimize Overrides**: Let the package handle styling
4. **Bundle Optimization**: The CSS file is pre-built and optimized

## 🔍 Troubleshooting

### Issue: Styles Not Applying
1. Check if the CSS file is imported
2. Verify the import path is correct
3. Check for CSS specificity conflicts

### Issue: Modal Not Visible
1. Check z-index conflicts
2. Verify CSS is loaded
3. Check for JavaScript errors

### Issue: Responsive Issues
1. Check viewport meta tag
2. Verify CSS media queries
3. Test on different devices

## 📚 Additional Resources

- [CSS Modules Documentation](https://github.com/css-modules/css-modules)
- [Tailwind CSS Configuration](https://tailwindcss.com/docs/configuration)
- [DaisyUI Documentation](https://daisyui.com/)

## 🆘 Still Having Issues?

If you're still experiencing CSS conflicts:

1. **Check the console** for CSS loading errors
2. **Verify the CSS file** is imported correctly
3. **Check for CSS conflicts** with your existing styles
4. **Open an issue** on GitHub with details

The package is designed to work in any React project with simple CSS import!
