/**
 * Help Content Seed
 * Phase 21: Help & Support Module
 * 
 * Seeds initial help articles and FAQs for the help center
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Help Article Categories
const ARTICLE_CATEGORIES = [
  'getting_started',
  'members',
  'finance',
  'payments',
  'reports',
  'governance',
  'welfare',
  'settings',
  'troubleshooting',
] as const;

// FAQ Categories
const FAQ_CATEGORIES = [
  'general',
  'account',
  'payments',
  'members',
  'finance',
  'technical',
] as const;

// Help Articles Data
const HELP_ARTICLES = [
  // Getting Started
  {
    slug: 'getting-started-guide',
    title: 'Getting Started with SocietyLedger',
    excerpt: 'Learn how to set up your association and start managing members and finances.',
    content: `# Getting Started with SocietyLedger

Welcome to SocietyLedger! This guide will help you get your association up and running quickly.

## Step 1: Complete Your Profile

After signing up, complete your association profile:
- Add your association name and description
- Upload your logo
- Set your contact information

## Step 2: Configure Financial Settings

Set up your financial categories:
- Create dues categories (monthly, annual, etc.)
- Set up levies for special projects
- Configure donation categories

## Step 3: Add Members

Import or add your members:
- Use bulk import for existing member lists
- Add members individually
- Assign roles and permissions

## Step 4: Start Recording Transactions

Begin tracking your finances:
- Record member payments
- Track expenses
- Generate receipts

## Need Help?

If you need assistance, create a support ticket or use our AI assistant for instant answers.`,
    category: 'getting_started',
    tags: ['onboarding', 'setup', 'beginner'],
    roleVisibility: ['admin', 'treasurer', 'member'],
    isFeatured: true,
  },
  {
    slug: 'admin-onboarding-checklist',
    title: 'Admin Onboarding Checklist',
    excerpt: 'A comprehensive checklist for administrators to set up their association.',
    content: `# Admin Onboarding Checklist

Use this checklist to ensure your association is properly configured.

## Association Setup
- [ ] Complete association profile
- [ ] Upload association logo
- [ ] Set up contact information
- [ ] Configure timezone and currency

## Financial Configuration
- [ ] Create financial categories
- [ ] Set up dues structure
- [ ] Configure payment methods
- [ ] Set up bank account details

## Member Management
- [ ] Import existing members
- [ ] Set up member categories
- [ ] Configure role permissions
- [ ] Send invitation emails

## Communication
- [ ] Set up notification preferences
- [ ] Configure email templates
- [ ] Test SMS integration (if applicable)

## Security
- [ ] Review role permissions
- [ ] Enable two-factor authentication
- [ ] Set up audit logging`,
    category: 'getting_started',
    tags: ['admin', 'setup', 'checklist'],
    roleVisibility: ['admin'],
    isFeatured: true,
  },
  // Members
  {
    slug: 'managing-members',
    title: 'Managing Members',
    excerpt: 'Learn how to add, edit, and manage association members.',
    content: `# Managing Members

This guide covers all aspects of member management in SocietyLedger.

## Adding Members

### Individual Addition
1. Navigate to Members > Add Member
2. Fill in member details
3. Assign a role
4. Click Save

### Bulk Import
1. Download the CSV template
2. Fill in member data
3. Upload the file
4. Review and confirm

## Editing Members

1. Go to Members list
2. Click on a member
3. Edit their details
4. Save changes

## Member Roles

- **Admin**: Full access to all features
- **Treasurer**: Financial management access
- **Member**: Basic access to personal information

## Deactivating Members

To deactivate a member:
1. Open member profile
2. Click "Deactivate"
3. Confirm the action

Deactivated members retain their history but cannot log in.`,
    category: 'members',
    tags: ['members', 'management', 'roles'],
    roleVisibility: ['admin', 'treasurer'],
    isFeatured: false,
  },
  {
    slug: 'bulk-member-import',
    title: 'Bulk Member Import Guide',
    excerpt: 'Step-by-step guide to importing multiple members at once.',
    content: `# Bulk Member Import Guide

Save time by importing multiple members at once using our bulk import feature.

## Preparing Your Data

### Download Template
1. Go to Members > Import
2. Click "Download Template"
3. Open the CSV file

### Required Fields
- First Name
- Last Name
- Email
- Phone Number

### Optional Fields
- Member ID
- Category
- Join Date
- Address

## Import Process

1. Fill in the template with your data
2. Save as CSV format
3. Upload the file
4. Review the preview
5. Confirm import

## Handling Errors

If errors occur:
- Check for duplicate emails
- Verify required fields are filled
- Ensure date formats are correct (YYYY-MM-DD)

## Tips

- Import in batches of 500 or less
- Validate email addresses before import
- Back up existing data first`,
    category: 'members',
    tags: ['import', 'bulk', 'csv'],
    roleVisibility: ['admin'],
    isFeatured: false,
  },
  // Finance
  {
    slug: 'understanding-financial-ledger',
    title: 'Understanding the Financial Ledger',
    excerpt: 'A complete guide to the member financial ledger system.',
    content: `# Understanding the Financial Ledger

The financial ledger is the heart of SocietyLedger's financial management.

## Ledger Overview

Each member has a personal ledger that tracks:
- Dues owed and paid
- Levies and special assessments
- Donations made
- Penalties incurred
- Payment history

## Transaction Types

### Debits (Charges)
- Dues assignments
- Levy assessments
- Penalties

### Credits (Payments)
- Cash payments
- Bank transfers
- Online payments

## Viewing Ledgers

### As Admin/Treasurer
1. Go to Finance > Member Ledgers
2. Select a member
3. View their complete history

### As Member
1. Go to My Finances
2. View your personal ledger

## Generating Statements

1. Select date range
2. Choose format (PDF/Excel)
3. Download or email`,
    category: 'finance',
    tags: ['ledger', 'transactions', 'finance'],
    roleVisibility: ['admin', 'treasurer', 'member'],
    isFeatured: true,
  },
  {
    slug: 'recording-payments',
    title: 'Recording Member Payments',
    excerpt: 'How to record and manage member payments.',
    content: `# Recording Member Payments

Learn how to record payments from members accurately.

## Payment Methods

SocietyLedger supports:
- Cash payments
- Bank transfers
- Online payments (Paystack, Flutterwave)
- Check payments

## Recording a Payment

1. Go to Finance > Transactions
2. Click "Record Payment"
3. Select the member
4. Enter payment details:
   - Amount
   - Payment method
   - Reference number
   - Date
5. Allocate to outstanding items
6. Save and generate receipt

## Bulk Payment Recording

For multiple payments:
1. Go to Finance > Bulk Payments
2. Upload payment file or enter manually
3. Review allocations
4. Confirm all payments

## Payment Receipts

Receipts are automatically generated and can be:
- Emailed to members
- Downloaded as PDF
- Printed directly`,
    category: 'finance',
    tags: ['payments', 'receipts', 'transactions'],
    roleVisibility: ['admin', 'treasurer'],
    isFeatured: false,
  },
  // Reports
  {
    slug: 'generating-financial-reports',
    title: 'Generating Financial Reports',
    excerpt: 'Create comprehensive financial reports for your association.',
    content: `# Generating Financial Reports

SocietyLedger provides powerful reporting tools for financial analysis.

## Available Reports

### Financial Summary
Overview of income, expenses, and balances.

### Member Balances
List of all members with their current balances.

### Aging Analysis
Breakdown of overdue payments by age.

### Collection Rate
Track payment collection efficiency.

### Category Reports
Income/expenses by category.

## Creating a Report

1. Go to Reports
2. Select report type
3. Set date range
4. Apply filters (optional)
5. Generate report

## Export Options

- PDF with branding
- Excel for analysis
- CSV for data processing

## Scheduled Reports

Set up automatic report generation:
1. Go to Reports > Scheduled
2. Create new schedule
3. Select report and frequency
4. Add recipients`,
    category: 'reports',
    tags: ['reports', 'analytics', 'export'],
    roleVisibility: ['admin', 'treasurer'],
    isFeatured: false,
  },
  // Governance
  {
    slug: 'managing-elections',
    title: 'Managing Elections and Voting',
    excerpt: 'Set up and manage elections for your association.',
    content: `# Managing Elections and Voting

Run fair and transparent elections with SocietyLedger.

## Creating an Election

1. Go to Governance > Elections
2. Click "Create Election"
3. Set election details:
   - Title and description
   - Positions to fill
   - Voting period
   - Eligibility criteria

## Adding Candidates

1. Open the election
2. Add positions
3. Register candidates
4. Set candidate profiles

## Voting Process

Members can vote:
1. During the voting period
2. One vote per position
3. Anonymous voting (configurable)

## Results

After voting closes:
- Results are automatically tallied
- Winners are determined
- Reports are generated

## Polls

For quick decisions:
1. Create a poll
2. Add options
3. Set voting period
4. Share with members`,
    category: 'governance',
    tags: ['elections', 'voting', 'governance'],
    roleVisibility: ['admin', 'member'],
    isFeatured: false,
  },
  // Settings
  {
    slug: 'configuring-roles-permissions',
    title: 'Configuring Roles and Permissions',
    excerpt: 'Set up custom roles and manage user permissions.',
    content: `# Configuring Roles and Permissions

Control access to features with role-based permissions.

## Default Roles

### Admin
- Full system access
- User management
- Settings configuration

### Treasurer
- Financial management
- Payment recording
- Report generation

### Member
- Personal dashboard
- Own financial records
- Voting participation

## Creating Custom Roles

1. Go to Settings > Roles
2. Click "Create Role"
3. Name the role
4. Select permissions
5. Save

## Permission Categories

- **Members**: View, create, edit, delete
- **Finance**: View, manage, approve
- **Reports**: View, generate, export
- **Settings**: View, edit

## Assigning Roles

1. Go to member profile
2. Click "Change Role"
3. Select new role
4. Save changes`,
    category: 'settings',
    tags: ['roles', 'permissions', 'security'],
    roleVisibility: ['admin'],
    isFeatured: false,
  },
  // Troubleshooting
  {
    slug: 'common-issues-solutions',
    title: 'Common Issues and Solutions',
    excerpt: 'Quick fixes for frequently encountered problems.',
    content: `# Common Issues and Solutions

Find quick solutions to common problems.

## Login Issues

### Forgot Password
1. Click "Forgot Password"
2. Enter your email
3. Check inbox for reset link
4. Create new password

### Account Locked
Contact your administrator to unlock your account.

## Payment Issues

### Payment Not Reflecting
- Check payment status with your bank
- Verify the reference number
- Contact support with transaction details

### Duplicate Payment
Contact your treasurer to process a refund or credit.

## Report Issues

### Report Not Loading
- Clear browser cache
- Try a different browser
- Reduce date range

### Export Failing
- Check file size limits
- Try exporting in batches

## Still Need Help?

If your issue isn't listed:
1. Search our help articles
2. Ask our AI assistant
3. Create a support ticket`,
    category: 'troubleshooting',
    tags: ['troubleshooting', 'issues', 'help'],
    roleVisibility: ['admin', 'treasurer', 'member'],
    isFeatured: true,
  },
];

// FAQ Data
const FAQS = [
  // General
  {
    question: 'What is SocietyLedger?',
    answer: 'SocietyLedger is a comprehensive management platform for associations, cooperatives, and community organizations. It helps you manage members, track finances, run elections, and communicate effectively with your community.',
    category: 'general',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 1,
  },
  {
    question: 'How do I get started?',
    answer: 'After signing up, complete the onboarding wizard to set up your association profile, configure financial settings, and add your first members. Our getting started guide provides step-by-step instructions.',
    category: 'general',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 2,
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we take security seriously. All data is encrypted in transit and at rest. We use industry-standard security practices, regular backups, and comply with data protection regulations.',
    category: 'general',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 3,
  },
  // Account
  {
    question: 'How do I reset my password?',
    answer: 'Click "Forgot Password" on the login page, enter your email address, and follow the instructions in the reset email. The link expires after 24 hours.',
    category: 'account',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 1,
  },
  {
    question: 'How do I update my profile?',
    answer: 'Go to your profile settings by clicking your avatar in the top right corner. You can update your name, email, phone number, and profile picture.',
    category: 'account',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 2,
  },
  {
    question: 'Can I change my email address?',
    answer: 'Yes, go to Profile Settings and update your email. You will need to verify the new email address before the change takes effect.',
    category: 'account',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 3,
  },
  // Payments
  {
    question: 'What payment methods are supported?',
    answer: 'We support bank transfers, card payments (via Paystack and Flutterwave), cash payments (recorded manually), and mobile money. Available methods depend on your subscription plan.',
    category: 'payments',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 1,
  },
  {
    question: 'How long do payments take to reflect?',
    answer: 'Online payments reflect immediately. Bank transfers may take 1-3 business days depending on your bank. Manual payments are recorded when your treasurer processes them.',
    category: 'payments',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 2,
  },
  {
    question: 'Can I get a receipt for my payment?',
    answer: 'Yes, receipts are automatically generated for all payments. You can view and download receipts from your payment history in My Finances.',
    category: 'payments',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 3,
  },
  {
    question: 'What if I made a duplicate payment?',
    answer: 'Contact your association treasurer or create a support ticket. They can process a refund or apply the extra payment as credit to your account.',
    category: 'payments',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 4,
  },
  // Members
  {
    question: 'How do I add new members?',
    answer: 'Go to Members > Add Member to add individuals, or use Members > Import to bulk import from a CSV file. You can also send invitation links for members to self-register.',
    category: 'members',
    roleVisibility: ['admin'],
    sortOrder: 1,
  },
  {
    question: 'Can members update their own information?',
    answer: 'Yes, members can update their profile information. However, certain fields like member ID and role can only be changed by administrators.',
    category: 'members',
    roleVisibility: ['admin', 'treasurer'],
    sortOrder: 2,
  },
  {
    question: 'How do I deactivate a member?',
    answer: 'Open the member profile and click "Deactivate". This preserves their history but prevents login. You can reactivate them later if needed.',
    category: 'members',
    roleVisibility: ['admin'],
    sortOrder: 3,
  },
  // Finance
  {
    question: 'How do I view my financial statement?',
    answer: 'Go to My Finances > My Ledger to see your complete financial history. You can filter by date range and download statements in PDF or Excel format.',
    category: 'finance',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 1,
  },
  {
    question: 'How are late payment penalties calculated?',
    answer: 'Penalties are configured by your association administrator. They can be a fixed amount or percentage, applied after a grace period. Check your association settings for specific rules.',
    category: 'finance',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 2,
  },
  {
    question: 'Can I dispute a charge on my account?',
    answer: 'Yes, contact your treasurer or create a support ticket explaining the issue. Include relevant details like the transaction date and amount.',
    category: 'finance',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 3,
  },
  // Technical
  {
    question: 'Which browsers are supported?',
    answer: 'SocietyLedger works best on modern browsers: Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated for the best experience.',
    category: 'technical',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 1,
  },
  {
    question: 'Is there a mobile app?',
    answer: 'SocietyLedger is a Progressive Web App (PWA). You can install it on your phone from your browser for an app-like experience. Go to your browser menu and select "Add to Home Screen".',
    category: 'technical',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 2,
  },
  {
    question: 'How do I report a bug?',
    answer: 'Create a support ticket with details about the issue: what you were doing, what happened, and any error messages. Screenshots are helpful!',
    category: 'technical',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 3,
  },
];

export async function seedHelpContent() {
  console.log('🌱 Seeding help content...');

  // Seed Help Articles
  let articleCount = 0;
  for (const article of HELP_ARTICLES) {
    await prisma.helpArticle.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        category: article.category,
        tags: article.tags,
        roleVisibility: article.roleVisibility,
        isFeatured: article.isFeatured,
        isPublished: true,
      },
      create: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        category: article.category,
        tags: article.tags,
        roleVisibility: article.roleVisibility,
        isFeatured: article.isFeatured,
        isPublished: true,
        associationId: null, // Global articles
      },
    });
    articleCount++;
  }

  console.log(`✅ Created/updated ${articleCount} help articles`);

  // Seed FAQs
  let faqCount = 0;
  for (const faq of FAQS) {
    // Check if FAQ exists by question (since we don't have a unique slug)
    const existing = await prisma.fAQItem.findFirst({
      where: { question: faq.question },
    });

    if (existing) {
      await prisma.fAQItem.update({
        where: { id: existing.id },
        data: {
          answer: faq.answer,
          category: faq.category,
          roleVisibility: faq.roleVisibility,
          sortOrder: faq.sortOrder,
          isActive: true,
        },
      });
    } else {
      await prisma.fAQItem.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          roleVisibility: faq.roleVisibility,
          sortOrder: faq.sortOrder,
          isActive: true,
          associationId: null, // Global FAQs
        },
      });
    }
    faqCount++;
  }

  console.log(`✅ Created/updated ${faqCount} FAQs`);
  console.log('🎉 Help content seed completed!');
}

// Run if executed directly
if (require.main === module) {
  seedHelpContent()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
