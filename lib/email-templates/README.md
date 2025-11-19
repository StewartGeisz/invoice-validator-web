# Email Templates

This directory contains HTML email templates for automated notifications.

## Templates

### `contact-notification.html`
Email sent to the contact person (main contact, FUM, or admin) with:
- Validation results
- Invoice PDF attachment
- Status badge (passed/failed/partial)
- Detailed validation information

**Variables:**
- `{{contactPerson}}` - Name of the contact person
- `{{vendorName}}` - Vendor name
- `{{overallStatus}}` - Status class (passed/failed/partial)
- `{{statusText}}` - Status text
- `{{poStatus}}`, `{{poReason}}` - PO validation details
- `{{dateStatus}}`, `{{dateReason}}` - Date validation details
- `{{rateStatus}}`, `{{rateReason}}` - Rate validation details
- `{{filename}}` - Invoice filename
- `{{hasAttachment}}` - Conditional flag for attachment notice

### `admin-summary.html`
Email sent to the administrative assistant with:
- Processing summary
- Next step information (who received the email and why)
- Validation details
- Timestamp

**Variables:**
- `{{filename}}` - Invoice filename
- `{{vendorName}}` - Vendor name
- `{{overallStatus}}` - Status class
- `{{statusText}}` - Status text
- `{{nextStepRecipient}}` - Email address of next step recipient
- `{{nextStepRole}}` - Role of next step recipient
- `{{nextStepReason}}` - Reason for routing
- `{{poStatus}}`, `{{poReason}}` - PO validation details
- `{{dateStatus}}`, `{{dateReason}}` - Date validation details
- `{{rateStatus}}`, `{{rateReason}}` - Rate validation details
- `{{timestamp}}` - Processing timestamp

## Customization

Edit the HTML files directly. The template engine uses simple variable replacement (`{{variable}}`) and conditional blocks (`{{#if condition}}...{{/if}}`).

