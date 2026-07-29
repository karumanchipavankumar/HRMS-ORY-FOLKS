## Form Validation Implementation Guide

This document provides a comprehensive guide for implementing form validations across the HRMS application.

### ✅ COMPLETED IMPLEMENTATIONS

#### 1. **Validation Utilities** (`src/utils/formValidation.js`)
   - ✅ Name validation (32 chars, alphabets+spaces only)
   - ✅ Mobile number validation (11 digits)
   - ✅ Aadhaar validation (12 digits)
   - ✅ PAN validation (10 characters, format: AAAAA9999A)
   - ✅ Address validation (252 chars max, 5 chars min)
   - ✅ Email validation (standard email regex)
   - ✅ Date of birth validation (18+ years, future date check)
   - ✅ File upload validation (5MB max, allowed formats: PDF, ZIP, DOC, DOCX, JPG, JPEG, PNG)
   - ✅ Passport validation (8-9 alphanumeric)
   - ✅ Emergency relationship validation
   - ✅ Utility functions for sanitization and character counting

#### 2. **Form Validation Hook** (`src/hooks/useFormValidation.js`)
   - ✅ Custom React hook for managing form state
   - ✅ Real-time and on-submit validation
   - ✅ Error tracking per field
   - ✅ Touch state management
   - ✅ Form reset functionality

#### 3. **Validation Components & Styling** 
   - ✅ FormFieldError component for displaying errors
   - ✅ FormFieldWrapper for consistent field styling
   - ✅ FileUploadValidationInfo component
   - ✅ CharacterCounter component
   - ✅ ValidationSummary component
   - ✅ CSS styling for error states (formValidation.css)

#### 4. **AddEmployeeModal Updates** (`src/components/AddEmployeeModal.jsx`)
   - ✅ Imported validation functions
   - ✅ Added fieldErrors state
   - ✅ Updated handleNext with comprehensive validation
   - ✅ Updated handleSubmit with validation
   - ✅ Updated First Name field with validation
   - ✅ Updated Middle Name field with validation
   - ✅ Updated Last Name field with validation
   - ✅ Updated Email field with validation
   - ✅ Updated Phone Number field with 11-digit validation
   - ✅ Updated Date of Birth field with validation
   - ✅ Updated Gender field with validation
   - ✅ Updated Role field with validation
   - ✅ Updated Designation field with validation
   - ✅ Updated Joining Date field with validation
   - ✅ Error messages display below fields
   - ✅ Red border on fields with errors

---

### 🔄 IN-PROGRESS IMPLEMENTATIONS

#### EmployeeOwnProfile.jsx - PRIORITY UPDATES

**Location:** `src/pages/employee/EmployeeOwnProfile.jsx`

**Required Changes:**

1. **Add Imports:**
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

2. **Add Validation State:**
```javascript
const [fieldErrors, setFieldErrors] = useState({});
const [touched, setTouched] = useState({});
```

3. **Update handleChange Method:**
   - Add real-time validation for each field
   - Update name fields to use `sanitizeName()` and `validateName()`
   - Update mobile fields to use `sanitizeMobileNumber()` and `validateMobileNumber()`
   - Add validation for Aadhaar, PAN, addresses

4. **Update Personal Details Section HTML:**
   - Wrap inputs with `FormFieldError` components
   - Add red border styling for errors
   - Add character counter for address fields
   - Add `maxLength` attribute for name fields (32)
   - Add `maxLength` attribute for address fields (252)

5. **Emergency Relationship Field:**
   - Replace text input with dropdown
   - Options: Father, Mother, Brother, Sister
   - Add validation

6. **File Upload Section:**
   - Add `validateFileUpload()` validation
   - Display file size error if > 5MB
   - Show accepted formats info
   - Validate file types

---

### 📋 REMAINING IMPLEMENTATIONS

#### EmployeeProfile.jsx
- Same updates as EmployeeOwnProfile (shares identical fields)
- Respect admin/HR permission restrictions
- Add validation state
- Update error display

#### Other Components to Update
- `HRActions.jsx` - if it has profile editing features
- `ReportingManagers.jsx` - if it has employee management
- `CompanyDetailsModal.jsx` - add validation for company fields

---

### 🎨 STYLING NOTES

All error messages use the CSS class `field-error` with:
- Color: #ef4444 (red)
- Font size: 0.875rem (14px)
- Display: block
- Margin top: 0.25rem

Fields with errors get:
- Class: `input-error`, `select-error`, or `textarea-error`
- Border color: #ef4444
- Background: #fef2f2 (light red)

---

### ✨ VALIDATION RULES SUMMARY

| Field | Max Length | Min Length | Format | Error Message |
|-------|-----------|-----------|--------|---------------|
| Name Fields | 32 | 1 | Alphabets + spaces | "Only alphabets are allowed, max 32 characters." |
| Mobile | 11 digits | 11 digits | Digits only | "Mobile number must be exactly 11 digits." |
| Aadhaar | 12 digits | 12 digits | Digits only | "Aadhaar number must be exactly 12 digits." |
| PAN | 10 chars | 10 chars | AAAAA9999A | "PAN number must be exactly 10 characters." |
| Address | 252 | 5 | Any | "Address cannot exceed 252 characters." |
| Email | - | - | Valid email | "Please enter a valid email address" |
| DOB | - | - | 18+ years | "You must be at least 18 years old" |
| File | 5 MB | - | PDF, ZIP, DOC, DOCX, JPG, PNG | "File size must not exceed 5MB." |
| Passport | 9 | 8 | Alphanumeric | "Passport number must be 8-9 characters" |

---

### 🚀 IMPLEMENTATION CHECKLIST

- [x] Create validation utilities (formValidation.js)
- [x] Create validation hook (useFormValidation.js)
- [x] Create validation components (FormValidation.jsx)
- [x] Create validation CSS (formValidation.css)
- [x] Update AddEmployeeModal
- [ ] Update EmployeeOwnProfile
  - [ ] Add imports
  - [ ] Add validation state
  - [ ] Update handleChange method
  - [ ] Update personal details section
  - [ ] Update emergency contact section
  - [ ] Update address fields
  - [ ] Fix relationship dropdown
  - [ ] Add file upload validation
- [ ] Update EmployeeProfile
- [ ] Test all validations across all portals
- [ ] Test form submit blocking when errors exist
- [ ] Test real-time validation
- [ ] Test error message display

---

### 💡 IMPLEMENTATION TIPS

1. **Real-time Validation:** Call validation on `onChange` for fields that have been touched
2. **On-Submit Validation:** Validate all fields before allowing form submission
3. **Error Display:** Only show errors for fields that have been touched or on form submit
4. **Button Disable:** Disable submit button if any errors exist
5. **Character Counter:** Show for address fields as they approach 252-char limit
6. **Sanitization:** Apply real-time character filtering for name and number fields
7. **Mobile Numbers:** Always require exactly 11 digits (India country code specific)
8. **Relationship Dropdown:** Must be mandatory with fixed options only

---

### 🔗 RELATED FILES

- Validation utilities: `src/utils/formValidation.js`
- Validation hook: `src/hooks/useFormValidation.js`
- Validation components: `src/components/FormValidation.jsx`
- Validation CSS: `src/styles/formValidation.css`
- AddEmployeeModal: `src/components/AddEmployeeModal.jsx` ✅
- EmployeeOwnProfile: `src/pages/employee/EmployeeOwnProfile.jsx` (IN PROGRESS)
- EmployeeProfile: `src/pages/admin/EmployeeProfile.jsx` (PENDING)
