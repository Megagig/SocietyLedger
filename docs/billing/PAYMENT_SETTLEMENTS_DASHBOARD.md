# Payment Settlements Dashboard - User Guide

## 🎯 Overview

The Payment Settlements Dashboard provides a **user-friendly interface** for tracking and managing daily payment settlements **without needing SQL knowledge or database access**.

---

## 📍 How to Access

1. Log in as **Super Admin**
2. Go to **Admin Dashboard** (`/admin`)
3. Click on **"Payment Settlements"** quick link (💰 icon)
4. Or navigate directly to: `/admin/settlements`

---

## 🖥️ Dashboard Features

### 1. **Date Selection**
- Pick any date to view settlements
- Defaults to today's date
- Can view historical settlements

### 2. **Summary Cards** (Top of page)
- **Total Transactions**: Number of payments for the day
- **Total Amount**: Total money received
- **To Transfer (98%)**: Amount to send to associations
- **Platform Fee (2%)**: Your platform revenue

### 3. **Association List**
Each association shows:
- Association name and subdomain
- Number of transactions
- Total amount received
- Amount to transfer (98%)
- Platform fee (2%)
- **"View Details"** button to expand

### 4. **Expanded Details** (Click "View Details")
Shows individual payments with:
- Payment reference
- Member name and email
- Transaction category
- Amount
- Completion time

### 5. **Export to CSV**
- Click **"Export CSV"** button
- Downloads a spreadsheet with all settlements
- Use for your accounting records
- Filename: `settlements-YYYY-MM-DD.csv`

---

## 💼 How to Process Settlements

### Step-by-Step:

1. **Open Dashboard**
   - Go to `/admin/settlements`
   - Select the date (default: today)

2. **Review Settlements**
   - Check each association's total
   - Verify the "To Transfer" amounts
   - Expand details if needed

3. **Transfer Funds**
   For each association:
   - Transfer the **"To Transfer (98%)"** amount
   - Use bank transfer or Paystack dashboard
   - Reference format: `SETTLE-2026-01-04-[AssocID]`

4. **Keep Platform Fee**
   - The **"Platform Fee (2%)"** stays in your account
   - Covers Paystack fees + profit

5. **Export Records**
   - Click "Export CSV"
   - Save for accounting
   - Attach to settlement emails (optional)

---

## 📊 Example

**Date:** January 4, 2026

| Association | Transactions | Total Amount | Transfer (98%) | Platform Fee (2%) |
|-------------|--------------|--------------|----------------|-------------------|
| Demo Assoc  | 5            | ₦50,000.00   | ₦49,000.00     | ₦1,000.00         |
| Test Coop   | 3            | ₦25,000.00   | ₦24,500.00     | ₦500.00           |
| **TOTALS**  | **8**        | **₦75,000.00** | **₦73,500.00** | **₦1,500.00**     |

**Actions:**
1. Transfer ₦49,000 to Demo Association
2. Transfer ₦24,500 to Test Cooperative
3. Keep ₦1,500 as platform fee

---

## 🔍 Additional Features

### View Pending Settlements
- Shows unsettled payments from last 7 days
- Helps track what needs to be processed
- *(Coming soon in dashboard)*

### Monthly Summary
- View entire month's settlements
- Track monthly revenue
- *(Coming soon in dashboard)*

---

## ❓ FAQs

### Q: Do I need database access?
**A:** No! Everything is in the web dashboard.

### Q: Can I view past settlements?
**A:** Yes, use the date picker to select any date.

### Q: What if there are no payments for a date?
**A:** The dashboard will show "No payments for [date]".

### Q: Can I export for multiple dates?
**A:** Currently one date at a time. Select date, export, repeat.

### Q: How do I know which bank account to transfer to?
**A:** Association bank details are stored in the database. *(Bank details UI coming soon)*

### Q: What if I forget to settle a day?
**A:** No problem! Just select that date and process it. Payments don't expire.

---

## 🚀 Future Enhancements

When **Paystack Subaccounts** are implemented:
- ✅ Automatic settlements (no manual transfers)
- ✅ Real-time fund distribution
- ✅ This dashboard becomes a monitoring tool only
- ✅ No more daily manual work!

---

## 📞 Support

For issues or questions:
- Check the dashboard instructions (blue box at bottom)
- Review `PAYMENT_SETTLEMENT_GUIDE.md` for technical details
- Contact development team

---

**Last Updated:** January 4, 2026
**Dashboard URL:** `/admin/settlements`
**Access Level:** Super Admin Only
