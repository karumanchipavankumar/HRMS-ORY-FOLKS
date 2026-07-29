## Quick Update Guide: EmployeeProfile Component

**File:** `src/pages/admin/EmployeeProfile.jsx`  
**Estimated Time:** 15-20 minutes  
**Difficulty:** Easy (Copy-paste from EmployeeOwnProfile)

---

## Step-by-Step Instructions

### Step 1: Add Imports (at the top of file)

After the existing imports, add:

```javascript
import {
    validateName,
    validateEmail,
    validateMobileNumber,
    validateAadhaar,
    validatePAN,
    validateAddress,
    validateFileUpload,
    validateDateOfBirth,
    sanitizeName,
    sanitizeMobileNumber,
    EMERGENCY_RELATIONSHIPS,
    validateEmergencyRelationship
} from "../../utils/formValidation";
import { FormFieldError, FileUploadValidationInfo, CharacterCounter } from "../../components/FormValidation";
import "../../styles/formValidation.css";
```

### Step 2: Add State Variables

Find where state variables are declared and add:

```javascript
const [fieldErrors, setFieldErrors] = useState({});
const [touched, setTouched] = useState({});
```

### Step 3: Add handleBlur Method

Find the `handleChange` method and add this new method right after it:

```javascript
const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    
    // Validate on blur
    let error = null;
    if (['firstName', 'middleName', 'lastName', 'emergencyContactName'].includes(name)) {
      const validation = validateName(value);
      error = validation.error;
    } else if (['mobile', 'alternateMobile', 'emergencyPhone'].includes(name)) {
      const validation = validateMobileNumber(value);
      error = validation.error;
    } else if (name === 'aadhar') {
      const validation = validateAadhaar(value);
      error = validation.error;
    } else if (name === 'pan') {
      const validation = validatePAN(value);
      error = validation.error;
    } else if (['currentAddress', 'permanentAddress', 'emergencyAddress'].includes(name)) {
      if (value.trim()) {
        const validation = validateAddress(value);
        error = validation.error;
      }
    } else if (name === 'personalEmail') {
      const validation = validateEmail(value);
      error = validation.error;
    } else if (name === 'dob') {
      const validation = validateDateOfBirth(value);
      error = validation.error;
    } else if (name === 'emergencyRelationship') {
      const validation = validateEmergencyRelationship(value);
      error = validation.error;
    }
    
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };
```

### Step 4: Update handleChange Method

Replace the existing `handleChange` method with this enhanced version:

```javascript
const handleChange = (e) => {
    const { name, value } = e.target;
    let validatedValue = value;
    let error = null;

    // Sanitize and validate based on field type
    if (['firstName', 'middleName', 'lastName', 'emergencyContactName'].includes(name)) {
      validatedValue = sanitizeName(value);
      const validation = validateName(validatedValue);
      error = validation.error;
    } else if (['mobile', 'alternateMobile', 'emergencyPhone'].includes(name)) {
      validatedValue = sanitizeMobileNumber(value);
      const validation = validateMobileNumber(validatedValue);
      error = validation.error;
    } else if (name === 'aadhar') {
      validatedValue = value.replace(/\D/g, "").slice(0, 12);
      const validation = validateAadhaar(validatedValue);
      error = validation.error;
    } else if (name === 'pan') {
      validatedValue = value.toUpperCase().slice(0, 10);
      const validation = validatePAN(validatedValue);
      error = validation.error;
    } else if (['currentAddress', 'permanentAddress', 'emergencyAddress'].includes(name)) {
      validatedValue = value.slice(0, 252);
      if (value.trim()) {
        const validation = validateAddress(validatedValue);
        error = validation.error;
      }
    } else if (name === 'personalEmail') {
      const validation = validateEmail(value);
      error = validation.error;
    } else if (name === 'dob') {
      const validation = validateDateOfBirth(value);
      error = validation.error;
    } else if (name === 'emergencyRelationship') {
      const validation = validateEmergencyRelationship(value);
      error = validation.error;
    }

    setForm((f) => ({ ...f, [name]: validatedValue }));
    
    // Update error state if field has been touched
    if (touched[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };
```

### Step 5: Update Form Field Inputs

For EACH name field (firstName, middleName, lastName), add:
- `onBlur={handleBlur}`
- Add conditional className for red border: `${fieldErrors.fieldName && touched.fieldName ? 'ring-2 ring-red-500 bg-red-50' : ''}`
- Add `maxLength="32"`
- Add error display:
  ```javascript
  {fieldErrors.fieldName && touched.fieldName && <FormFieldError error={fieldErrors.fieldName} show={true} />}
  ```

Example:
```javascript
<input
  name="firstName"
  value={form.firstName || ''}
  onChange={handleChange}
  onBlur={handleBlur}
  disabled={!editing}
  maxLength="32"
  className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.firstName && touched.firstName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
  placeholder="First Name"
/>
{fieldErrors.firstName && touched.firstName && <FormFieldError error={fieldErrors.firstName} show={true} />}
```

### Step 6: Update Mobile Fields

For mobile and alternateMobile fields:
- Add `onBlur={handleBlur}` to input
- Add error styling
- Add error message display below the input div
- Add `maxLength="15"`

### Step 7: Update Aadhaar and PAN Fields

Add:
- `onBlur={handleBlur}`
- Error styling
- Error message display
- `maxLength="12"` for Aadhaar, `maxLength="10"` for PAN

### Step 8: Update Address Fields

For currentAddress, permanentAddress, emergencyAddress textareas:
- Add `onBlur={handleBlur}`
- Add error styling
- Add error message display
- Add `maxLength="252"`
- Add character counter: `<CharacterCounter current={(form.fieldName || '').length} max={252} />`

Example:
```javascript
<textarea
  name="currentAddress"
  value={form.currentAddress || ''}
  onChange={handleChange}
  onBlur={handleBlur}
  disabled={!editing}
  maxLength="252"
  className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.currentAddress && touched.currentAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
/>
{fieldErrors.currentAddress && touched.currentAddress && <FormFieldError error={fieldErrors.currentAddress} show={true} />}
<CharacterCounter current={(form.currentAddress || '').length} max={252} />
```

### Step 9: Update Emergency Relationship Field

**CRITICAL:** Replace the text input with a dropdown!

Old code (find this):
```javascript
<input
  name="emergencyRelationship"
  value={form.emergencyRelationship || ''}
  onChange={handleChange}
  // ... other props
/>
```

New code (replace with this):
```javascript
<select
  name="emergencyRelationship"
  value={form.emergencyRelationship || ''}
  onChange={handleChange}
  onBlur={handleBlur}
  disabled={!editing}
  className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.emergencyRelationship && touched.emergencyRelationship ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
>
  <option value="">Select Relationship</option>
  {EMERGENCY_RELATIONSHIPS.map((rel) => (
    <option key={rel} value={rel}>{rel}</option>
  ))}
</select>
{fieldErrors.emergencyRelationship && touched.emergencyRelationship && (
  <FormFieldError error={fieldErrors.emergencyRelationship} show={true} />
)}
```

### Step 10: Save and Test

1. Save the file
2. Open Employee Profile in the admin dashboard
3. Test validation:
   - Try entering numbers in name fields → should be rejected
   - Try entering more than 32 chars in name → should be truncated
   - Try entering phone number with letters → should be rejected
   - Try entering Aadhaar with letters → should be rejected
   - Try entering address > 252 chars → should be truncated
   - Check that character counter works for addresses
   - Check that emergency relationship is a dropdown with no free text
   - Check that error messages appear when fields are invalid

---

## Common Patterns

### For Text Input Fields
```javascript
<input
  name="fieldName"
  value={form.fieldName || ''}
  onChange={handleChange}
  onBlur={handleBlur}
  disabled={!editing}
  maxLength="32"  // or appropriate limit
  className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.fieldName && touched.fieldName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
/>
{fieldErrors.fieldName && touched.fieldName && <FormFieldError error={fieldErrors.fieldName} show={true} />}
```

### For Textarea Fields  
```javascript
<textarea
  name="fieldName"
  value={form.fieldName || ''}
  onChange={handleChange}
  onBlur={handleBlur}
  disabled={!editing}
  maxLength="252"
  className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.fieldName && touched.fieldName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
/>
{fieldErrors.fieldName && touched.fieldName && <FormFieldError error={fieldErrors.fieldName} show={true} />}
<CharacterCounter current={(form.fieldName || '').length} max={252} />
```

### For Dropdown Fields
```javascript
<select
  name="fieldName"
  value={form.fieldName || ''}
  onChange={handleChange}
  onBlur={handleBlur}
  disabled={!editing}
  className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.fieldName && touched.fieldName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
>
  <option value="">Select Option</option>
  {optionsArray.map(opt => <option key={opt} value={opt}>{opt}</option>)}
</select>
{fieldErrors.fieldName && touched.fieldName && <FormFieldError error={fieldErrors.fieldName} show={true} />}
```

---

## Checklist

- [ ] Add imports at top of file
- [ ] Add fieldErrors and touched state
- [ ] Add handleBlur method
- [ ] Update handleChange method
- [ ] Update firstName field
- [ ] Update middleName field
- [ ] Update lastName field
- [ ] Update email field
- [ ] Update mobile field
- [ ] Update alternateMobile field
- [ ] Update dob field
- [ ] Update aadhar field
- [ ] Update pan field
- [ ] Update passport field
- [ ] Update currentAddress field with counter
- [ ] Update permanentAddress field with counter
- [ ] Update emergencyContactName field
- [ ] **Update emergencyRelationship to DROPDOWN**
- [ ] Update emergencyPhone field
- [ ] Update emergencyAddress field with counter
- [ ] Test all validations
- [ ] Verify error messages display
- [ ] Verify character counters work

---

## Testing Checklist

- [ ] Can't enter numbers in name fields
- [ ] Can't exceed 32 chars in name fields
- [ ] Email validation works
- [ ] Mobile validation requires 11 digits
- [ ] Aadhaar validation requires 12 digits
- [ ] PAN validation requires 10 chars
- [ ] Address counter shows 0-252
- [ ] Can't exceed 252 chars in address
- [ ] Emergency relationship is dropdown only
- [ ] Emergency relationship has 4 fixed options
- [ ] Error messages appear when invalid
- [ ] Error messages disappear when corrected
- [ ] Red border appears on error fields
- [ ] All existing functionality still works

---

**Need Help?** 
- Compare with `EmployeeOwnProfile.jsx` for reference
- All validation functions are in `src/utils/formValidation.js`
- All components are in `src/components/FormValidation.jsx`
- CSS styling is in `src/styles/formValidation.css`
