"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createTenantStorage } from "@/lib/tenantStorage";
import SiteView from "@/src/site/SiteView";
import StockImportModal from "@/src/stock/StockImport";
import CustomersImportModal, { exportCustomersFile } from "@/src/customers/CustomersImport";
import { buildPlan as buildCustomersPlan, applyPlan as applyCustomersPlan } from "@/src/customers/importLogic";
import { buildTicket as buildKitchenTicket, ticketBodyHtml as kitchenTicketBodyHtml, addToQueue as addToKitchenQueue, parseQueue as parseKitchenQueue, ticketsToPrint as kitchenTicketsToPrint, KITCHEN_MODES } from "@/src/kitchen/kitchenTicket";
import { buildPlan as buildStockImportPlan } from "@/src/stock/importLogic";
import { orderCategoriesByMain, mainTabsFor, addSubToMain, removeSubFromMain, removeSubEverywhere, moveMain, cleanMains } from "@/src/menu/mainCategories";
import { parseQty as parseRecipeQty, fmtRecipeQty, isCountUnit, QUICK_FRACTIONS } from "@/src/recipe/qty";
// Opened only by the secret gesture on the login screen, so it is fetched only then.
const SupportLogin = React.lazy(() => import("@/src/support/SupportLogin"));
import WebsiteSettingsPanel from "@/src/site/WebsiteSettings";
import { mergeSiteSettings, ITEM_BADGES } from "@/src/site/presets";
import { makeSiteT } from "@/src/site/siteStrings";
import {
  PAYMENT_METHODS,
  receiptMethodAmounts,
  returnTimeOf,
  returnAmountsOf,
  notHeldByRider,
  cashTimeOf,
  cashFlows,
  summarize,
  round2,
  createLedger,
  addDaysStr,
  monthKeysInRange,
  prevMonthKey,
  nextMonthKey,
  lastDayOfMonth,
  storageMonthOf,
  WEEKDAY_KEYS,
  DEFAULT_SHIFT_HOURS,
  localDateStr,
  businessDateForTimestamp,
} from "@/src/ledger";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');

/* Staff-terminal light/dark theme tokens. Dark is the default (":root", unscoped) and matches
   the app's original fixed dark palette exactly, so nothing changes visually until a manager
   switches to light mode in Settings. Only the staff terminal's own root wrapper ever sets
   data-theme — the customer-facing menu/checkout pages never do, so they keep resolving to
   these ":root" dark defaults permanently, unaffected by a staff device's theme choice. Modal-
   style surfaces (confirm dialogs, the checkout/QR modals) intentionally stay their own fixed
   light "paper" look in both themes, so they aren't tokenized here. */
:root {
  --bg: #20242B;
  --surface: #2B303A;
  --text-primary: #FBF8F2;
  --text-muted: #9CA1AC;
  --text-faint: #8A8F99;
  --border: #3A404C;
  --track: #2E3440;
  --success-text: #9FCB8E;
  --warning-text: #E3C98A;
  --danger-text: #E3A79C;
  --info-text: #8EB8D6;
}
[data-theme="light"] {
  --bg: #F5F2EA;
  --surface: #FFFFFF;
  --text-primary: #262421;
  --text-muted: #6B6F78;
  --text-faint: #7A7E88;
  --border: #DCD5C4;
  --track: #E8E3D6;
  --success-text: #3F8F4F;
  --warning-text: #9C7A2E;
  --danger-text: #B85C4E;
  --info-text: #2E75A6;
}
`;

const COLORS = {
  ink: "#20242B",
  inkSoft: "#2B303A",
  paper: "#FBF8F2",
  burgundy: "#7C2D3B",
  brass: "#B08D57",
  brassLight: "#D8C39A",
  sage: "#5C7A5C",
  amber: "#B08A3E",
  red: "#A6534A",
  charcoal: "#262421",
  charcoalSoft: "#6B685F",
  line: "#DCD5C4",
};

// Every user-facing UI string lives here, in English and Arabic. Menu item/category names and
// ingredient/stock names are intentionally NOT part of this dictionary — those are the
// restaurant's own data (entered via the Menu/Stock editors) and stay exactly as typed,
// regardless of the selected UI language.
const STRINGS = {
  en: {
    appSubtitle: "Order terminal",
    tableLabel: "Table",
    serverLabel: "Server",
    tab_order: "Order",
    tab_menu: "Menu",
    tab_stock: "Stock",
    tab_receipts: "Receipts",
    tab_customers: "Customers",
    tab_shift: "Shift",

    payment_cash: "Cash",
    payment_visa: "Visa",
    payment_instapay: "InstaPay",
    payment_wallet: "Wallet",
    payment_split: "Split payment",
    splitPaymentOption: "Split payment",
    splitRemainingLabel: "Remaining",
    notice_splitPaymentMismatch: "Split amounts must add up to the total ({{amount}}) across at least 2 methods",

    status_placed: "Order placed",
    status_preparing: "Preparing",
    status_out_for_delivery: "Out for delivery",
    status_delivered: "Delivered",

    ticketNumber: "Ticket #{{n}}",
    newTicketLabel: "New ticket",
    saved: "Saved",
    open: "Open",
    tapMenuItemHint: "Tap a menu item to add it to the ticket.",
    noItemsInCategory: "No items in this category yet — add some from the Menu tab.",
    addDiscount: "+ Add discount",
    apply: "Apply",
    cancel: "Cancel",
    confirmAction: "Confirm",
    discountLabel: "Discount: {{value}}",
    splitBill: "+ Split bill",
    addToExistingInvoice: "+ Add to existing invoice",
    addToExistingInvoiceTitle: "Add to an unpaid invoice",
    addToExistingInvoiceSubtitle: "Pick an unpaid invoice from this month to add these items to, instead of saving a new one.",
    notice_addedToInvoice: "Added to ticket #{{n}}",
    numberOfPeoplePlaceholder: "Number of people",
    splitLabel: "Split {{n}} ways",
    eachPays: "{{amount}} each",
    notice_enterSplitValue: "Enter how many people are splitting the bill (2 or more)",
    edit: "Edit",
    remove: "Remove",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    itemCount: "{{n}} item",
    itemCount_plural: "{{n}} items",
    customerOptional: "Customer (optional)",
    phoneSearchPlaceholder: "Phone number — type to find a returning customer",
    noMatchesNewCustomer: "No matches — this will be a new customer.",
    unnamed: "Unnamed",
    namePlaceholder: "Name",
    phonePlaceholder: "Phone number",
    addressPlaceholder: "Address (for delivery)",
    etaPlaceholder: "ETA (e.g. 30-40 min, sent with the \"Preparing\" message)",
    printReceipt: "Print receipt",
    printReceiptTooltip: "Prints directly — works once this app is deployed, not in this preview",
    download: "Download",
    downloadReceiptTooltip: "Downloads a receipt file you can open and print — works in this preview",
    saveOrder: "Save order",
    saveOrderUnpaid: "Save order (unpaid)",
    paidNowOption: "Paid now",
    payLaterOption: "Pay later",
    payLaterHint: "For an open tab — payment hasn't been collected yet",
    paidVia: "Paid via {{method}}",
    unpaidBadge: "Unpaid",
    unpaidOrderTooltip: "Saved but payment hasn't been collected yet",
    markOrderPaid: "Mark as paid",
    confirm_markOrderPaid: "Mark order #{{n}} as paid?",
    notice_orderMarkedPaid: "Order #{{n}} marked as paid",
    unpaidSummary: "{{n}} unpaid · {{amount}}",
    unpaidThisShiftLabel: "Unpaid orders from this shift",
    noUnpaidThisShift: "Everything rung up this shift has been paid.",
    thankYou: "Thank you!",

    stockNotTracked: "Stock not tracked",
    outOfStock: "Out of stock",
    lowLeft: "Low · {{n}} left",
    available: "{{n}} available",
    notEnoughForAnother: "Not enough {{ingredient}} for another {{item}}",
    notEnoughToIncrease: "Not enough {{ingredient}} to increase this item",
    genericStock: "stock",

    menuEditorTitle: "Menu editor",
    menuEditorSubtitle: "Add categories and dishes, and set the recipe (which stock items go into each dish) so ordering deducts stock automatically.",
    scanMenuButton: "Scan a menu photo",
    scanMenuHint: "Upload a photo of a printed menu and we'll read the items for you to review before adding.",
    scanMenuModalTitle: "Scan menu photo",
    scanMenuScanning: "Reading your menu…",
    scanMenuReviewTitle: "{{n}} items found — review before adding",
    scanMenuReviewHint: "Uncheck anything that looks wrong, or fix the name/price directly.",
    scanMenuAddButton: "Add {{n}} items to menu",
    scanMenuTryAgain: "Try another photo",
    notice_menuScanTooLarge: "That photo is too large — try one under 30MB",
    notice_menuScanFailed: "Couldn't read that menu — try a clearer or better-lit photo",
    notice_menuScanAdded: "{{n}} items added to your menu",
    newCategoryPlaceholder: "New category name (e.g. Sides)",
    addCategory: "Add category",
    addItem: "+ Add item",
    deleteCategory: "Delete category",
    noRecipeSet: "No recipe set — stock not tracked",
    delete: "Delete",
    noItemsYet: "No items yet.",
    addItemToCategory: "Add item to {{category}}",
    editItemTitle: "Edit {{name}}",
    uploadPhoto: "Upload photo",
    changePhoto: "Change photo",
    removePhoto: "Remove photo",
    photoUploadedHint: "This photo shows everywhere this item appears.",
    suggestedPhotoHint: "No photo yet — showing the dish's initials until you upload one.",
    profileAddCategoryPlaceholder: "New category for this price list only",
    profileAddCategory: "Add category",
    profileOwnCategoryBadge: "this list only",
    profileDeleteCategory: "Delete category",
    confirm_deleteProfileCategory: "Delete the category \"{{name}}\" from this price list, together with all of its items? The main menu is not affected.",
    profileRemoveItem: "Remove from this list",
    profileRestoreItem: "Restore",
    profileItemRemovedBadge: "removed from this list",
    confirm_removeFromProfile: "Remove \"{{name}}\" from this price list? It stays in the main menu and you can restore it here at any time.",
    notice_profileCategoryAdded: "Category \"{{name}}\" added to this price list",
    notice_profileCategoryExists: "That category already exists in this price list",
    mainCategoriesTitle: "Main categories",
    mainCategoriesSubtitle: "Group your categories under main categories — for example Beef or Chicken. On the Order screen the main categories are the first row of tabs and the categories inside them the second row. A category can sit in more than one main category; categories in none show under \"Other\". With no main category, the Order screen stays exactly as it is.",
    newMainPlaceholder: "New main category (e.g. Beef)",
    addMainCategory: "Add main category",
    mainCategoryOther: "Other",
    mainAddCategory: "Add a category…",
    categoryAddToMain: "Add to a main category…",
    categoryUnderLabel: "Under:",
    confirm_deleteMainCategory: "Delete the main category \"{{name}}\"? Its categories and dishes stay — they just aren't grouped under it any more.",
    notice_mainCategoryExists: "A main category with that name already exists",
    customersImportBtn: "Import from Excel",
    customersExportBtn: "Export to Excel",
    notice_customersExported: "{{n}} customers exported",
    notice_customersExportFailed: "Couldn't create the Excel file — try again",
    moveCategoryUp: "Move this category earlier in the tabs",
    moveCategoryDown: "Move this category later in the tabs",
    recipeQtyHint: "Fractions are fine: 0.5, 1/2, ½ or 1 1/2.",
    priceListsTitle: "Price lists",
    priceListsSubtitle: "Mirror the menu with different pricing for delivery apps, events, or a separate brand — same items and recipes, your prices.",
    newProfileNamePlaceholder: "Price list name (e.g. Talabat)",
    createProfile: "Create price list",
    profileStartFromLabel: "Start from",
    profileStartEmpty: "Empty — follows the main menu's prices",
    profileStartMain: "A copy of the main menu (its prices as they are now)",
    profileStartCopyOf: "A copy of “{{name}}”",
    notice_profileCreatedCopy: "Price list \"{{name}}\" created as a copy of {{source}}.",
    profileCopyMainName: "the main menu",
    noProfilesYet: "No price lists yet — create one to offer different pricing without duplicating your menu.",
    managePrices: "Manage prices",
    closeManage: "Close",
    addExtraItem: "Add extra item",
    baseLabel: "Base",
    extraLabel: "Extra",
    notice_giveProfileName: "Give this price list a name first.",
    notice_profileCreated: "Price list \"{{name}}\" created.",
    confirm_deleteMenuProfile: "Delete the price list \"{{name}}\"? This won't affect your main menu.",
    dishNamePlaceholder: "Dish name",
    shortDescriptionPlaceholder: "Short description",
    pricePlaceholder: "Price",
    recipeLabel: "Recipe — stock used per serving",
    noIngredientsAdded: "No ingredients added yet.",
    copyRecipeFrom: "Copy the recipe of another item…",
    notice_recipeCopied: "Copied the ingredients of \"{{name}}\" — change or add anything on top",
    notice_recipeCopyNothingNew: "\"{{name}}\" has no ingredients that aren't already here",
    selectIngredient: "Select ingredient…",
    searchIngredient: "Search ingredient…",
    noIngredientMatches: "No ingredient matches that search.",
    tab_closeday: "Close the day",
    tab_website: "Website",
    closeDayTitle: "Close the day",
    closeDayHint: "Everything about one business day in one place: how it went, the cash drawer shift by shift, and why any gap happened. Open to everyone.",
    closeDaySalesTitle: "How the day went",
    closeDayDrawerTitle: "Cash drawer, shift by shift",
    cdRevenue: "Revenue",
    cdOrders: "Orders",
    cdExpenses: "Expenses",
    cdNet: "Net after expenses",
    cdDiscounts: "{{n}} discounted orders ({{amount}})",
    cdVoided: "{{n}} cancelled / refunded ({{amount}})",
    cdNoShifts: "No shifts were started on this business day.",
    cdOpened: "Opened with",
    cdReceived: "Cash received",
    cdPaidOut: "Cash paid out",
    cdPaidOutHint: "Cash handed back to customers + cash expenses + riders' pay kept or paid when delivery is settled",
    riderPayLabel: "Rider pay at delivery settlement",
    cdShouldBe: "Should be",
    cdCollectedTitle: "Cash collected at the end of the day",
    cdCollectedHint: "If the day's cash is taken out of the drawer around the last count, type the amount you took. The drawer is then checked as: should be − collected = counted. Leave it empty if nothing was taken.",
    cdCollectedPlaceholder: "Amount collected",
    cdCollectedSave: "Save",
    cdCollectedClear: "Remove",
    cdCollectedRecorded: "Recorded: {{amount}} by {{name}} at {{time}}",
    cdCollectedCheck: "{{name}}: should hold {{expected}} − collected {{collected}} = {{left}}; counted {{counted}}.",
    cdCollectedImplied: "{{name}} counted {{amount}} less than expected — about what an end-of-day collection leaves. Type the amount you actually took to check it.",
    cdCollectedSub: "− collected {{amount}}",
    cdImpliedShort: "≈ collection {{amount}}",
    cdCollectedRow: "Collected at end of day",
    cdCounted: "Counted",
    cdGap: "Gap",
    cdNotCounted: "not counted",
    cdStillOpen: "still open",
    cdWholeDay: "Whole day",
    cdHandover: "Opened with {{opening}}, but {{name}} counted {{previous}} at closing — {{diff}} of cash is unaccounted for between the two shifts.",
    cdDayGapExplain: "The whole-day gap is the sum of the shift gaps ({{shiftGaps}}) and the unexplained differences between shifts ({{residuals}}).",
    cdGapsTitle: "Why there is a gap",
    cdNoGaps: "Every counted drawer matches what the system expected, and every handover matches.",
    cdNothingCounted: "No drawer was counted on this day (the shifts started before cash counts were required), so there is nothing to compare — only the cash received and paid out can be totalled.",
    cdGapShort: "{{name}}'s drawer is {{amount}} short of what the system expected.",
    cdGapOver: "{{name}}'s drawer has {{amount}} more than the system expected.",
    cdLikely: "Most likely:",
    cdCheck: "Worth checking:",
    cdEditCashToOther: "Order #{{n}} ({{amount}}) was paid at {{paidAt}}, then changed from {{from}} to {{to}} by {{by}} at {{at}}. If the customer really paid cash, that cash is in the drawer but the system counted it as {{to}}.",
    cdEditOtherToCash: "Order #{{n}} ({{amount}}) was paid at {{paidAt}}, then changed from {{from}} to {{to}} by {{by}} at {{at}}. If the customer really paid by {{from}}, the system now expects cash that was never in the drawer.",
    cdReduced: "Items were removed from {{list}} after they were rung up. If customers paid the original amount, the extra cash shows up as over.",
    cdNoCause: "Nothing recorded explains it. Recount the drawer, and ask whether cash was taken out or given as change without being recorded.",
    cdHandoverGapTitle: "{{diff}} of cash changed between {{from}}'s closing count and {{to}}'s opening count.",
    cdHandoverMissing: "Cash left the drawer after it was counted at closing and before the next shift counted it — nobody's shift accounts for it.",
    cdHandoverExtra: "The drawer held more when the next shift counted than when the last shift closed it — one of the two counts is probably wrong.",
    cdAlsoCheck: "Also check",
    cdAllGood: "Nothing else to check.",
    cdOutsideShift: "{{n}} orders ({{amount}}) were taken while {{names}} had no shift in the log — a clock-in or clock-out was missed.",
    cdUnpaid: "{{n}} orders ({{amount}}) are still unpaid.",
    cdOpenShift: "{{name}}'s shift is still open — its drawer hasn't been counted yet.",
    cdAutoClosed: "{{name}}'s shift was never clocked out and was closed automatically.",
    cdNoCount: "{{name}}'s shift has no cash count (it started before counts were required).",
    cdAfterClose: "(This happened after the shift was closed, so the gap appeared later.)",
    cdAtClosing: "When the shift closed, the system expected {{expected}} and the gap was {{gap}}. Changes made since then moved the expected amount to {{now}}.",
    cdFound: "Recorded events in this shift that could be involved:",
    cdItemQtyDown: "Order #{{n}} had {{list}} removed by {{by}} at {{at}}, after it was paid — {{about}}{{amount}} less on the bill. If the customer paid the original price, the extra cash is in the drawer.",
    cdItemQtyUp: "Order #{{n}} had {{list}} added by {{by}} at {{at}}, after it was paid — {{about}}{{amount}} more on the bill. If the customer didn't pay the difference, the drawer is short by that much.",
    cdAbout: "about ",
    cdItemLegacyVoid: "Order #{{n}} ({{amount}} cash) was {{status}}, but nothing records how the money went back. If it wasn't handed back in cash, it is still in the drawer.",
    cdItemLooseExpense: "A cash expense ({{what}}, {{amount}}) is dated this day but isn't inside any shift, so it reduced no drawer. If it was paid from this drawer, that explains a shortage.",
    cdExplainedExact: "Together these explain the whole gap ({{sum}}).",
    cdExplainedPartial: "These explain {{explained}} of the {{gap}} gap. {{rest}} is still unexplained — recount the drawer and ask whether cash was taken out or given as change without being recorded.",
    cdOutsideRow: "Outside any shift",
    cdHandoverFlowTitle: "Between {{from}}'s closing and {{to}}'s opening:",
    cdHandoverFlow: "{{from}} counted {{previous}} at closing. Until the next shift opened, the system recorded {{received}} cash received ({{who}}) and {{paidOut}} paid out, so the drawer should have held {{expected}}. {{to}} opened with {{opening}} — {{result}}",
    cdHandoverFlowMatch: "that matches.",
    cdHandoverFlowMissing: "{{diff}} less than expected: cash left the drawer without being recorded.",
    cdHandoverFlowExtra: "{{diff}} more than expected: cash entered the drawer without being recorded, or one of the counts is off.",
    cdHandoverNoShift: "That cash was received while nobody had a shift in the log — a clock-in or clock-out for that period was missed.",
    cdClosedBy: "Closed by {{name}} on {{time}}",
    cdClosedNote: "Note: {{note}}",
    cdChangedSince: "Changed since it was closed:",
    cdChangeLine: "{{what}}: {{before}} when closed, {{after}} now",
    closeDayBtn: "Close the day",
    cdCloseAgain: "Close the day again",
    cdCloseBlockedOpen: "Close every open shift first.",
    cdCloseModalTitle: "Close {{date}}",
    cdCloseModalHint: "This saves the day's figures as its official record. If anything changes afterwards, this screen will show what changed since closing.",
    cdCloseNoteRequired: "There is a cash gap. Write what you found or decided about it.",
    cdCloseNotePlaceholderGap: "What did you find out about the gap?",
    cdCloseNoteOptional: "Notes (optional)",
    cdCloseConfirm: "Save and close the day",
    cdPrint: "Print",
    cdDownload: "Download",
    cdReportTitle: "Close the day report",
    notice_dayClosed: "The day is closed — its figures are saved",
    openingCountTitle: "Count the cash in the drawer",
    openingCountSubtitle: "Before you start the shift, count every note and coin in the drawer and type the total. You can't start the shift without it.",
    openingCountPlaceholder: "Total cash counted",
    openingCountStart: "Start shift",
    openingCountPrevious: "The last shift ({{name}}) counted {{amount}} at closing.",
    closingCountTitle: "Count the cash in the drawer",
    closingCountSubtitle: "Before you clock out, count every note and coin in the drawer and type the total. You can't clock out without it.",
    closingCountConfirm: "Confirm count and clock out",
    recapCashTitle: "Cash drawer",
    handoverMismatch: "Opened with {{opening}}, but the last shift counted {{previous}} at closing",
    shiftCashLine: "Opened {{opening}} · counted {{counted}} · expected {{expected}}",
    returnMethodTitle: "Return the money to the customer by",
    returnMethodSplit: "As paid (split)",
    returnNothingToReturn: "This order is unpaid, so there is no money to return.",
    returnedViaLabel: "Money returned: {{methods}}",
    discountReasonPlaceholder: "Why is this discount given? (required)",
    notice_discountReasonRequired: "Write the reason for the discount first",
    discountReasonLabel: "Reason: {{reason}}",
    shiftAutoClosedBadge: "auto-closed",
    shiftAutoClosedHint: "This shift was never clocked out — it was closed automatically when the same person signed in again (or after 24 hours).",
    dayCheckTitle: "Day check — does it add up?",
    dayCheckHint: "Every completed order of the chosen business day, grouped by the shift it was rung up in. The total is the same figure as the Dashboard for that day.",
    dayCheckNoShift: "Not in any logged shift",
    dayCheckNoShiftHint: "Orders taken while that person had no shift in the log — usually a clock-out or clock-in that was missed.",
    dayCheckOrders: "Orders",
    dayCheckCash: "Cash",
    dayCheckOther: "Other methods",
    dayCheckTotal: "Total",
    dayCheckMatches: "Same as Dashboard revenue for this day",
    dayCheckEmpty: "No completed orders on this business day.",
    markOutOfStock: "Mark out of stock",
    markAvailable: "Mark available",
    manuallyOutBadge: "Marked out of stock",
    notice_itemMarkedOut: "\"{{name}}\" is now out of stock everywhere",
    notice_itemMarkedAvailable: "\"{{name}}\" is available again",
    notice_outOfStockSaveFailed: "Couldn't update the item — check the connection and try again",
    reasonMarkedOut: "{{item}} is marked out of stock",
    callCenterLinkTitle: "Call center ordering link",
    callCenterLinkSubtitle: "For your call center team. Same menu and ordering as the online link, plus searching your customer database by phone or name. Agents sign in with their staff name and PIN.",
    callCenterLinkNote: "Keep this link private — it opens your customer list. Share it only with call center staff.",
    soundSettingTitle: "New order sound",
    kitchenTicketTitle: "KITCHEN ORDER",
    kitchenAddedLabel: "ADDED TO THE ORDER",
    kitchenItemsTotal: "Total items: {{n}}",
    kitchenServedBy: "By {{name}}",
    kitchenEta: "Ready: {{text}}",
    kitchenTicketButton: "Kitchen ticket",
    kitchenTicketTooltip: "Prints the order for the kitchen — dishes, quantities and notes, no prices",
    kitchenSettingTitle: "Kitchen printing",
    autoPrintTitle: "Print automatically after saving an order",
    autoPrintNone: "Nothing",
    autoPrintReceipt: "Customer receipt",
    autoPrintKitchen: "Kitchen ticket (no prices)",
    autoPrintBoth: "Both",
    autoPrintHint: "Applies to this device only. The customer receipt has the prices; the kitchen ticket has dishes, quantities and notes only. Phones and tablets show their print window each time.",
    kitchenWhereTitle: "Where the kitchen ticket prints",
    kitchenModeOff: "Off",
    kitchenModeHere: "Print on this device",
    kitchenModeSend: "Send to the kitchen printer",
    kitchenModeStation: "This device is the kitchen printer",
    kitchenHint_off: "Orders are not printed for the kitchen automatically. You can still print a kitchen ticket by hand from the order screen or the Receipts tab.",
    kitchenHint_here: "When an order is saved on this device, a kitchen ticket (dishes, quantities and notes — no prices) prints here.",
    kitchenHint_send: "When an order is saved on this device, its kitchen ticket is sent to the device that is set as the kitchen printer, which prints it. Use this on phones, tablets and tills that have no printer.",
    kitchenHint_station: "Connect the kitchen printer to this device and keep the app open. Every kitchen ticket saved on any device prints here within about 10 seconds.",
    kitchenSilentTip: "To print without a print window every time, open Chrome or Edge on this computer with the option --kiosk-printing and make the kitchen printer the default printer. Phones and tablets always show their own print window.",
    kitchenTestPrint: "Print a test ticket",
    kitchenTestLabel: "TEST TICKET",
    kitchenTestDish: "Test dish",
    kitchenStationWaiting: "Waiting for orders. Keep this screen open and awake.",
    kitchenRecentTitle: "Recent kitchen tickets",
    kitchenPrintAgain: "Print again",
    notice_kitchenSendFailed: "Couldn't reach the kitchen printer — the ticket was printed here instead.",
    soundSettingHint: "Play a sound on this device whenever a customer or the call center sends a new order (QR menu, online link, or call center). Applies to this device only.",
    soundOn: "Sound on",
    soundOff: "Sound off",
    soundTest: "Play test sound",
    pendingOrderCallCenter: "Call center order — taken by {{agent}}",
    callCenterHeading: "Call center",
    callCenterSignInTitle: "Call center sign-in",
    callCenterPickName: "Choose your name",
    callCenterEnterPin: "Enter your 4-digit PIN",
    callCenterWrongPin: "Wrong PIN — try again",
    callCenterNoStaff: "No staff members found yet. Add staff in the POS terminal first.",
    callCenterSignedInAs: "Taking orders as {{name}}",
    callCenterSignOut: "Sign out",
    callCenterCustomerTitle: "Customer",
    callCenterReturning: "Returning customer — details filled in ({{n}} previous orders)",
    callCenterPhoneRequired: "Add the caller's phone number",
    callCenterBack: "Back",
    inRecipeMark: "already in recipe",
    qtyPlaceholder: "Qty",
    add: "Add",
    saveItem: "Save item",

    stockTitle: "Stock (ingredients)",
    stockSubtitle: "These are the raw items dishes are made from. Orders deduct automatically based on each dish's recipe.",
    newIngredientPlaceholder: "New ingredient name",
    otherUnit: "Other (type unit)…",
    customUnitPlaceholder: "e.g. tray, jar",
    startingStockPlaceholder: "Starting stock",
    unitHint: "Pick the unit you'll actually count in day to day — grams for things you weigh precisely, pieces/bottles for things you count. This unit is fixed for this ingredient everywhere it's used.",
    low: "Low",
    inStock: "In stock",
    restockAmountPlaceholder: "10",
    restockAmountTooltip: "Type any amount and tap Restock to add it all at once — handy after a delivery instead of tapping + repeatedly.",
    restockBulk: "Restock",
    stockDecreaseTooltip: "Only for correcting counts or returning defective/damaged supply — staff can only add stock, not remove it.",
    unitGroup_Weight: "Weight",
    unitGroup_Volume: "Volume",
    unitGroup_Count: "Count",

    receiptsTitle: "Receipts",
    receiptsSubtitle: "Every month is stored separately and kept indefinitely. Cancelling restores stock; refunding does not; editing adjusts it.",
    loadingHistory: "Loading history…",
    orderCount: "{{n}} order",
    orderCount_plural: "{{n}} orders",
    expensesThisShiftCount: "1 expense logged",
    expensesThisShiftCount_plural: "{{n}} expenses logged",
    netAfterExpensesLabel: "Net after expenses",
    loadingMonth: "Loading {{month}}…",
    noSavedOrdersForMonth: "No saved orders for {{month}}.",
    noSavedOrdersForPeriod: "No saved orders for this period.",
    ticketHash: "Ticket #{{n}}",
    cancelledBadge: "Cancelled · stock restored",
    refundedBadge: "Refunded · stock kept",
    statusColon: "Status:",
    whatsappSent: "sent",
    whatsappChatOpened: "chat opened",
    whatsappLogLine: "✓ WhatsApp {{sentOrOpened}} for \"{{status}}\" at {{time}}",
    saveChanges: "Save changes",
    cancelEdit: "Cancel edit",
    paymentMethodEditLabel: "Payment method",
    paymentMethodEditSplitNote: "Picking a method here replaces the split-payment breakdown with a single method.",
    editReasonLabel: "Reason for edit (optional)",
    discountEditLabel: "Discount",
    editDiscountTitle: "Discount",
    editDiscountValuePlaceholder: "No discount",
    editDiscountRemove: "Remove discount",
    editDiscountHint: "Leave the value empty for no discount. A reason is required when a discount is added or changed.",
    editNewTotal: "Total after this edit: {{new}} (was {{old}})",
    editHistoryDiscountRemoved: "removed",
    cdDiscountDown: "Order #{{n}} got a discount ({{list}}) from {{by}} at {{at}}, after it was paid — {{about}}{{amount}} less on the bill. If the customer paid the original price, the extra cash is in the drawer.",
    cdDiscountUp: "Order #{{n}} had its discount reduced or removed ({{list}}) by {{by}} at {{at}}, after it was paid — {{about}}{{amount}} more on the bill. If the customer didn't pay the difference, the drawer is short by that much.",
    editReasonPlaceholder: "e.g. customer changed their mind",
    viewEditHistory: "View edit history ({{n}})",
    hideEditHistory: "Hide edit history",
    editHistoryEntry: "{{name}} · {{time}}",
    editHistoryChange: "{{item}}: {{from}} → {{to}}",
    editHistoryNoReason: "No reason given",
    editHistoryUnknownEditor: "Staff member",
    printReceipt: "Print",
    cancelOrder: "Cancel order",
    cancelOrderTooltip: "Order never went out — restores stock",
    refundOrder: "Refund order",
    refundOrderTooltip: "Already served — stock stays consumed",
    whatsappStatusTooltip: "Also opens a pre-filled WhatsApp message to the customer",

    customersTitle: "Customers",
    customersSubtitle: "Anyone whose phone number was entered at checkout is saved here automatically.",
    loading: "Loading…",
    noCustomersSaved: "No customers saved yet.",
    unnamedCustomer: "Unnamed customer",
    lastOrderDate: "Last: {{date}}",

    currentShift: "Current shift",
    sinceDate: "Since {{date}}",
    ordersCompleted: "Orders completed",
    ordersCancelled: "Orders cancelled",
    ordersRefunded: "Orders refunded",
    grossSales: "Gross sales",
    refunds: "Refunds",
    net: "Net",
    shiftReportTitle: "Shift Report",
    tableAndServer: "Table 12 · Server Amira",
    netSales: "Net sales",
    byPaymentMethod: "By payment method",
    refundedCount: "Refunded · {{n}}",
    cancelledCountNote: "Cancelled · {{n}} (stock restored, not counted)",
    discountedCountNote: "Discounted orders · {{n}}",
    discountsGiven: "Discounts given",
    cashReconciliationTitle: "Cash reconciliation",
    cashReconciliationSubtitle: "Counts every cash order, cash refund, and cash expense logged this shift, so the expected drawer total is actually accurate.",
    openingFloatLabel: "Opening float",
    openingFloatHint: "Cash physically in the drawer when this shift started",
    cashSalesLabel: "Cash sales",
    unsettledDeliveryCashLabel: "Held by delivery riders (not yet settled)",
    unsettledDeliveryCashHint: "Already excluded from cash sales above — riders are still holding this cash until you settle up with them below.",
    cashRefundsLabel: "Cash returned to customers",
    cashExpensesLabel: "Cash expenses paid out",
    noCashExpensesThisShift: "No cash expenses logged this shift.",
    expectedCashLabel: "Expected cash in drawer",
    countedCashLabel: "Counted cash",
    countedCashPlaceholder: "Count the drawer and enter it here",
    varianceLabel: "Variance",
    varianceOver: "Over",
    varianceShort: "Short",
    varianceMatch: "Matches exactly",
    electronicReconciliationTitle: "Visa, InstaPay & wallet reconciliation",
    electronicReconciliationSubtitle: "No drawer to count here — just check what actually landed in your bank or wallet statement against what this shift expects, per method.",
    salesLabel: "Sales",
    refundsLabel: "Refunds",
    expectedSettlementLabel: "Expected",
    confirmedOnStatementLabel: "On statement",
    confirmedElectronicPlaceholder: "Enter the statement amount",
    printShiftReport: "Print shift report",
    downloadReportTooltip: "Downloads a report file you can open and print — works in this preview",
    startNewShift: "Start new shift",

    langToggleLabel: "Language",

    tab_settings: "Settings",
    settingsTitle: "Restaurant settings",
    settingsSubtitle: "Set your restaurant's name, logo, and brand colors — used across the app and on printed receipts.",
    restaurantNameLabel: "Restaurant name",
    restaurantNamePlaceholder: "Restaurant name",
    logoLabel: "Logo",
    uploadLogo: "Upload logo",
    changeLogo: "Change logo",
    removeLogoBtn: "Remove logo",
    noLogoUploaded: "No logo uploaded — a text name is used instead.",
    locationLabel: "Location",
    locationPlaceholder: "Paste a Google Maps link, or type your address",
    locationHint: "Adds a \"Get directions\" button to your online-ordering link, so customers can navigate straight to you. Open your restaurant in Google Maps, tap Share, and paste the link here — or just type your address.",
    getDirectionsButton: "Get directions",
    phoneNumberLabel: "Phone number",
    phoneNumberPlaceholder: "e.g. +20 10 1234 5678",
    phoneNumberHint: "Adds a \"Call us\" button to your online-ordering link, so customers can call you directly.",
    callButton: "Call us",
    primaryColorLabel: "Primary color",
    secondaryColorLabel: "Secondary color",
    primaryColorHint: "Used for buttons, the active tab, and key actions.",
    secondaryColorHint: "Used for accents, links, and highlighted badges.",
    themeLabel: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    themeHint: "Applies to this terminal's screens. Every device signed into this restaurant sees the same theme.",
    shiftHoursTitle: "Shift hours",
    shiftHoursHint: "When each day's shift starts and ends. An order placed after midnight but before the next shift's start still counts toward the day the shift began — so a 6pm–2am shift never gets split across two days on the Dashboard.",
    shiftHoursToLabel: "to",
    weekday_sun: "Sunday",
    weekday_mon: "Monday",
    weekday_tue: "Tuesday",
    weekday_wed: "Wednesday",
    weekday_thu: "Thursday",
    weekday_fri: "Friday",
    weekday_sat: "Saturday",
    previewLabel: "Preview",

    taxesTitle: "Taxes & service charge",
    taxesHint: "Applied automatically to every order — set either to 0 to leave it off.",
    vatPercentLabel: "VAT %",
    servicePercentLabel: "Service charge %",
    taxesOrderNote: "Service charge is calculated on the subtotal after any discount; VAT is calculated on top of that (subtotal − discount + service).",
    tabAccessTitle: "Tab access",
    tabAccessHint: "Lock any of these tabs so regular staff need a manager's PIN to open them. You (already clocked in as a manager) always have full access — the prompt only ever shows for non-manager staff.",
    gatedTabTooltip: "Requires a manager's PIN",
    enterManagerPinTitle: "Manager PIN required",
    enterManagerPinHint: "Ask a manager to enter their PIN to open {{tab}}.",
    managerPinIncorrect: "That's not a valid manager PIN.",
    serviceCharge: "Service charge",
    vat: "VAT",

    tab_tables: "Tables",
    tablesTitle: "Tables",
    tablesSubtitle: "Set up your dining tables, see which are occupied, and print a QR code linking to each table's menu.",
    numberOfTablesLabel: "Number of tables",
    takeawayLabel: "Takeaway",
    deliveryLabel: "Delivery",
    dineInLabel: "Dine In",
    tableNumbered: "Table {{n}}",
    renameTablePlaceholder: "Table name",
    tableAvailable: "Available",
    tableOccupied: "Occupied",
    openTicket: "Open ticket",
    clearTable: "Clear table",
    confirm_clearTable: "Clear this table's order? Any unsaved items will be lost.",
    markAsPaid: "Mark as paid",
    billRequestedBadge: "Bill requested · {{method}}",
    confirmPaymentTitle: "Confirm payment for {{table}}",
    confirmPaymentBody: "Total due:",
    confirmPaymentButton: "Confirm payment & close bill",
    notice_tableEmpty: "This table has no open items to charge",
    notice_paymentConfirmed: "Payment confirmed — {{table}} is now available",
    paymentMethodLabel: "Payment method",
    qrCode: "QR code",
    qrModalTitle: "Scan to view menu",
    qrLinkNote: "This link only works once the app is deployed publicly — it won't resolve from this chat preview.",
    printQr: "Print",
    close: "Close",
    orderingForLabel: "Ordering for",
    viewingMenuFor: "Menu for {{table}}",
    customerMenuHint: "Ask your server to place your order — this page is for browsing the menu only.",
    scanQrFlyerTitle: "Scan to view our menu",
    itemAvailable: "Available",
    itemNotAvailable: "Not available",
    liveMenuNote: "Menu and prices update live.",
    tableLabelOnReceipt: "Table: {{table}}",
    requestBillButton: "Request the bill",
    checkoutModalTitle: "Your bill",
    checkoutModalNote: "Reflects items your server has confirmed so far — anything you just sent may take a moment to show up here.",
    checkoutEmptyItems: "Nothing on your table's bill yet — ask your server, or place an order first.",
    checkoutPreviousOrders: "Previous order(s)",
    checkoutRequestButton: "Request bill",
    checkoutRequestedTitle: "Bill requested",
    checkoutRequestedBody: "Your server will bring your bill shortly.",
    checkoutRequestFailed: "Couldn't request the bill — check your connection and try again.",

    addToOrder: "Add",
    yourOrder: "Your order",
    orderTotal: "Total",
    sendOrderToKitchen: "Send order",
    emptyCartHint: "Add items from the menu to build your order.",
    orderSentTitle: "Order sent!",
    orderSentSubtitle: "Your server will review it shortly and bring it out. You can keep browsing and send another order any time.",
    orderSentOk: "Got it",
    orderConfirmedBanner: "Your order was confirmed and is being prepared!",
    notice_cartEmpty: "Add at least one item before sending your order",
    notice_orderSendFailed: "Couldn't send your order — check your connection and try again",
    pendingOrdersPill: "{{n}} new order",
    pendingOrdersPill_plural: "{{n}} new orders",
    billRequestedPill: "{{n}} bill requested",
    billRequestedPill_plural: "{{n}} bills requested",
    newOrderBadge: "New order",
    reviewOrder: "Review order",
    pendingOrderFrom: "New order from {{table}}",
    pendingOrderSubmitted: "Sent {{time}}",
    confirmOrder: "Confirm & add to ticket",
    rejectOrder: "Reject",
    confirm_rejectOrder: "Reject this order? The customer won't be notified automatically — let them know at the table.",
    notice_orderConfirmed: "Order added to {{table}}'s ticket",
    notice_orderRejected: "Order rejected",
    noPendingOrders: "No pending customer orders.",

    addNote: "+ Add a note",
    notePlaceholder: "e.g. no onions, extra spicy, allergy...",
    editNoteTitle: "Edit note",

    tab_expenses: "Expenses",
    expensesTitle: "Expenses",
    expensesSubtitle: "Track what you pay suppliers and other business costs — every month stored separately, kept indefinitely, visible across every terminal.",
    addExpense: "+ Add expense",
    editExpense: "Edit expense",
    deleteExpense: "Delete",
    expenseAmount: "Amount",
    expenseCategory: "Category",
    expenseDate: "Date",
    expenseSupplier: "Supplier",
    noSupplierOption: "No supplier / other",
    expenseNote: "Note",
    expenseNotePlaceholder: "e.g. invoice #, what it covers...",
    paymentStatus: "Payment status",
    statusPaid: "Paid",
    statusUnpaid: "Unpaid (owed)",
    dueDate: "Due date",
    markAsPaid: "Mark as paid",
    totalExpensesLabel: "Total this month",
    totalExpensesPeriodLabel: "Total for this period",
    byCategory: "By category",
    outstandingPayables: "Outstanding (unpaid)",
    noOutstanding: "Nothing outstanding — all paid up.",
    manageSuppliers: "Manage suppliers",
    addSupplier: "+ Add supplier",
    supplierName: "Supplier name",
    supplierCategoryLabel: "What they supply",
    supplierPhone: "Phone (optional)",
    removeSupplier: "Remove",
    noSuppliersYet: "No suppliers added yet.",
    noExpensesForMonth: "No expenses logged for {{month}}.",
    loadingExpenses: "Loading expenses…",
    recordedByLabel: "Logged by {{name}}",
    confirm_deleteExpense: "Delete this expense record? This can't be undone.",
    confirm_cancelOrder: "Cancel order #{{n}}? This restores its stock and can't be undone.",
    confirm_refundOrder: "Refund order #{{n}}? Stock stays consumed and this can't be undone.",
    confirm_removeSupplier: "Remove {{name}} from suppliers? Past expenses linked to them are kept.",
    confirm_removeIngredient: "Delete \"{{name}}\" from stock? This can't be undone.",
    notice_expenseSaved: "Expense saved",
    notice_expenseDeleted: "Expense deleted",
    notice_supplierAdded: "{{name}} added to suppliers",
    notice_enterExpenseAmount: "Enter a valid amount first",
    notice_enterSupplierName: "Enter a supplier name first",
    category_ingredients: "Ingredients / Stock",
    category_rent: "Rent",
    category_utilities: "Utilities",
    category_payroll: "Salaries / Payroll",
    category_equipment: "Equipment & Maintenance",
    category_marketing: "Marketing",
    category_packaging: "Packaging & Supplies",
    category_other: "Other",
    syncLabelExpenses: "an expense record",

    roleManager: "Manager",
    roleStaff: "Staff",
    makeManager: "Make manager",
    makeStaff: "Make staff",
    managerOnlyHint: "Only managers can see this",
    confirm_lastManager: "{{name}} is the only manager on the team — demoting them would leave no one able to view Expenses. Make someone else a manager first.",

    tab_delivery: "Delivery",
    deliveryZonesTitle: "Delivery zones",
    deliveryZonesSubtitle: "Set a delivery fee per distance/zone. Customers ordering online pick the zone closest to them at checkout.",
    deliveryAgentShareTitle: "How much of the delivery fee the restaurant keeps",
    deliveryAgentShareSubtitle: "The rest is the rider's pay. Take it as a percentage of each fee, or a flat amount per delivery regardless of the fee size.",
    retentionModePercentage: "Percentage",
    retentionModeFixed: "Fixed amount",
    perDeliveryLabel: "per delivery",
    addZone: "+ Add zone",
    zoneLabel: "Zone label",
    zoneLabelPlaceholder: "e.g. 0–3 km, or a neighborhood name",
    zoneFee: "Delivery fee",
    editZone: "Edit",
    removeZone: "Remove",
    noZonesYet: "No delivery zones set up yet — add one so online customers can choose delivery.",
    confirm_removeZone: "Remove this delivery zone?",
    notice_zoneAdded: "Delivery zone added",
    notice_enterZoneLabel: "Give the zone a label first",
    storeLinkTitle: "Online ordering link",
    storeLinkSubtitle: "Share this link on social media — customers can browse your live menu and order for pickup or delivery, without needing a table's QR code. Orders land the same way table orders do: as a pending order for staff to confirm.",
    copyLink: "Copy link",
    linkCopied: "Copied!",
    storeLinkNote: "Like the table QR codes, this link only resolves once the app is deployed publicly — it won't work from this chat preview.",
    fulfillmentMethod: "How would you like your order?",
    pickupOption: "Pickup",
    deliveryOption: "Delivery",
    chooseDeliveryZone: "Choose your area",
    selectZonePlaceholder: "Select the zone closest to you",
    deliveryFeeLineLabel: "Delivery fee",
    pickupBadge: "Pickup",
    deliveryBadge: "Delivery · {{zone}}",
    notice_chooseZoneFirst: "Choose your delivery area before sending your order",
    deliveryDetailsLabel: "Delivery details",
    notice_deliveryDetailsRequired: "Enter your name, phone number, and address before sending your order",
    notice_copyFailed: "Couldn't copy automatically — select the text and copy it manually",

    tab_dashboard: "Dashboard",
    dashboardTitle: "Dashboard",
    dashboardSubtitle: "A snapshot of how the business is doing — pick a day, a month, or a custom range below.",
    dashboardModeMonth: "Month",
    dashboardModeDay: "Day",
    dashboardModeRange: "Range",
    periodRevenueLabel: "Revenue",
    periodOrdersLabel: "Orders",
    todayRevenue: "Today's revenue",
    monthRevenue: "This month's revenue",
    monthOrders: "This month's orders",
    netProfitLabel: "Net profit",
    netProfitHint: "Revenue minus logged expenses",
    netProfitHintDetailed: "{{revenue}} revenue − {{expenses}} expenses",
    expensesLabel: "Expenses",
    avgOrderValueLabel: "Average order value",
    discountsGivenLabel: "Discounts given",
    vsYesterdayChange: "{{pct}}% vs yesterday",
    vsPreviousDayChange: "{{pct}}% vs previous day",
    revenueTrendTitle: "Revenue this month",
    revenueTrendTitleMonth: "Revenue by day",
    revenueTrendTitleDay: "Revenue by hour",
    revenueTrendTitleRange: "Revenue by day",
    bestDayLabel: "Best day so far: day {{day}} — {{amount}}",
    bestDateLabel: "Best day so far: {{date}} — {{amount}}",
    bestHourLabel: "Best hour: {{time}} — {{amount}}",
    topSellersTitle: "Items sold",
    dashAllCategories: "All categories",
    dashCategoryOther: "Not on the menu any more",
    dashCategoryFilter: "Menu category",
    noExpensesForPeriod: "No expenses in this period.",
    notice_imageDecodeFailed: "Couldn't open that picture. Save it as a normal JPG or PNG and try again (iPhone HEIC photos aren't supported).",
    noSalesYetDashboard: "No completed orders in this period.",
    paymentMixTitle: "Payment methods",
    orderSourceTitle: "Where orders came from",
    sourceDineIn: "Dine-in",
    sourceTakeaway: "Takeaway",
    sourceOnline: "Online (pickup/delivery)",
    unitsSold: "{{n}} sold",

    availableBadge: "Available",
    notAvailableBadge: "Not available",
    onlineOrderingHeading: "Order online",

    offlineBadge: "Offline",
    menuLoadFailedBadge: "Menu didn't load",
    menuLoadFailedHint: "Couldn't load the menu from the server, so it is empty for now. Don't take orders on this device until this clears; it retries automatically. Nothing has been overwritten.",
    configLoadFailedBadge: "Some settings didn't load",
    configLoadFailedHint: "Couldn't load one of this restaurant's settings (tables, price lists, tax rates, or delivery split) from the server. It's retrying automatically — nothing has been overwritten. Avoid changing that setting on this device until this clears.",
    syncPendingPill: "{{n}} change waiting to sync",
    syncPendingPill_plural: "{{n}} changes waiting to sync",
    retrySync: "Retry now",
    syncLabelOrders: "an order",
    syncLabelMenu: "a menu change",
    syncLabelStock: "a stock update",
    syncLabelTables: "a table change",
    syncLabelSettings: "a settings change",
    syncLabelCustomers: "a customer update",
    offlineOrderingDisabled: "You're offline right now, so orders can't be sent to the kitchen. Reconnect and try again.",
    offlineOrderingHint: "Waiting for a connection...",
    rosterLoadFailedHint: "Couldn't load the staff list — check your connection and try again. Your team's names and PINs are safe; this device just can't reach them right now.",

    helpChatTitle: "Help & troubleshooting",
    helpChatWelcome: "Hi! Ask me anything about using this app — how to do something, or if something isn't working right.",
    helpChatPlaceholder: "Ask a question...",
    helpChatSend: "Send",
    helpChatThinking: "Thinking...",
    helpChatError: "Couldn't reach the assistant — check your connection and try again.",
    helpChatOpen: "Help",
    helpChatClose: "Close",
    helpChatSuggestion1: "How do I split a bill?",
    helpChatSuggestion2: "How do table QR codes work?",
    helpChatSuggestion3: "Printing isn't working, why?",
    helpChatSuggestion4: "How do I add a menu item?",

    tab_staff: "Staff",
    loginWelcome: "Who's working?",
    loginSubtitle: "Select your name and enter your PIN to clock in.",
    loginNoStaffYet: "No staff set up yet — add yourself to get started.",
    loginAddYourself: "Add yourself",
    loginBackToNames: "Back",
    enterPin: "Enter your 4-digit PIN",
    pinIncorrect: "Incorrect PIN — try again",
    clockIn: "Clock in",
    yourNamePlaceholder: "Your name",
    choosePinPlaceholder: "Choose a 4-digit PIN",
    createPinAndStart: "Create PIN & clock in",
    notice_pinMustBe4Digits: "PIN must be 4 digits",
    notice_nameRequired: "Enter a name first",
    notice_employeeExists: "Someone with that name is already on staff",
    clockedInSince: "Clocked in since {{time}}",
    hoursWorked: "Hours worked",
    yourOrders: "Your orders",
    yourRevenue: "Your revenue",
    yourShift: "Your shift",
    registerTotals: "Register totals (all staff)",
    clockOut: "Clock out",
    confirm_clockOut: "Clock out now? This ends your shift.",
    viewingModeTitle: "Just viewing",
    viewingModeSubtitle: "You're signed in to check the system without an active shift — nothing here counts toward shift stats or the shift log.",
    exitViewMode: "Exit",
    loginModeChoiceTitle: "Welcome, {{name}}",
    loginModeChoiceSubtitle: "Are you clocking in to work a shift, or just checking the system?",
    loginClockInOption: "Clock in for a shift",
    loginViewOnlyOption: "Just view — no shift",
    shiftRecapTitle: "Nice work, {{name}}!",
    shiftRecapHours: "{{hours}} worked",
    shiftAlreadyClosedElsewhere: "This shift was already closed on another screen with a count of {{counted}}. The count you entered here was not saved.",
    avgOrderValue: "Avg order value",
    topSellerThisShift: "Your top seller",
    noSalesThisShift: "No sales this shift.",
    done: "Done",
    logOut: "Log out",
    staffTitle: "Staff",
    staffSubtitle: "Manage who can clock in, and see how everyone's shifts have gone.",
    addEmployee: "Add employee",
    editPin: "Edit PIN",
    removeEmployee: "Remove",
    confirm_removeEmployee: "Remove {{name}} from staff? Their past shift history is kept.",
    openShiftsTitle: "Open shifts right now",
    noOpenShifts: "No one's currently clocked in.",
    openShiftSince: "Since {{time}}",
    shiftHistoryTitle: "Recent shifts",
    noShiftHistory: "No completed shifts yet.",
    leaderboardTitle: "Top performers (last 30 days)",
    noLeaderboardData: "Not enough data yet.",
    shiftHistoryLine: "{{orders}} orders · {{revenue}} · {{hours}}",
    viewShiftDetailTooltip: "View this shift's details",
    shiftDetailTicketsTitle: "Orders this shift",
    shiftStillOpenBadge: "Live now",
    openShiftOngoingLabel: "ongoing",
    currentlyClockedIn: "Currently clocked in",
    teamRosterTitle: "Waiters & delivery",
    teamRosterSubtitle: "Add non-login team members so orders can be assigned to whoever is serving or delivering them.",
    newTeamMemberPlaceholder: "Name",
    roleWaiter: "Waiter",
    roleDelivery: "Delivery",
    addTeamMember: "Add",
    removeTeamMember: "Remove",
    confirm_removeTeamMember: "Remove {{name}} from the team roster? Past orders keep their assignment.",
    notice_enterTeamMemberName: "Enter a name first",
    notice_teamMemberAdded: "{{name}} added to the team",
    noTeamMembersYet: "No waiters or delivery staff added yet.",
    assignedToLabel: "Assigned to (optional)",
    assignedToNone: "— Unassigned —",
    assignedToBadge: "{{role}}: {{name}}",
    reassignLabel: "Reassign",
    teamPerformanceTitle: "Team performance (this shift)",
    teamPerformanceSubtitle: "Orders since you clocked in, grouped by who they're assigned to — use this to reconcile cash with delivery staff at the end of the day.",
    noTeamPerformanceYet: "No orders assigned to anyone yet this shift.",
    viewAssignedOrders: "View orders ({{n}})",
    hideAssignedOrders: "Hide orders",
    servedByLabel: "Served by {{name}}",
    deliveryReconciliationTitle: "Delivery cash reconciliation",
    deliveryReconciliationSubtitle: "Every unsettled delivery order, by rider, until you settle up. The restaurant keeps {{cut}} of each delivery fee — the rider keeps the rest, whether that's out of cash they collected or credited to them on a card/InstaPay order they still delivered.",
    noDeliveryReconciliationYet: "No unsettled delivery orders right now.",
    deliveryReconciliationCash: "Cash collected",
    deliveryReconciliationFees: "Delivery fees kept",
    deliveryReconciliationOwed: "Owes restaurant",
    deliveryReconciliationOwedToAgent: "Restaurant owes rider",
    deliveryAddressesLabel: "Delivery addresses",
    noAddressOnFile: "No address on file",
    settleDeliveryCash: "Settle up",
    confirm_settleDelivery: "Mark all of {{name}}'s outstanding orders as settled?",
    notice_deliverySettled: "Settled up with {{name}}",
    riderReportTitle: "Delivery employee report",
    riderReportSubtitle: "Pick a delivery employee and the dates to see every delivery they took — the client, the address and the order amount, with the delivery fee kept separate — then print it for them.",
    riderReportEmployee: "Delivery employee",
    riderReportFrom: "From",
    riderReportTo: "To",
    riderReportNoRiders: "No delivery staff yet — add them in the Staff tab and their reports will appear here.",
    riderReportEmpty: "No completed delivery orders assigned to {{name}} on these dates.",
    riderReportOrders: "Orders",
    riderReportOrdersTotal: "Orders total",
    riderReportFeesTotal: "Delivery fees",
    riderReportGrandTotal: "Total (orders + fees)",
    riderReportOrderAmount: "Order amount",
    riderReportNoName: "No name given",
    riderReportPrint: "Print report",
    riderReportSignature: "Delivery employee signature",
    riderReportReceivedBy: "Received by",
    riderReportPrintedAt: "Printed {{time}}",

    notice_giveCategoryName: "Give the category a name first",
    notice_categoryExists: "A category with that name already exists",
    notice_itemAdded: "{{name}} added to menu",
    notice_itemUpdated: "{{name}} updated",
    notice_giveItemNamePrice: "Give the item a name and a valid price",
    notice_pickIngredientQty: "Pick an ingredient and a quantity used per serving",
    notice_giveIngredientName: "Give the ingredient a name first",
    notice_enterCustomUnit: "Enter the custom unit (e.g. \"tray\", \"jar\")",
    notice_ingredientAdded: "{{name}} added — tracked in {{unit}}",
    notice_cantDeleteUsed: "Can't delete — this ingredient is used in a menu item's recipe",
    notice_enterDiscountValue: "Enter a discount value first",
    notice_orderSavedNoSync: "Order saved locally, but receipt history couldn't sync — try again shortly",
    notice_orderSavedNoCustomer: "Order saved — customer details couldn't be saved this time",
    notice_orderSavedOk: "Order saved and stock updated",
    notice_orderCancelled: "Order #{{n}} cancelled, stock restored",
    notice_orderRefunded: "Order #{{n}} refunded — stock not restored",
    notice_noPhoneOnFile: "Order #{{n}} has no phone number on file — couldn't send WhatsApp update",
    notice_whatsappSentTo: "WhatsApp update sent to {{name}}",
    notice_whatsappOpenedFor: "WhatsApp opened for {{name}} — tap Send there to notify them",
    notice_whatsappBackendFailed: "Couldn't reach WhatsApp backend — showing the message to send manually",
    whatsappFallbackTitle: "Send this update via WhatsApp",
    whatsappFallbackSubtitle: "No WhatsApp backend is configured yet, so this can't be sent automatically. Copy the message below or open it directly in WhatsApp.",
    smsFallbackTo: "To: {{name}} ({{phone}})",
    copyMessage: "Copy message",
    copied: "Copied!",
    openWhatsApp: "Open WhatsApp",
    notice_orderMarked: "Order #{{n}} marked \"{{status}}\"",
    notice_orderUpdated: "Order #{{n}} updated",
    notice_shiftStartSaveFailed: "Couldn't save new shift start",
    notice_newShiftStarted: "New shift started",
    notice_recognizedCustomer: "Recognized returning customer: {{name}}",
    notice_zoneAutoDetected: "Delivery zone set automatically: {{zone}}",
    notice_loadedCustomerDetails: "Loaded details for {{name}}",
    notice_receiptDownloaded: "Receipt downloaded — open the file to print it",
    notice_shiftReportDownloaded: "Shift report downloaded — open the file to print it",
    confirm_removeMenuItem: "Remove \"{{name}}\" from the menu?",
    confirm_deleteCategory: "Delete \"{{name}}\" and all its menu items? This can't be undone.",
    notice_brandingSaveFailed: "Couldn't save — try again shortly",
    notice_logoInvalidType: "That file doesn't look like an image",
    notice_logoTooLarge: "Logo file is too large — please use one under 700KB",
    notice_logoUpdated: "Logo updated",

    renewalNoticeTitle: "Time to renew",
    renewalNoticeBody_1: "Access expires tomorrow ({{date}}). Contact your provider to keep the POS running without interruption.",
    renewalNoticeBody_3: "Access expires in 3 days ({{date}}). Contact your provider to keep the POS running without interruption.",
    renewalNoticeBody_7: "Access expires in 7 days ({{date}}). Contact your provider to keep the POS running without interruption.",
    renewalNoticeDismiss: "Got it",
  },
  ar: {
    appSubtitle: "محطة الطلبات",
    tableLabel: "طاولة",
    serverLabel: "النادل",
    tab_order: "الطلب",
    tab_menu: "القائمة",
    tab_stock: "المخزون",
    tab_receipts: "الإيصالات",
    tab_customers: "العملاء",
    tab_shift: "الوردية",

    payment_cash: "نقدًا",
    payment_visa: "فيزا",
    payment_instapay: "إنستاباي",
    payment_wallet: "محفظة إلكترونية",
    payment_split: "دفع مقسّم",
    splitPaymentOption: "دفع مقسّم",
    splitRemainingLabel: "المتبقي",
    notice_splitPaymentMismatch: "يجب أن يساوي مجموع المبالغ المقسّمة الإجمالي ({{amount}}) موزعًا على طريقتين على الأقل",

    status_placed: "تم استلام الطلب",
    status_preparing: "قيد التحضير",
    status_out_for_delivery: "في الطريق للتوصيل",
    status_delivered: "تم التوصيل",

    ticketNumber: "فاتورة رقم {{n}}",
    newTicketLabel: "فاتورة جديدة",
    saved: "تم الحفظ",
    open: "مفتوحة",
    tapMenuItemHint: "اضغط على أي صنف من القائمة لإضافته إلى الفاتورة.",
    noItemsInCategory: "لا توجد أصناف في هذا القسم بعد — أضف بعضها من تبويب القائمة.",
    addDiscount: "+ إضافة خصم",
    apply: "تطبيق",
    cancel: "إلغاء",
    confirmAction: "تأكيد",
    discountLabel: "الخصم: {{value}}",
    splitBill: "+ تقسيم الفاتورة",
    addToExistingInvoice: "+ إضافة إلى فاتورة موجودة",
    addToExistingInvoiceTitle: "إضافة إلى فاتورة غير مدفوعة",
    addToExistingInvoiceSubtitle: "اختر فاتورة غير مدفوعة من هذا الشهر لإضافة هذه الأصناف إليها، بدلًا من حفظها كفاتورة جديدة.",
    notice_addedToInvoice: "تمت الإضافة إلى الفاتورة رقم {{n}}",
    numberOfPeoplePlaceholder: "عدد الأشخاص",
    splitLabel: "تقسيم على {{n}}",
    eachPays: "{{amount}} للفرد",
    notice_enterSplitValue: "أدخل عدد الأشخاص الذين سيقسمون الفاتورة (شخصان أو أكثر)",
    edit: "تعديل",
    remove: "إزالة",
    subtotal: "الإجمالي الفرعي",
    discount: "الخصم",
    total: "الإجمالي",
    itemCount: "صنف واحد",
    itemCount_plural: "{{n}} أصناف",
    customerOptional: "العميل (اختياري)",
    phoneSearchPlaceholder: "رقم الهاتف — اكتبه للبحث عن عميل سابق",
    noMatchesNewCustomer: "لا توجد نتائج — سيُعتبر عميلًا جديدًا.",
    unnamed: "بدون اسم",
    namePlaceholder: "الاسم",
    phonePlaceholder: "رقم الهاتف",
    addressPlaceholder: "العنوان (للتوصيل)",
    etaPlaceholder: "الوقت المتوقع (مثال: 30-40 دقيقة، يُرسل مع رسالة \"قيد التحضير\")",
    printReceipt: "طباعة الإيصال",
    printReceiptTooltip: "يطبع مباشرة — يعمل بعد نشر التطبيق، وليس في هذه المعاينة",
    download: "تنزيل",
    downloadReceiptTooltip: "ينزّل ملف إيصال يمكنك فتحه وطباعته — يعمل في هذه المعاينة",
    saveOrder: "حفظ الطلب",
    saveOrderUnpaid: "حفظ الطلب (غير مدفوع)",
    paidNowOption: "مدفوع الآن",
    payLaterOption: "الدفع لاحقًا",
    payLaterHint: "لحساب مفتوح — لم يتم تحصيل الدفع بعد",
    paidVia: "تم الدفع عبر {{method}}",
    unpaidBadge: "غير مدفوع",
    unpaidOrderTooltip: "تم الحفظ لكن لم يُحصَّل الدفع بعد",
    markOrderPaid: "تحديد كمدفوع",
    confirm_markOrderPaid: "تحديد الطلب رقم #{{n}} كمدفوع؟",
    notice_orderMarkedPaid: "تم تحديد الطلب رقم #{{n}} كمدفوع",
    unpaidSummary: "{{n}} غير مدفوع · {{amount}}",
    unpaidThisShiftLabel: "الطلبات غير المدفوعة من هذه الوردية",
    noUnpaidThisShift: "كل ما تم تسجيله في هذه الوردية تم دفعه.",
    thankYou: "شكرًا لك!",

    stockNotTracked: "المخزون غير متابَع",
    outOfStock: "نفد من المخزون",
    lowLeft: "منخفض · باقي {{n}}",
    available: "{{n}} متوفر",
    notEnoughForAnother: "لا توجد كمية كافية من {{ingredient}} لإضافة {{item}} أخرى",
    notEnoughToIncrease: "لا توجد كمية كافية من {{ingredient}} لزيادة هذا الصنف",
    genericStock: "المخزون",

    menuEditorTitle: "محرر القائمة",
    menuEditorSubtitle: "أضف الأقسام والأطباق، وحدد المكونات المستخدمة في كل طبق ليتم خصم المخزون تلقائيًا عند الطلب.",
    scanMenuButton: "مسح صورة قائمة",
    scanMenuHint: "ارفع صورة لقائمة مطبوعة وسنقرأ الأصناف لتراجعها قبل إضافتها.",
    scanMenuModalTitle: "مسح صورة القائمة",
    scanMenuScanning: "جارٍ قراءة قائمتك…",
    scanMenuReviewTitle: "تم العثور على {{n}} صنف — راجعها قبل الإضافة",
    scanMenuReviewHint: "أزل التحديد عن أي شيء يبدو غير صحيح، أو عدّل الاسم/السعر مباشرة.",
    scanMenuAddButton: "إضافة {{n}} صنف إلى القائمة",
    scanMenuTryAgain: "جرّب صورة أخرى",
    notice_menuScanTooLarge: "هذه الصورة كبيرة جدًا — جرّب صورة أصغر من 30 ميجابايت",
    notice_menuScanFailed: "تعذّرت قراءة القائمة — جرّب صورة أوضح أو بإضاءة أفضل",
    notice_menuScanAdded: "تمت إضافة {{n}} صنف إلى قائمتك",
    newCategoryPlaceholder: "اسم قسم جديد (مثال: أطباق جانبية)",
    addCategory: "إضافة قسم",
    addItem: "+ إضافة صنف",
    deleteCategory: "حذف القسم",
    noRecipeSet: "لم يتم تحديد مكونات — لا يُتابع المخزون",
    delete: "حذف",
    noItemsYet: "لا توجد أصناف بعد.",
    addItemToCategory: "إضافة صنف إلى {{category}}",
    editItemTitle: "تعديل {{name}}",
    uploadPhoto: "رفع صورة",
    changePhoto: "تغيير الصورة",
    removePhoto: "إزالة الصورة",
    photoUploadedHint: "تظهر هذه الصورة في كل مكان يظهر فيه هذا الصنف.",
    suggestedPhotoHint: "لا توجد صورة بعد — يتم عرض الحروف الأولى للطبق حتى ترفع صورة.",
    profileAddCategoryPlaceholder: "فئة جديدة لقائمة الأسعار هذه فقط",
    profileAddCategory: "إضافة فئة",
    profileOwnCategoryBadge: "هذه القائمة فقط",
    profileDeleteCategory: "حذف الفئة",
    confirm_deleteProfileCategory: "حذف الفئة \"{{name}}\" من قائمة الأسعار هذه مع كل أصنافها؟ القائمة الرئيسية لا تتأثر.",
    profileRemoveItem: "إزالة من هذه القائمة",
    profileRestoreItem: "استعادة",
    profileItemRemovedBadge: "أُزيل من هذه القائمة",
    confirm_removeFromProfile: "إزالة \"{{name}}\" من قائمة الأسعار هذه؟ يبقى في القائمة الرئيسية ويمكنك استعادته هنا في أي وقت.",
    notice_profileCategoryAdded: "أُضيفت الفئة \"{{name}}\" إلى قائمة الأسعار هذه",
    notice_profileCategoryExists: "هذه الفئة موجودة بالفعل في قائمة الأسعار هذه",
    mainCategoriesTitle: "الأقسام الرئيسية",
    mainCategoriesSubtitle: "اجمع أقسامك تحت أقسام رئيسية — مثل لحم البقر أو الدجاج. في شاشة الطلب تكون الأقسام الرئيسية الصف الأول من التبويبات والأقسام داخلها الصف الثاني. يمكن لقسم أن يكون في أكثر من قسم رئيسي؛ والأقسام التي ليست في أي قسم رئيسي تظهر تحت \"أخرى\". وبدون أقسام رئيسية تبقى شاشة الطلب كما هي.",
    newMainPlaceholder: "قسم رئيسي جديد (مثال: لحم بقري)",
    addMainCategory: "إضافة قسم رئيسي",
    mainCategoryOther: "أخرى",
    mainAddCategory: "إضافة قسم…",
    categoryAddToMain: "أضف إلى قسم رئيسي…",
    categoryUnderLabel: "ضمن:",
    confirm_deleteMainCategory: "حذف القسم الرئيسي \"{{name}}\"؟ تبقى أقسامه وأطباقه — فقط لم تعد مجمّعة تحته.",
    notice_mainCategoryExists: "يوجد قسم رئيسي بهذا الاسم بالفعل",
    customersImportBtn: "استيراد من إكسل",
    customersExportBtn: "تصدير إلى إكسل",
    notice_customersExported: "تم تصدير {{n}} عميل",
    notice_customersExportFailed: "تعذّر إنشاء ملف إكسل — حاول مجددًا",
    moveCategoryUp: "حرّك هذا القسم للأمام بين التبويبات",
    moveCategoryDown: "حرّك هذا القسم للخلف بين التبويبات",
    recipeQtyHint: "الكسور مقبولة: 0.5 أو 1/2 أو ½ أو 1 1/2.",
    priceListsTitle: "قوائم الأسعار",
    priceListsSubtitle: "اعكس نفس القائمة بأسعار مختلفة لتطبيقات التوصيل أو المناسبات أو علامة تجارية أخرى — نفس الأصناف والمكونات، بأسعارك أنت.",
    newProfileNamePlaceholder: "اسم قائمة الأسعار (مثال: طلبات)",
    createProfile: "إنشاء قائمة أسعار",
    profileStartFromLabel: "ابدأ من",
    profileStartEmpty: "فارغة — تتبع أسعار القائمة الرئيسية",
    profileStartMain: "نسخة من القائمة الرئيسية (بأسعارها الحالية)",
    profileStartCopyOf: "نسخة من \"{{name}}\"",
    notice_profileCreatedCopy: "تم إنشاء قائمة الأسعار \"{{name}}\" كنسخة من {{source}}.",
    profileCopyMainName: "القائمة الرئيسية",
    noProfilesYet: "لا توجد قوائم أسعار بعد — أنشئ واحدة لعرض أسعار مختلفة دون تكرار القائمة.",
    managePrices: "إدارة الأسعار",
    closeManage: "إغلاق",
    addExtraItem: "إضافة صنف إضافي",
    baseLabel: "الأساسي",
    extraLabel: "إضافي",
    notice_giveProfileName: "أدخل اسمًا لقائمة الأسعار أولاً.",
    notice_profileCreated: "تم إنشاء قائمة الأسعار \"{{name}}\".",
    confirm_deleteMenuProfile: "حذف قائمة الأسعار \"{{name}}\"؟ لن يؤثر ذلك على قائمتك الرئيسية.",
    dishNamePlaceholder: "اسم الطبق",
    shortDescriptionPlaceholder: "وصف مختصر",
    pricePlaceholder: "السعر",
    recipeLabel: "المكونات — الكمية المستخدمة لكل حصة",
    noIngredientsAdded: "لم تتم إضافة مكونات بعد.",
    copyRecipeFrom: "انسخ مكونات صنف آخر…",
    notice_recipeCopied: "تم نسخ مكونات \"{{name}}\" — عدّل أو أضف ما تريد فوقها",
    notice_recipeCopyNothingNew: "\"{{name}}\" ليس فيه مكونات غير موجودة هنا بالفعل",
    selectIngredient: "اختر مكونًا…",
    searchIngredient: "ابحث عن مكوّن…",
    noIngredientMatches: "لا يوجد مكوّن مطابق للبحث.",
    tab_closeday: "إغلاق اليوم",
    tab_website: "الموقع",
    closeDayTitle: "إغلاق اليوم",
    closeDayHint: "كل شيء عن يوم عمل واحد في مكان واحد: كيف سار اليوم، ودرج النقدية وردية بوردية، وسبب أي فرق. متاح للجميع.",
    closeDaySalesTitle: "كيف سار اليوم",
    closeDayDrawerTitle: "درج النقدية، وردية بوردية",
    cdRevenue: "الإيرادات",
    cdOrders: "الطلبات",
    cdExpenses: "المصروفات",
    cdNet: "الصافي بعد المصروفات",
    cdDiscounts: "{{n}} طلبات بخصم ({{amount}})",
    cdVoided: "{{n}} ملغاة / مسترجعة ({{amount}})",
    cdNoShifts: "لم تبدأ أي وردية في يوم العمل هذا.",
    cdOpened: "بدأت بـ",
    cdReceived: "النقدية المستلمة",
    cdPaidOut: "النقدية المصروفة",
    cdPaidOutHint: "نقدية أُعيدت للعملاء + مصروفات نقدية + أجر العامل المخصوم أو المدفوع عند تسوية الدليفري",
    riderPayLabel: "أجر العامل عند تسوية الدليفري",
    cdShouldBe: "المفروض",
    cdCollectedTitle: "النقدية المسحوبة في نهاية اليوم",
    cdCollectedHint: "إذا تُسحب نقدية اليوم من الدرج حول آخر جرد، اكتب المبلغ الذي سحبته. عندها يُفحص الدرج هكذا: المفروض − المسحوب = المجرود. اتركه فارغًا إن لم يُسحب شيء.",
    cdCollectedPlaceholder: "المبلغ المسحوب",
    cdCollectedSave: "حفظ",
    cdCollectedClear: "إزالة",
    cdCollectedRecorded: "سُجّل: {{amount}} بواسطة {{name}} الساعة {{time}}",
    cdCollectedCheck: "{{name}}: المفروض {{expected}} − المسحوب {{collected}} = {{left}}؛ المجرود {{counted}}.",
    cdCollectedImplied: "{{name}} جرد {{amount}} أقل من المتوقع — وهو تقريبًا ما يتركه سحب نهاية اليوم. اكتب المبلغ الذي سحبته فعلًا لفحصه.",
    cdCollectedSub: "− مسحوب {{amount}}",
    cdImpliedShort: "≈ سحب {{amount}}",
    cdCollectedRow: "المسحوب نهاية اليوم",
    cdCounted: "المعدودة",
    cdGap: "الفرق",
    cdNotCounted: "لم تُعدّ",
    cdStillOpen: "ما زالت مفتوحة",
    cdWholeDay: "اليوم كله",
    cdHandover: "بدأت بـ {{opening}}، لكن {{name}} عدّ {{previous}} عند الإغلاق — {{diff}} من النقدية غير محسوبة بين الورديتين.",
    cdDayGapExplain: "فرق اليوم كله هو مجموع فروق الورديات ({{shiftGaps}}) والفروق غير المفسَّرة بين الورديات ({{residuals}}).",
    cdGapsTitle: "سبب وجود الفرق",
    cdNoGaps: "كل درج تم عدّه يطابق ما توقعه النظام، وكل تسليم بين الورديات مطابق.",
    cdNothingCounted: "لم يتم عدّ أي درج في هذا اليوم (بدأت الورديات قبل أن يصبح عدّ النقدية إلزاميًا)، فلا يوجد ما يمكن مقارنته — يمكن فقط جمع النقدية المستلمة والمصروفة.",
    cdGapShort: "درج {{name}} ينقص {{amount}} عمّا توقعه النظام.",
    cdGapOver: "درج {{name}} فيه {{amount}} زيادة عمّا توقعه النظام.",
    cdLikely: "الأرجح:",
    cdCheck: "يستحق المراجعة:",
    cdEditCashToOther: "الفاتورة رقم {{n}} ({{amount}}) دُفعت الساعة {{paidAt}}، ثم غيّر {{by}} طريقة دفعها من {{from}} إلى {{to}} الساعة {{at}}. لو دفع العميل نقدًا فعلًا، فالنقدية موجودة في الدرج لكن النظام حسبها {{to}}.",
    cdEditOtherToCash: "الفاتورة رقم {{n}} ({{amount}}) دُفعت الساعة {{paidAt}}، ثم غيّر {{by}} طريقة دفعها من {{from}} إلى {{to}} الساعة {{at}}. لو دفع العميل فعلًا بـ{{from}}، فالنظام الآن يتوقع نقدية لم تدخل الدرج أصلًا.",
    cdReduced: "تمت إزالة أصناف من {{list}} بعد تسجيلها. لو دفع العملاء المبلغ الأصلي، فالنقدية الزائدة تظهر كزيادة.",
    cdNoCause: "لا شيء مسجَّل يفسّر الفرق. أعد عدّ الدرج، واسأل إن كانت نقدية قد أُخذت أو أُعطيت كباقي دون تسجيل.",
    cdHandoverGapTitle: "تغيّرت النقدية بمقدار {{diff}} بين عدّ إغلاق {{from}} وعدّ بداية {{to}}.",
    cdHandoverMissing: "خرجت نقدية من الدرج بعد عدّه عند الإغلاق وقبل أن تعدّه الوردية التالية — ولا تفسّرها وردية أي موظف.",
    cdHandoverExtra: "كان في الدرج أكثر عند عدّ الوردية التالية مما كان عند إغلاق الوردية السابقة — غالبًا أحد العدّين خاطئ.",
    cdAlsoCheck: "راجع أيضًا",
    cdAllGood: "لا شيء آخر للمراجعة.",
    cdOutsideShift: "{{n}} طلبات ({{amount}}) سُجّلت بينما لم يكن لـ {{names}} وردية في السجل — غالبًا نُسي تسجيل حضور أو انصراف.",
    cdUnpaid: "{{n}} طلبات ({{amount}}) ما زالت غير مدفوعة.",
    cdOpenShift: "وردية {{name}} ما زالت مفتوحة — لم يتم عدّ درجها بعد.",
    cdAutoClosed: "وردية {{name}} لم يُسجَّل لها انصراف وأُغلقت تلقائيًا.",
    cdNoCount: "وردية {{name}} بلا عدّ للنقدية (بدأت قبل أن يصبح العدّ إلزاميًا).",
    cdAfterClose: "(حدث هذا بعد إغلاق الوردية، لذلك ظهر الفرق لاحقًا.)",
    cdAtClosing: "عند إغلاق الوردية كان النظام يتوقع {{expected}} وكان الفرق {{gap}}. التغييرات التي حدثت بعد ذلك غيّرت المبلغ المتوقع إلى {{now}}.",
    cdFound: "أحداث مسجَّلة في هذه الوردية قد تكون مرتبطة بالفرق:",
    cdItemQtyDown: "في الفاتورة رقم {{n}} أزال {{by}} الساعة {{at}} الأصناف {{list}} بعد دفعها — أي {{about}}{{amount}} أقل في الفاتورة. لو دفع العميل السعر الأصلي، فالنقدية الزائدة موجودة في الدرج.",
    cdItemQtyUp: "في الفاتورة رقم {{n}} أضاف {{by}} الساعة {{at}} الأصناف {{list}} بعد دفعها — أي {{about}}{{amount}} أكثر في الفاتورة. لو لم يدفع العميل الفرق، فالدرج ناقص بهذا المبلغ.",
    cdAbout: "حوالي ",
    cdItemLegacyVoid: "الفاتورة رقم {{n}} ({{amount}} نقدًا) {{status}}، لكن لا يوجد ما يسجّل كيف أُعيد المبلغ. لو لم يُرجَع نقدًا، فهو ما زال في الدرج.",
    cdItemLooseExpense: "مصروف نقدي ({{what}}، {{amount}}) مؤرَّخ بهذا اليوم لكنه خارج أي وردية، فلم يخصم من أي درج. لو دُفع من هذا الدرج، فهذا يفسّر النقص.",
    cdExplainedExact: "هذه الأسباب مجتمعة تفسّر الفرق بالكامل ({{sum}}).",
    cdExplainedPartial: "هذه الأسباب تفسّر {{explained}} من فرق {{gap}}. ما زال {{rest}} بلا تفسير — أعد عدّ الدرج واسأل إن كانت نقدية قد أُخذت أو أُعطيت كباقي دون تسجيل.",
    cdOutsideRow: "خارج أي وردية",
    cdHandoverFlowTitle: "بين إغلاق {{from}} وبداية {{to}}:",
    cdHandoverFlow: "{{from}} عدّ {{previous}} عند الإغلاق. حتى بدأت الوردية التالية سجّل النظام {{received}} نقدية مستلمة ({{who}}) و{{paidOut}} مصروفة، فالمفروض أن في الدرج {{expected}}. بدأ {{to}} بـ {{opening}} — {{result}}",
    cdHandoverFlowMatch: "وهذا مطابق.",
    cdHandoverFlowMissing: "أقل من المتوقع بمقدار {{diff}}: خرجت نقدية من الدرج دون تسجيل.",
    cdHandoverFlowExtra: "أكثر من المتوقع بمقدار {{diff}}: دخلت نقدية الدرج دون تسجيل، أو أحد العدّين خاطئ.",
    cdHandoverNoShift: "هذه النقدية استُلمت بينما لم تكن لأحد وردية في السجل — نُسي تسجيل حضور أو انصراف لتلك الفترة.",
    cdClosedBy: "أغلق اليوم {{name}} في {{time}}",
    cdClosedNote: "ملاحظة: {{note}}",
    cdChangedSince: "تغيّر منذ الإغلاق:",
    cdChangeLine: "{{what}}: {{before}} عند الإغلاق، و{{after}} الآن",
    closeDayBtn: "إغلاق اليوم",
    cdCloseAgain: "إغلاق اليوم مرة أخرى",
    cdCloseBlockedOpen: "أغلق كل الورديات المفتوحة أولًا.",
    cdCloseModalTitle: "إغلاق {{date}}",
    cdCloseModalHint: "هذا يحفظ أرقام اليوم كسجل رسمي له. لو تغيّر أي شيء بعد ذلك، ستعرض هذه الشاشة ما تغيّر منذ الإغلاق.",
    cdCloseNoteRequired: "يوجد فرق في النقدية. اكتب ما اكتشفته أو قررته بشأنه.",
    cdCloseNotePlaceholderGap: "ماذا اكتشفت بشأن الفرق؟",
    cdCloseNoteOptional: "ملاحظات (اختياري)",
    cdCloseConfirm: "حفظ وإغلاق اليوم",
    cdPrint: "طباعة",
    cdDownload: "تنزيل",
    cdReportTitle: "تقرير إغلاق اليوم",
    notice_dayClosed: "تم إغلاق اليوم — وحُفظت أرقامه",
    openingCountTitle: "عدّ النقدية في الدرج",
    openingCountSubtitle: "قبل بدء الوردية، عدّ كل الأوراق والعملات في الدرج واكتب الإجمالي. لا يمكنك بدء الوردية بدون ذلك.",
    openingCountPlaceholder: "إجمالي النقدية المعدودة",
    openingCountStart: "ابدأ الوردية",
    openingCountPrevious: "آخر وردية ({{name}}) عدّت {{amount}} عند الإغلاق.",
    closingCountTitle: "عدّ النقدية في الدرج",
    closingCountSubtitle: "قبل تسجيل الانصراف، عدّ كل الأوراق والعملات في الدرج واكتب الإجمالي. لا يمكنك تسجيل الانصراف بدون ذلك.",
    closingCountConfirm: "تأكيد العد وتسجيل الانصراف",
    recapCashTitle: "درج النقدية",
    handoverMismatch: "بدأت بـ {{opening}} لكن آخر وردية عدّت {{previous}} عند الإغلاق",
    shiftCashLine: "بدأت بـ {{opening}} · العد {{counted}} · المتوقع {{expected}}",
    returnMethodTitle: "إرجاع المبلغ للعميل عن طريق",
    returnMethodSplit: "كما دُفع (مقسّم)",
    returnNothingToReturn: "هذا الطلب غير مدفوع، فلا يوجد مبلغ لإرجاعه.",
    returnedViaLabel: "تم إرجاع المبلغ: {{methods}}",
    discountReasonPlaceholder: "ما سبب هذا الخصم؟ (مطلوب)",
    notice_discountReasonRequired: "اكتب سبب الخصم أولًا",
    discountReasonLabel: "السبب: {{reason}}",
    shiftAutoClosedBadge: "أُغلقت تلقائيًا",
    shiftAutoClosedHint: "هذه الوردية لم يُسجَّل لها انصراف — أُغلقت تلقائيًا عندما سجّل نفس الشخص دخوله مرة أخرى (أو بعد 24 ساعة).",
    dayCheckTitle: "مراجعة اليوم — هل الأرقام متطابقة؟",
    dayCheckHint: "كل الطلبات المكتملة في يوم العمل المختار، مجمّعة حسب الوردية التي سُجّلت فيها. الإجمالي هو نفس رقم لوحة المعلومات لنفس اليوم.",
    dayCheckNoShift: "خارج أي وردية مسجلة",
    dayCheckNoShiftHint: "طلبات سُجّلت بينما لم يكن لهذا الشخص وردية في السجل — غالبًا نسيان تسجيل حضور أو انصراف.",
    dayCheckOrders: "الطلبات",
    dayCheckCash: "نقدًا",
    dayCheckOther: "طرق أخرى",
    dayCheckTotal: "الإجمالي",
    dayCheckMatches: "مطابق لإيرادات لوحة المعلومات لهذا اليوم",
    dayCheckEmpty: "لا توجد طلبات مكتملة في يوم العمل هذا.",
    markOutOfStock: "تحديد كنافد",
    markAvailable: "إتاحة الصنف",
    manuallyOutBadge: "محدد كنافد",
    notice_itemMarkedOut: "\"{{name}}\" أصبح نافدًا في كل مكان",
    notice_itemMarkedAvailable: "\"{{name}}\" متاح مرة أخرى",
    notice_outOfStockSaveFailed: "تعذر تحديث الصنف — تأكد من الاتصال وحاول مرة أخرى",
    reasonMarkedOut: "{{item}} محدد كنافد",
    callCenterLinkTitle: "رابط طلبات الكول سنتر",
    callCenterLinkSubtitle: "لفريق الكول سنتر. نفس القائمة وطريقة الطلب في رابط الطلب أونلاين، مع البحث في قاعدة بيانات العملاء بالهاتف أو الاسم. يسجّل الموظف دخوله باسمه ورمزه السري.",
    callCenterLinkNote: "أبقِ هذا الرابط خاصًا — فهو يفتح قائمة عملائك. شاركه مع موظفي الكول سنتر فقط.",
    soundSettingTitle: "صوت الطلب الجديد",
    kitchenTicketTitle: "طلب المطبخ",
    kitchenAddedLabel: "إضافة على الطلب",
    kitchenItemsTotal: "إجمالي الأصناف: {{n}}",
    kitchenServedBy: "بواسطة {{name}}",
    kitchenEta: "جاهز: {{text}}",
    kitchenTicketButton: "تذكرة المطبخ",
    kitchenTicketTooltip: "يطبع الطلب للمطبخ — الأصناف والكميات والملاحظات بدون أسعار",
    kitchenSettingTitle: "طباعة المطبخ",
    autoPrintTitle: "الطباعة التلقائية بعد حفظ الطلب",
    autoPrintNone: "بدون",
    autoPrintReceipt: "إيصال العميل",
    autoPrintKitchen: "تذكرة المطبخ (بدون أسعار)",
    autoPrintBoth: "الاثنان",
    autoPrintHint: "يسري على هذا الجهاز فقط. إيصال العميل فيه الأسعار؛ تذكرة المطبخ فيها الأصناف والكميات والملاحظات فقط. الهواتف والأجهزة اللوحية تعرض نافذة الطباعة في كل مرة.",
    kitchenWhereTitle: "أين تُطبع تذكرة المطبخ",
    kitchenModeOff: "إيقاف",
    kitchenModeHere: "اطبع على هذا الجهاز",
    kitchenModeSend: "أرسل إلى طابعة المطبخ",
    kitchenModeStation: "هذا الجهاز هو طابعة المطبخ",
    kitchenHint_off: "لا تُطبع الطلبات للمطبخ تلقائيًا. ما زال بإمكانك طباعة تذكرة المطبخ يدويًا من شاشة الطلب أو من تبويب الإيصالات.",
    kitchenHint_here: "عند حفظ طلب على هذا الجهاز، تُطبع هنا تذكرة للمطبخ (الأصناف والكميات والملاحظات — بدون أسعار).",
    kitchenHint_send: "عند حفظ طلب على هذا الجهاز، تُرسل تذكرة المطبخ إلى الجهاز المحدد كطابعة المطبخ ليطبعها. استخدمه على الهواتف والأجهزة اللوحية وأجهزة الكاشير التي ليس لها طابعة.",
    kitchenHint_station: "وصّل طابعة المطبخ بهذا الجهاز وأبقِ التطبيق مفتوحًا. كل تذكرة تُحفظ على أي جهاز تُطبع هنا خلال نحو 10 ثوانٍ.",
    kitchenSilentTip: "للطباعة دون نافذة طباعة كل مرة، افتح Chrome أو Edge على هذا الكمبيوتر بالخيار --kiosk-printing واجعل طابعة المطبخ هي الطابعة الافتراضية. الهواتف والأجهزة اللوحية تعرض نافذة الطباعة الخاصة بها دائمًا.",
    kitchenTestPrint: "اطبع تذكرة تجريبية",
    kitchenTestLabel: "تذكرة تجريبية",
    kitchenTestDish: "صنف تجريبي",
    kitchenStationWaiting: "في انتظار الطلبات. أبقِ هذه الشاشة مفتوحة ومضاءة.",
    kitchenRecentTitle: "آخر تذاكر المطبخ",
    kitchenPrintAgain: "اطبع مرة أخرى",
    notice_kitchenSendFailed: "تعذّر الوصول إلى طابعة المطبخ — طُبعت التذكرة هنا بدلًا من ذلك.",
    soundSettingHint: "شغّل صوتًا على هذا الجهاز كلما وصل طلب جديد من عميل أو من الكول سنتر (منيو QR أو رابط الطلب أو الكول سنتر). يسري على هذا الجهاز فقط.",
    soundOn: "الصوت يعمل",
    soundOff: "الصوت متوقف",
    soundTest: "تشغيل صوت تجريبي",
    pendingOrderCallCenter: "طلب كول سنتر — بواسطة {{agent}}",
    callCenterHeading: "الكول سنتر",
    callCenterSignInTitle: "تسجيل دخول الكول سنتر",
    callCenterPickName: "اختر اسمك",
    callCenterEnterPin: "أدخل رمزك السري المكوّن من 4 أرقام",
    callCenterWrongPin: "رمز سري غير صحيح — حاول مرة أخرى",
    callCenterNoStaff: "لا يوجد موظفون بعد. أضف الموظفين من شاشة الكاشير أولًا.",
    callCenterSignedInAs: "تسجيل الطلبات باسم {{name}}",
    callCenterSignOut: "تسجيل الخروج",
    callCenterCustomerTitle: "العميل",
    callCenterReturning: "عميل سابق — تم ملء بياناته ({{n}} طلبات سابقة)",
    callCenterPhoneRequired: "أضف رقم هاتف المتصل",
    callCenterBack: "رجوع",
    inRecipeMark: "موجود في المكونات",
    qtyPlaceholder: "الكمية",
    add: "إضافة",
    saveItem: "حفظ الصنف",

    stockTitle: "المخزون (المكونات)",
    stockSubtitle: "هذه هي المواد الخام التي تُصنع منها الأطباق. تُخصم تلقائيًا من الطلبات حسب مكونات كل طبق.",
    newIngredientPlaceholder: "اسم مكون جديد",
    otherUnit: "أخرى (اكتب الوحدة)…",
    customUnitPlaceholder: "مثال: صينية، برطمان",
    startingStockPlaceholder: "الرصيد الابتدائي",
    unitHint: "اختر الوحدة التي تُحصي بها فعليًا يوميًا — جرام لما يُوزن بدقة، قطع/زجاجات لما يُعد. هذه الوحدة ثابتة لهذا المكون أينما استُخدم.",
    low: "منخفض",
    inStock: "متوفر",
    restockAmountPlaceholder: "١٠",
    restockAmountTooltip: "اكتب أي كمية واضغط تجديد لإضافتها دفعة واحدة — مفيد بعد استلام توريد بدل الضغط على + كل مرة.",
    restockBulk: "تجديد",
    stockDecreaseTooltip: "فقط لتصحيح الأرقام أو إرجاع بضاعة تالفة/معيبة — الموظفون يقدروا يزودوا المخزون فقط ولا يقدروا يقللوه.",
    unitGroup_Weight: "الوزن",
    unitGroup_Volume: "الحجم",
    unitGroup_Count: "العدد",

    receiptsTitle: "الإيصالات",
    receiptsSubtitle: "يُحفظ كل شهر بشكل منفصل ويبقى محفوظًا إلى أجل غير مسمى. الإلغاء يستعيد المخزون؛ الاسترجاع لا يفعل ذلك؛ التعديل يضبطه.",
    loadingHistory: "جارٍ تحميل السجل…",
    orderCount: "طلب واحد",
    orderCount_plural: "{{n}} طلبات",
    expensesThisShiftCount: "مصروف واحد مسجّل",
    expensesThisShiftCount_plural: "{{n}} مصروفات مسجّلة",
    netAfterExpensesLabel: "الصافي بعد المصروفات",
    loadingMonth: "جارٍ تحميل {{month}}…",
    noSavedOrdersForMonth: "لا توجد طلبات محفوظة لشهر {{month}}.",
    noSavedOrdersForPeriod: "لا توجد طلبات محفوظة لهذه الفترة.",
    ticketHash: "فاتورة رقم {{n}}",
    cancelledBadge: "ملغى · تمت استعادة المخزون",
    refundedBadge: "مُسترجع · تم الاحتفاظ بالمخزون",
    statusColon: "الحالة:",
    whatsappSent: "تم الإرسال",
    whatsappChatOpened: "تم فتح المحادثة",
    whatsappLogLine: "✓ واتساب {{sentOrOpened}} لحالة \"{{status}}\" في {{time}}",
    saveChanges: "حفظ التغييرات",
    cancelEdit: "إلغاء التعديل",
    paymentMethodEditLabel: "طريقة الدفع",
    paymentMethodEditSplitNote: "اختيار طريقة هنا يستبدل تقسيم الدفع بطريقة واحدة فقط.",
    editReasonLabel: "سبب التعديل (اختياري)",
    discountEditLabel: "الخصم",
    editDiscountTitle: "الخصم",
    editDiscountValuePlaceholder: "بدون خصم",
    editDiscountRemove: "إزالة الخصم",
    editDiscountHint: "اترك القيمة فارغة لعدم وجود خصم. السبب مطلوب عند إضافة خصم أو تغييره.",
    editNewTotal: "الإجمالي بعد هذا التعديل: {{new}} (كان {{old}})",
    editHistoryDiscountRemoved: "أُزيل",
    cdDiscountDown: "في الفاتورة رقم {{n}} أضاف {{by}} الساعة {{at}} خصمًا ({{list}}) بعد دفعها — أي {{about}}{{amount}} أقل في الفاتورة. لو دفع العميل السعر الأصلي، فالنقدية الزائدة موجودة في الدرج.",
    cdDiscountUp: "في الفاتورة رقم {{n}} خفّض {{by}} الخصم أو أزاله ({{list}}) الساعة {{at}} بعد دفعها — أي {{about}}{{amount}} أكثر في الفاتورة. لو لم يدفع العميل الفرق، فالدرج ناقص بهذا المبلغ.",
    editReasonPlaceholder: "مثال: العميل غيّر رأيه",
    viewEditHistory: "عرض سجل التعديلات ({{n}})",
    hideEditHistory: "إخفاء سجل التعديلات",
    editHistoryEntry: "{{name}} · {{time}}",
    editHistoryChange: "{{item}}: من {{from}} إلى {{to}}",
    editHistoryNoReason: "لم يُذكر سبب",
    editHistoryUnknownEditor: "أحد الموظفين",
    printReceipt: "طباعة",
    cancelOrder: "إلغاء الطلب",
    cancelOrderTooltip: "الطلب لم يخرج أبدًا — يستعيد المخزون",
    refundOrder: "استرجاع الطلب",
    refundOrderTooltip: "تم تقديمه بالفعل — يبقى المخزون مستهلكًا",
    whatsappStatusTooltip: "يفتح أيضًا رسالة واتساب جاهزة للعميل",

    customersTitle: "العملاء",
    customersSubtitle: "يُحفظ هنا تلقائيًا كل من تم إدخال رقم هاتفه عند الدفع.",
    loading: "جارٍ التحميل…",
    noCustomersSaved: "لم يتم حفظ أي عملاء بعد.",
    unnamedCustomer: "عميل بدون اسم",
    lastOrderDate: "آخر طلب: {{date}}",

    currentShift: "الوردية الحالية",
    sinceDate: "منذ {{date}}",
    ordersCompleted: "الطلبات المكتملة",
    ordersCancelled: "الطلبات الملغاة",
    ordersRefunded: "الطلبات المُسترجعة",
    grossSales: "إجمالي المبيعات",
    refunds: "المبالغ المُسترجعة",
    net: "الصافي",
    shiftReportTitle: "تقرير الوردية",
    tableAndServer: "طاولة 12 · النادل أميرة",
    netSales: "صافي المبيعات",
    byPaymentMethod: "حسب طريقة الدفع",
    refundedCount: "مُسترجع · {{n}}",
    cancelledCountNote: "ملغى · {{n}} (تمت استعادة المخزون، غير محتسب)",
    discountedCountNote: "طلبات بها خصم · {{n}}",
    discountsGiven: "الخصومات الممنوحة",
    cashReconciliationTitle: "تسوية النقدية",
    cashReconciliationSubtitle: "يحسب كل طلب نقدي ومسترجع نقدي ومصروف نقدي سُجّل في هذه الوردية، عشان يكون إجمالي الدرج المتوقع دقيق فعلاً.",
    openingFloatLabel: "رصيد بداية الوردية",
    openingFloatHint: "النقدية الموجودة فعليًا في الدرج عند بداية هذه الوردية",
    cashSalesLabel: "المبيعات النقدية",
    unsettledDeliveryCashLabel: "بحوزة عمال الدليفري (لم تتم تسويتها بعد)",
    unsettledDeliveryCashHint: "مستبعدة بالفعل من المبيعات النقدية أعلاه — لا تزال هذه النقدية بحوزة العمال حتى تتم التسوية معهم أدناه.",
    cashRefundsLabel: "نقدية أُعيدت للعملاء",
    cashExpensesLabel: "المصروفات المدفوعة نقدًا",
    noCashExpensesThisShift: "لا توجد مصروفات نقدية مسجّلة في هذه الوردية.",
    expectedCashLabel: "النقدية المتوقعة في الدرج",
    countedCashLabel: "النقدية المعدودة",
    countedCashPlaceholder: "اعدّ الدرج واكتب الرقم هنا",
    varianceLabel: "الفرق",
    varianceOver: "زيادة",
    varianceShort: "عجز",
    varianceMatch: "مطابق تمامًا",
    electronicReconciliationTitle: "تسوية فيزا وإنستاباي والمحفظة الإلكترونية",
    electronicReconciliationSubtitle: "لا يوجد درج لعدّه هنا — فقط تأكد مما ظهر فعليًا في كشف حسابك البنكي أو المحفظة مقارنة بما تتوقعه هذه الوردية لكل طريقة.",
    salesLabel: "المبيعات",
    refundsLabel: "المسترجع",
    expectedSettlementLabel: "المتوقع",
    confirmedOnStatementLabel: "في الكشف",
    confirmedElectronicPlaceholder: "أدخل المبلغ من الكشف",
    printShiftReport: "طباعة تقرير الوردية",
    downloadReportTooltip: "ينزّل ملف تقرير يمكنك فتحه وطباعته — يعمل في هذه المعاينة",
    startNewShift: "بدء وردية جديدة",

    langToggleLabel: "اللغة",

    tab_settings: "الإعدادات",
    settingsTitle: "إعدادات المطعم",
    settingsSubtitle: "حدد اسم مطعمك وشعاره وألوان علامته التجارية — تُستخدم في التطبيق كله وعلى الإيصالات المطبوعة.",
    restaurantNameLabel: "اسم المطعم",
    restaurantNamePlaceholder: "اسم المطعم",
    logoLabel: "الشعار",
    uploadLogo: "رفع شعار",
    changeLogo: "تغيير الشعار",
    removeLogoBtn: "إزالة الشعار",
    noLogoUploaded: "لم يتم رفع شعار — يُستخدم الاسم النصي بدلاً منه.",
    locationLabel: "الموقع",
    locationPlaceholder: "الصق رابط خرائط جوجل، أو اكتب عنوانك",
    locationHint: "يضيف زر \"احصل على الاتجاهات\" إلى رابط الطلب عبر الإنترنت، ليتمكن العملاء من الوصول إليك مباشرة. افتح مطعمك في خرائط جوجل، اضغط مشاركة، والصق الرابط هنا — أو اكتب عنوانك فقط.",
    getDirectionsButton: "احصل على الاتجاهات",
    phoneNumberLabel: "رقم الهاتف",
    phoneNumberPlaceholder: "مثال: 01012345678",
    phoneNumberHint: "يضيف زر \"اتصل بنا\" إلى رابط الطلب عبر الإنترنت، ليتمكن العملاء من الاتصال بك مباشرة.",
    callButton: "اتصل بنا",
    primaryColorLabel: "اللون الأساسي",
    secondaryColorLabel: "اللون الثانوي",
    primaryColorHint: "يُستخدم للأزرار والتبويب النشط والإجراءات الرئيسية.",
    secondaryColorHint: "يُستخدم للمسات المميزة والروابط والشارات البارزة.",
    themeLabel: "المظهر",
    themeDark: "داكن",
    themeLight: "فاتح",
    themeHint: "يُطبَّق على شاشات هذا الجهاز. كل جهاز مسجّل دخول في هذا المطعم يرى نفس المظهر.",
    shiftHoursTitle: "ساعات الشِفت",
    shiftHoursHint: "متى يبدأ وينتهي شِفت كل يوم. الطلب الذي يتم تسجيله بعد منتصف الليل وقبل بداية الشِفت التالي يظل محسوبًا على اليوم الذي بدأ فيه الشِفت — بحيث لا يُقسَّم شِفت من 6 مساءً حتى 2 صباحًا بين يومين في لوحة المعلومات.",
    shiftHoursToLabel: "إلى",
    weekday_sun: "الأحد",
    weekday_mon: "الاثنين",
    weekday_tue: "الثلاثاء",
    weekday_wed: "الأربعاء",
    weekday_thu: "الخميس",
    weekday_fri: "الجمعة",
    weekday_sat: "السبت",
    previewLabel: "معاينة",

    taxesTitle: "الضرائب ورسوم الخدمة",
    taxesHint: "تُطبَّق تلقائيًا على كل طلب — اجعل القيمة 0 لإيقاف أي منهما.",
    vatPercentLabel: "ضريبة القيمة المضافة %",
    servicePercentLabel: "رسوم الخدمة %",
    taxesOrderNote: "تُحسب رسوم الخدمة على الإجمالي الفرعي بعد أي خصم؛ وتُحسب ضريبة القيمة المضافة فوق ذلك (الإجمالي الفرعي − الخصم + رسوم الخدمة).",
    tabAccessTitle: "الوصول إلى التبويبات",
    tabAccessHint: "أغلق أيًا من هذه التبويبات ليحتاج الموظفون العاديون إلى رمز PIN الخاص بمدير لفتحها. أنت (مسجّل دخول كمدير بالفعل) لديك دائمًا وصول كامل — لا تظهر الرسالة إلا للموظفين غير المديرين.",
    gatedTabTooltip: "يتطلب رمز PIN الخاص بمدير",
    enterManagerPinTitle: "مطلوب رمز PIN الخاص بمدير",
    enterManagerPinHint: "اطلب من مدير إدخال رمز PIN الخاص به لفتح {{tab}}.",
    managerPinIncorrect: "هذا ليس رمز PIN صالحًا لمدير.",
    serviceCharge: "رسوم الخدمة",
    vat: "ضريبة القيمة المضافة",

    tab_tables: "الطاولات",
    tablesTitle: "الطاولات",
    tablesSubtitle: "أنشئ طاولات مطعمك، وتابع المشغول منها، واطبع رمز QR لكل طاولة يفتح قائمتها.",
    numberOfTablesLabel: "عدد الطاولات",
    takeawayLabel: "استلام",
    deliveryLabel: "توصيل",
    dineInLabel: "صالة",
    tableNumbered: "طاولة {{n}}",
    renameTablePlaceholder: "اسم الطاولة",
    tableAvailable: "متاحة",
    tableOccupied: "مشغولة",
    openTicket: "فتح الفاتورة",
    clearTable: "إفراغ الطاولة",
    confirm_clearTable: "إفراغ طلب هذه الطاولة؟ ستُفقد أي أصناف لم تُحفظ.",
    markAsPaid: "تحديد كمدفوع",
    billRequestedBadge: "تم طلب الحساب · {{method}}",
    confirmPaymentTitle: "تأكيد الدفع لـ {{table}}",
    confirmPaymentBody: "المبلغ المستحق:",
    confirmPaymentButton: "تأكيد الدفع وإغلاق الحساب",
    notice_tableEmpty: "لا توجد أصناف مفتوحة على هذه الطاولة",
    notice_paymentConfirmed: "تم تأكيد الدفع — {{table}} متاحة الآن",
    paymentMethodLabel: "طريقة الدفع",
    qrCode: "رمز QR",
    qrModalTitle: "امسح لعرض القائمة",
    qrLinkNote: "يعمل هذا الرابط فقط بعد نشر التطبيق للعامة — لن يعمل من معاينة هذه المحادثة.",
    printQr: "طباعة",
    close: "إغلاق",
    orderingForLabel: "الطلب لـ",
    viewingMenuFor: "قائمة {{table}}",
    customerMenuHint: "اطلب من النادل تسجيل طلبك — هذه الصفحة لتصفح القائمة فقط.",
    scanQrFlyerTitle: "امسح لعرض قائمتنا",
    itemAvailable: "متوفر",
    itemNotAvailable: "غير متوفر",
    liveMenuNote: "تُحدَّث القائمة والأسعار مباشرة.",
    tableLabelOnReceipt: "الطاولة: {{table}}",
    requestBillButton: "طلب الحساب",
    checkoutModalTitle: "حسابك",
    checkoutModalNote: "يعكس الأصناف التي أكّدها النادل حتى الآن — أي طلب أرسلته للتو قد يستغرق لحظة ليظهر هنا.",
    checkoutEmptyItems: "لا يوجد شيء على حساب طاولتك بعد — اسأل النادل، أو أرسل طلبًا أولاً.",
    checkoutPreviousOrders: "طلبات سابقة",
    checkoutRequestButton: "طلب الحساب",
    checkoutRequestedTitle: "تم طلب الحساب",
    checkoutRequestedBody: "سيحضر لك النادل الحساب قريبًا.",
    checkoutRequestFailed: "تعذّر طلب الحساب — تحقق من اتصالك وحاول مرة أخرى.",

    addToOrder: "إضافة",
    yourOrder: "طلبك",
    orderTotal: "الإجمالي",
    sendOrderToKitchen: "إرسال الطلب",
    emptyCartHint: "أضف أصنافًا من القائمة لتكوين طلبك.",
    orderSentTitle: "تم إرسال الطلب!",
    orderSentSubtitle: "سيقوم النادل بمراجعته قريبًا وإحضاره. يمكنك متابعة التصفح وإرسال طلب آخر في أي وقت.",
    orderSentOk: "تم",
    orderConfirmedBanner: "تم تأكيد طلبك وجارٍ تحضيره الآن!",
    notice_cartEmpty: "أضف صنفًا واحدًا على الأقل قبل إرسال طلبك",
    notice_orderSendFailed: "تعذّر إرسال طلبك — تحقق من اتصالك وحاول مرة أخرى",
    pendingOrdersPill: "طلب جديد واحد",
    pendingOrdersPill_plural: "{{n}} طلبات جديدة",
    billRequestedPill: "طلب حساب واحد",
    billRequestedPill_plural: "{{n}} طلبات حساب",
    newOrderBadge: "طلب جديد",
    reviewOrder: "مراجعة الطلب",
    pendingOrderFrom: "طلب جديد من {{table}}",
    pendingOrderSubmitted: "أُرسل {{time}}",
    confirmOrder: "تأكيد وإضافة للفاتورة",
    rejectOrder: "رفض",
    confirm_rejectOrder: "رفض هذا الطلب؟ لن يتم إعلام العميل تلقائيًا — أبلغه عند الطاولة.",
    notice_orderConfirmed: "تمت إضافة الطلب إلى فاتورة {{table}}",
    notice_orderRejected: "تم رفض الطلب",
    noPendingOrders: "لا توجد طلبات عملاء قيد الانتظار.",

    addNote: "+ إضافة ملاحظة",
    notePlaceholder: "مثال: بدون بصل، حار إضافي، حساسية...",
    editNoteTitle: "تعديل الملاحظة",

    tab_expenses: "المصروفات",
    expensesTitle: "المصروفات",
    expensesSubtitle: "تابع ما تدفعه للموردين والتكاليف الأخرى — يُحفظ كل شهر بشكل منفصل، ويبقى محفوظًا، ومرئيًا في كل جهاز.",
    addExpense: "+ إضافة مصروف",
    editExpense: "تعديل المصروف",
    deleteExpense: "حذف",
    expenseAmount: "المبلغ",
    expenseCategory: "الفئة",
    expenseDate: "التاريخ",
    expenseSupplier: "المورّد",
    noSupplierOption: "بدون مورّد / أخرى",
    expenseNote: "ملاحظة",
    expenseNotePlaceholder: "مثال: رقم الفاتورة، ما يغطيه...",
    paymentStatus: "حالة الدفع",
    statusPaid: "مدفوع",
    statusUnpaid: "غير مدفوع (مستحق)",
    dueDate: "تاريخ الاستحقاق",
    markAsPaid: "وضع علامة كمدفوع",
    totalExpensesLabel: "الإجمالي هذا الشهر",
    totalExpensesPeriodLabel: "إجمالي هذه الفترة",
    byCategory: "حسب الفئة",
    outstandingPayables: "المستحقات غير المدفوعة",
    noOutstanding: "لا توجد مستحقات — كل شيء مدفوع.",
    manageSuppliers: "إدارة الموردين",
    addSupplier: "+ إضافة مورّد",
    supplierName: "اسم المورّد",
    supplierCategoryLabel: "ماذا يورّد",
    supplierPhone: "الهاتف (اختياري)",
    removeSupplier: "إزالة",
    noSuppliersYet: "لم تتم إضافة موردين بعد.",
    noExpensesForMonth: "لا توجد مصروفات مسجلة لشهر {{month}}.",
    loadingExpenses: "جارٍ تحميل المصروفات…",
    recordedByLabel: "سجّله {{name}}",
    confirm_deleteExpense: "حذف سجل هذا المصروف؟ لا يمكن التراجع عن هذا.",
    confirm_cancelOrder: "إلغاء الفاتورة رقم {{n}}؟ سيتم استعادة المخزون ولا يمكن التراجع عن هذا.",
    confirm_refundOrder: "استرجاع الفاتورة رقم {{n}}؟ سيبقى المخزون مستهلكًا ولا يمكن التراجع عن هذا.",
    confirm_removeSupplier: "إزالة {{name}} من الموردين؟ سيتم الاحتفاظ بالمصروفات السابقة المرتبطة به.",
    confirm_removeIngredient: "حذف \"{{name}}\" من المخزون؟ لا يمكن التراجع عن هذا.",
    notice_expenseSaved: "تم حفظ المصروف",
    notice_expenseDeleted: "تم حذف المصروف",
    notice_supplierAdded: "تمت إضافة {{name}} إلى الموردين",
    notice_enterExpenseAmount: "أدخل مبلغًا صحيحًا أولاً",
    notice_enterSupplierName: "أدخل اسم المورّد أولاً",
    category_ingredients: "المكونات / المخزون",
    category_rent: "الإيجار",
    category_utilities: "المرافق",
    category_payroll: "الرواتب",
    category_equipment: "المعدات والصيانة",
    category_marketing: "التسويق",
    category_packaging: "التغليف واللوازم",
    category_other: "أخرى",
    syncLabelExpenses: "سجل مصروف",

    roleManager: "مدير",
    roleStaff: "موظف",
    makeManager: "تعيين كمدير",
    makeStaff: "تعيين كموظف",
    managerOnlyHint: "يظهر هذا للمديرين فقط",
    confirm_lastManager: "{{name}} هو المدير الوحيد في الفريق — تخفيض رتبته سيترك لا أحد قادرًا على رؤية المصروفات. عيّن مديرًا آخر أولاً.",

    tab_delivery: "التوصيل",
    deliveryZonesTitle: "مناطق التوصيل",
    deliveryZonesSubtitle: "حدد رسوم توصيل لكل مسافة/منطقة. يختار العملاء الذين يطلبون عبر الإنترنت أقرب منطقة لهم عند إتمام الطلب.",
    deliveryAgentShareTitle: "كم يحتفظ المطعم من رسوم التوصيل",
    deliveryAgentShareSubtitle: "الباقي هو أجر عامل التوصيل. حدده كنسبة مئوية من كل رسوم، أو كمبلغ ثابت لكل توصيلة بغض النظر عن قيمة الرسوم.",
    retentionModePercentage: "نسبة مئوية",
    retentionModeFixed: "مبلغ ثابت",
    perDeliveryLabel: "لكل توصيلة",
    addZone: "+ إضافة منطقة",
    zoneLabel: "اسم المنطقة",
    zoneLabelPlaceholder: "مثال: 0-3 كم، أو اسم حي",
    zoneFee: "رسوم التوصيل",
    editZone: "تعديل",
    removeZone: "إزالة",
    noZonesYet: "لم يتم إعداد مناطق توصيل بعد — أضف واحدة ليتمكن العملاء عبر الإنترنت من اختيار التوصيل.",
    confirm_removeZone: "إزالة منطقة التوصيل هذه؟",
    notice_zoneAdded: "تمت إضافة منطقة التوصيل",
    notice_enterZoneLabel: "أدخل اسمًا للمنطقة أولاً",
    storeLinkTitle: "رابط الطلب عبر الإنترنت",
    storeLinkSubtitle: "شارك هذا الرابط على منصات التواصل الاجتماعي — يمكن للعملاء تصفح قائمتك الحية والطلب للاستلام أو التوصيل، دون الحاجة لرمز QR الخاص بطاولة. تصل الطلبات بنفس طريقة طلبات الطاولات: كطلب قيد الانتظار يراجعه الموظفون.",
    copyLink: "نسخ الرابط",
    linkCopied: "تم النسخ!",
    storeLinkNote: "مثل رموز QR الخاصة بالطاولات، يعمل هذا الرابط فقط بعد نشر التطبيق للعامة — لن يعمل من معاينة هذه المحادثة.",
    fulfillmentMethod: "كيف تريد استلام طلبك؟",
    pickupOption: "استلام",
    deliveryOption: "توصيل",
    chooseDeliveryZone: "اختر منطقتك",
    selectZonePlaceholder: "اختر أقرب منطقة إليك",
    deliveryFeeLineLabel: "رسوم التوصيل",
    pickupBadge: "استلام",
    deliveryBadge: "توصيل · {{zone}}",
    notice_chooseZoneFirst: "اختر منطقة التوصيل قبل إرسال طلبك",
    deliveryDetailsLabel: "بيانات التوصيل",
    notice_deliveryDetailsRequired: "اكتب اسمك ورقم هاتفك وعنوانك قبل إرسال طلبك",
    notice_copyFailed: "تعذّر النسخ تلقائيًا — حدد النص وانسخه يدويًا",

    tab_dashboard: "لوحة المعلومات",
    dashboardTitle: "لوحة المعلومات",
    dashboardSubtitle: "نظرة سريعة على أداء العمل — اختر يومًا أو شهرًا أو فترة مخصصة أدناه.",
    dashboardModeMonth: "شهر",
    dashboardModeDay: "يوم",
    dashboardModeRange: "فترة",
    periodRevenueLabel: "الإيرادات",
    periodOrdersLabel: "الطلبات",
    todayRevenue: "إيرادات اليوم",
    monthRevenue: "إيرادات هذا الشهر",
    monthOrders: "طلبات هذا الشهر",
    netProfitLabel: "صافي الربح",
    netProfitHint: "الإيرادات ناقص المصروفات المسجلة",
    netProfitHintDetailed: "{{revenue}} إيرادات − {{expenses}} مصروفات",
    expensesLabel: "المصروفات",
    avgOrderValueLabel: "متوسط قيمة الطلب",
    discountsGivenLabel: "الخصومات الممنوحة",
    vsYesterdayChange: "{{pct}}٪ مقارنة بالأمس",
    vsPreviousDayChange: "{{pct}}٪ مقارنة باليوم السابق",
    revenueTrendTitle: "إيرادات هذا الشهر",
    revenueTrendTitleMonth: "الإيرادات حسب اليوم",
    revenueTrendTitleDay: "الإيرادات حسب الساعة",
    revenueTrendTitleRange: "الإيرادات حسب اليوم",
    bestDayLabel: "أفضل يوم حتى الآن: يوم {{day}} — {{amount}}",
    bestDateLabel: "أفضل يوم حتى الآن: {{date}} — {{amount}}",
    bestHourLabel: "أفضل ساعة: {{time}} — {{amount}}",
    topSellersTitle: "الأصناف المباعة",
    dashAllCategories: "كل الفئات",
    dashCategoryOther: "غير موجودة في القائمة حاليًا",
    dashCategoryFilter: "فئة القائمة",
    noExpensesForPeriod: "لا توجد مصروفات في هذه الفترة.",
    notice_imageDecodeFailed: "تعذّر فتح هذه الصورة. احفظها بصيغة JPG أو PNG عادية وأعد المحاولة (صور HEIC من الآيفون غير مدعومة).",
    noSalesYetDashboard: "لا توجد طلبات مكتملة في هذه الفترة.",
    paymentMixTitle: "طرق الدفع",
    orderSourceTitle: "مصدر الطلبات",
    sourceDineIn: "تناول في المطعم",
    sourceTakeaway: "استلام",
    sourceOnline: "عبر الإنترنت (استلام/توصيل)",
    unitsSold: "بيع {{n}}",

    availableBadge: "متوفر",
    notAvailableBadge: "غير متوفر",
    onlineOrderingHeading: "اطلب عبر الإنترنت",

    offlineBadge: "غير متصل",
    menuLoadFailedBadge: "لم تُحمّل القائمة",
    menuLoadFailedHint: "تعذّر تحميل القائمة من الخادم، لذلك تظهر فارغة مؤقتًا. لا تأخذ طلبات من هذا الجهاز حتى يختفي هذا التنبيه؛ إعادة المحاولة تلقائية. لم يُستبدل أي شيء.",
    configLoadFailedBadge: "بعض الإعدادات لم تُحمّل",
    configLoadFailedHint: "تعذّر تحميل أحد إعدادات هذا المطعم (الطاولات، قوائم الأسعار، الضرائب، أو تقسيم رسوم التوصيل) من الخادم. تتم إعادة المحاولة تلقائيًا — لم يُستبدل أي شيء بعد. تجنّب تغيير هذا الإعداد من هذا الجهاز حتى يختفي هذا التنبيه.",
    syncPendingPill: "تغيير واحد بانتظار المزامنة",
    syncPendingPill_plural: "{{n}} تغييرات بانتظار المزامنة",
    retrySync: "إعادة المحاولة الآن",
    syncLabelOrders: "طلب",
    syncLabelMenu: "تغيير في القائمة",
    syncLabelStock: "تحديث في المخزون",
    syncLabelTables: "تغيير في الطاولات",
    syncLabelSettings: "تغيير في الإعدادات",
    syncLabelCustomers: "تحديث بيانات عميل",
    offlineOrderingDisabled: "أنت غير متصل بالإنترنت حاليًا، لذا لا يمكن إرسال الطلبات إلى المطبخ. أعد الاتصال وحاول مرة أخرى.",
    offlineOrderingHint: "بانتظار الاتصال...",
    rosterLoadFailedHint: "تعذّر تحميل قائمة الموظفين — تحقق من اتصالك وحاول مرة أخرى. أسماء فريقك ورموزهم السرية آمنة؛ هذا الجهاز فقط لا يستطيع الوصول إليها الآن.",

    helpChatTitle: "المساعدة واستكشاف الأخطاء",
    helpChatWelcome: "مرحبًا! اسألني عن أي شيء يخص استخدام هذا التطبيق — كيفية القيام بشيء ما، أو إذا كان هناك خلل.",
    helpChatPlaceholder: "اطرح سؤالاً...",
    helpChatSend: "إرسال",
    helpChatThinking: "جارٍ التفكير...",
    helpChatError: "تعذّر الوصول إلى المساعد — تحقق من اتصالك وحاول مرة أخرى.",
    helpChatOpen: "المساعدة",
    helpChatClose: "إغلاق",
    helpChatSuggestion1: "كيف أقسّم الفاتورة؟",
    helpChatSuggestion2: "كيف تعمل رموز QR للطاولات؟",
    helpChatSuggestion3: "الطباعة لا تعمل، لماذا؟",
    helpChatSuggestion4: "كيف أضيف صنفًا للقائمة؟",

    tab_staff: "الموظفون",
    loginWelcome: "من الذي يعمل الآن؟",
    loginSubtitle: "اختر اسمك وأدخل رمزك السري لتسجيل الحضور.",
    loginNoStaffYet: "لم تتم إضافة أي موظفين بعد — أضف نفسك للبدء.",
    loginAddYourself: "أضف نفسك",
    loginBackToNames: "رجوع",
    enterPin: "أدخل رمزك السري المكوّن من 4 أرقام",
    pinIncorrect: "رمز سري غير صحيح — حاول مرة أخرى",
    clockIn: "تسجيل الحضور",
    yourNamePlaceholder: "اسمك",
    choosePinPlaceholder: "اختر رمزًا سريًا من 4 أرقام",
    createPinAndStart: "إنشاء الرمز السري وتسجيل الحضور",
    notice_pinMustBe4Digits: "يجب أن يتكون الرمز السري من 4 أرقام",
    notice_nameRequired: "أدخل اسمًا أولاً",
    notice_employeeExists: "يوجد بالفعل موظف بهذا الاسم",
    clockedInSince: "الحضور منذ {{time}}",
    hoursWorked: "ساعات العمل",
    yourOrders: "طلباتك",
    yourRevenue: "إيراداتك",
    yourShift: "ورديتك",
    registerTotals: "إجمالي الصندوق (كل الموظفين)",
    clockOut: "تسجيل الانصراف",
    confirm_clockOut: "تسجيل الانصراف الآن؟ سينهي هذا ورديتك.",
    viewingModeTitle: "معاينة فقط",
    viewingModeSubtitle: "أنت مسجّل دخول لمتابعة النظام بدون وردية نشطة — لا شيء هنا يُحتسب ضمن إحصاءات الورديات أو سجلّها.",
    exitViewMode: "خروج",
    loginModeChoiceTitle: "أهلاً، {{name}}",
    loginModeChoiceSubtitle: "هل تسجّل حضورك للعمل في وردية، أم تريد فقط متابعة النظام؟",
    loginClockInOption: "تسجيل حضور لوردية",
    loginViewOnlyOption: "معاينة فقط — بدون وردية",
    shiftRecapTitle: "عمل رائع، {{name}}!",
    shiftRecapHours: "{{hours}} من العمل",
    shiftAlreadyClosedElsewhere: "هذه الوردية أُغلقت بالفعل على شاشة أخرى بعدّ {{counted}}. العدّ الذي أدخلته هنا لم يُحفظ.",
    avgOrderValue: "متوسط قيمة الطلب",
    topSellerThisShift: "أكثر ما بعته",
    noSalesThisShift: "لا توجد مبيعات في هذه الوردية.",
    done: "تم",
    logOut: "تسجيل الخروج",
    staffTitle: "الموظفون",
    staffSubtitle: "أدر من يمكنه تسجيل الحضور، وتابع أداء ورديات الجميع.",
    addEmployee: "إضافة موظف",
    editPin: "تعديل الرمز السري",
    removeEmployee: "إزالة",
    confirm_removeEmployee: "إزالة {{name}} من الموظفين؟ سيتم الاحتفاظ بسجل ورديته السابقة.",
    openShiftsTitle: "الورديات المفتوحة الآن",
    noOpenShifts: "لا يوجد أحد مسجّل حضوره حاليًا.",
    openShiftSince: "منذ {{time}}",
    shiftHistoryTitle: "الورديات الأخيرة",
    noShiftHistory: "لا توجد ورديات مكتملة بعد.",
    leaderboardTitle: "الأفضل أداءً (آخر 30 يومًا)",
    noLeaderboardData: "لا توجد بيانات كافية بعد.",
    shiftHistoryLine: "{{orders}} طلبات · {{revenue}} · {{hours}}",
    viewShiftDetailTooltip: "عرض تفاصيل هذه الوردية",
    shiftDetailTicketsTitle: "طلبات هذه الوردية",
    shiftStillOpenBadge: "جارية الآن",
    openShiftOngoingLabel: "مستمرة",
    currentlyClockedIn: "مسجل حضوره حاليًا",
    teamRosterTitle: "الجرسونات والدليفري",
    teamRosterSubtitle: "أضف أفراد الفريق الذين لا يسجلون دخولًا حتى تقدر تسند الطلبات لمن يقدّمها أو يوصّلها.",
    newTeamMemberPlaceholder: "الاسم",
    roleWaiter: "جرسون",
    roleDelivery: "دليفري",
    addTeamMember: "إضافة",
    removeTeamMember: "إزالة",
    confirm_removeTeamMember: "إزالة {{name}} من فريق العمل؟ سيتم الاحتفاظ بإسناد الطلبات السابقة.",
    notice_enterTeamMemberName: "اكتب الاسم أولاً",
    notice_teamMemberAdded: "تمت إضافة {{name}} إلى الفريق",
    noTeamMembersYet: "لم تتم إضافة جرسونات أو عمال دليفري بعد.",
    assignedToLabel: "مُسند إلى (اختياري)",
    assignedToNone: "— غير مُسند —",
    assignedToBadge: "{{role}}: {{name}}",
    reassignLabel: "إعادة الإسناد",
    teamPerformanceTitle: "أداء الفريق (هذه الوردية)",
    teamPerformanceSubtitle: "الطلبات منذ تسجيل حضورك، مجمّعة حسب من أُسندت إليه — استخدم هذا لتسوية النقدية مع عمال الدليفري في نهاية اليوم.",
    noTeamPerformanceYet: "لم تُسند أي طلبات لأحد بعد في هذه الوردية.",
    viewAssignedOrders: "عرض الطلبات ({{n}})",
    hideAssignedOrders: "إخفاء الطلبات",
    servedByLabel: "قدّمه {{name}}",
    deliveryReconciliationTitle: "تسوية نقدية الدليفري",
    deliveryReconciliationSubtitle: "كل طلبات الدليفري غير المُسوّاة بعد، حسب كل عامل، حتى تتم التسوية معه. يحتفظ المطعم بـ{{cut}} من كل رسوم توصيل — والباقي للعامل، سواء من النقدية التي حصّلها أو كرصيد له عن طلبات الفيزا/إنستاباي التي وصّلها أيضًا.",
    noDeliveryReconciliationYet: "لا توجد طلبات دليفري غير مُسوّاة حاليًا.",
    deliveryReconciliationCash: "النقدية المحصّلة",
    deliveryReconciliationFees: "رسوم التوصيل المحتفظ بها",
    deliveryReconciliationOwed: "مستحق للمطعم",
    deliveryReconciliationOwedToAgent: "مستحق للعامل من المطعم",
    deliveryAddressesLabel: "عناوين التوصيل",
    noAddressOnFile: "لا يوجد عنوان مسجل",
    settleDeliveryCash: "تسوية الحساب",
    confirm_settleDelivery: "تحديد كل طلبات {{name}} غير المُسوّاة كمُسوّاة؟",
    notice_deliverySettled: "تمت التسوية مع {{name}}",
    riderReportTitle: "تقرير عامل التوصيل",
    riderReportSubtitle: "اختر عامل التوصيل والتواريخ لترى كل توصيلة قام بها — اسم العميل والعنوان وقيمة الطلب، مع رسوم التوصيل منفصلة — ثم اطبع التقرير له.",
    riderReportEmployee: "عامل التوصيل",
    riderReportFrom: "من",
    riderReportTo: "إلى",
    riderReportNoRiders: "لا يوجد عمال توصيل بعد — أضفهم من تبويب الموظفين وستظهر تقاريرهم هنا.",
    riderReportEmpty: "لا توجد طلبات توصيل مكتملة مسندة إلى {{name}} في هذه التواريخ.",
    riderReportOrders: "الطلبات",
    riderReportOrdersTotal: "إجمالي الطلبات",
    riderReportFeesTotal: "رسوم التوصيل",
    riderReportGrandTotal: "الإجمالي (الطلبات + الرسوم)",
    riderReportOrderAmount: "قيمة الطلب",
    riderReportNoName: "بدون اسم",
    riderReportPrint: "طباعة التقرير",
    riderReportSignature: "توقيع عامل التوصيل",
    riderReportReceivedBy: "المستلم",
    riderReportPrintedAt: "طُبع {{time}}",

    notice_giveCategoryName: "يرجى إدخال اسم للقسم أولاً",
    notice_categoryExists: "يوجد بالفعل قسم بهذا الاسم",
    notice_itemAdded: "تمت إضافة {{name}} إلى القائمة",
    notice_itemUpdated: "تم تحديث {{name}}",
    notice_giveItemNamePrice: "يرجى إدخال اسم الصنف وسعر صحيح",
    notice_pickIngredientQty: "اختر مكونًا وكمية تُستخدم لكل حصة",
    notice_giveIngredientName: "يرجى إدخال اسم للمكون أولاً",
    notice_enterCustomUnit: "أدخل الوحدة المخصصة (مثل \"صينية\"، \"برطمان\")",
    notice_ingredientAdded: "تمت إضافة {{name}} — يُتابع بوحدة {{unit}}",
    notice_cantDeleteUsed: "تعذر الحذف — هذا المكون مستخدم في مكونات أحد الأصناف",
    notice_enterDiscountValue: "أدخل قيمة الخصم أولاً",
    notice_orderSavedNoSync: "تم حفظ الطلب محليًا، لكن تعذّرت مزامنة سجل الإيصالات — حاول مرة أخرى قريبًا",
    notice_orderSavedNoCustomer: "تم حفظ الطلب — تعذّر حفظ بيانات العميل هذه المرة",
    notice_orderSavedOk: "تم حفظ الطلب وتحديث المخزون",
    notice_orderCancelled: "تم إلغاء الطلب رقم {{n}}، وتمت استعادة المخزون",
    notice_orderRefunded: "تم استرجاع الطلب رقم {{n}} — لم تتم استعادة المخزون",
    notice_noPhoneOnFile: "الطلب رقم {{n}} لا يحتوي على رقم هاتف مسجل — تعذّر إرسال رسالة نصية",
    notice_whatsappSentTo: "تم إرسال تحديث واتساب إلى {{name}}",
    notice_whatsappOpenedFor: "تم فتح واتساب لـ {{name}} — اضغط إرسال هناك لإعلامه",
    notice_whatsappBackendFailed: "تعذّر الوصول إلى خادم واتساب — سيتم عرض الرسالة لإرسالها يدويًا",
    whatsappFallbackTitle: "أرسل هذا التحديث عبر واتساب",
    whatsappFallbackSubtitle: "لم يتم إعداد خادم واتساب بعد، لذا لا يمكن إرسالها تلقائيًا. انسخ الرسالة أدناه أو افتحها مباشرة في واتساب.",
    smsFallbackTo: "إلى: {{name}} ({{phone}})",
    copyMessage: "نسخ الرسالة",
    copied: "تم النسخ!",
    openWhatsApp: "فتح واتساب",
    notice_orderMarked: "تم وضع الطلب رقم {{n}} كـ \"{{status}}\"",
    notice_orderUpdated: "تم تحديث الطلب رقم {{n}}",
    notice_shiftStartSaveFailed: "تعذّر حفظ بداية الوردية الجديدة",
    notice_newShiftStarted: "تم بدء وردية جديدة",
    notice_recognizedCustomer: "تم التعرف على عميل سابق: {{name}}",
    notice_zoneAutoDetected: "تم تحديد منطقة التوصيل تلقائيًا: {{zone}}",
    notice_loadedCustomerDetails: "تم تحميل بيانات {{name}}",
    notice_receiptDownloaded: "تم تنزيل الإيصال — افتح الملف لطباعته",
    notice_shiftReportDownloaded: "تم تنزيل تقرير الوردية — افتح الملف لطباعته",
    confirm_removeMenuItem: "إزالة \"{{name}}\" من القائمة؟",
    confirm_deleteCategory: "حذف \"{{name}}\" وجميع أصنافه؟ لا يمكن التراجع عن هذا.",
    notice_brandingSaveFailed: "تعذّر الحفظ — حاول مرة أخرى قريبًا",
    notice_logoInvalidType: "هذا الملف لا يبدو صورة",
    notice_logoTooLarge: "حجم ملف الشعار كبير جدًا — يرجى استخدام ملف أصغر من 700 كيلوبايت",
    notice_logoUpdated: "تم تحديث الشعار",

    renewalNoticeTitle: "حان وقت التجديد",
    renewalNoticeBody_1: "ينتهي الوصول غدًا ({{date}}). تواصل مع مزوّد الخدمة للحفاظ على استمرار عمل نقطة البيع دون انقطاع.",
    renewalNoticeBody_3: "ينتهي الوصول خلال 3 أيام ({{date}}). تواصل مع مزوّد الخدمة للحفاظ على استمرار عمل نقطة البيع دون انقطاع.",
    renewalNoticeBody_7: "ينتهي الوصول خلال 7 أيام ({{date}}). تواصل مع مزوّد الخدمة للحفاظ على استمرار عمل نقطة البيع دون انقطاع.",
    renewalNoticeDismiss: "حسنًا",
  },
};

const EXPENSE_CATEGORIES = ["ingredients", "utilities", "equipment", "marketing", "packaging", "other"];

// Kitchen/delivery status shown to the operator and used to trigger WhatsApp updates.
// "preparing" and "out_for_delivery" are the two stages that message the customer automatically.
const FULFILLMENT_STATUSES = [
  { id: "placed", label: "Order placed", whatsapp: false },
  { id: "preparing", label: "Preparing", whatsapp: true },
  { id: "out_for_delivery", label: "Out for delivery", whatsapp: true },
  { id: "delivered", label: "Delivered", whatsapp: false },
];
// Itemized order summary (items + price breakdown) appended to the "preparing" WhatsApp update,
// so the customer sees exactly what they're being charged before the order even arrives.
const buildWhatsAppInvoiceText = (r, lang) => {
  const fmt = (n) => `${n.toFixed(2)} EGP`;
  const lines = r.items.map((it) => `${it.qty}x ${it.name} - ${fmt(it.price * it.qty)}`);
  const labels = lang === "ar"
    ? { subtotal: "الإجمالي الفرعي", discount: "الخصم", service: "الخدمة", vat: "ضريبة القيمة المضافة", delivery: "رسوم التوصيل", total: "الإجمالي" }
    : { subtotal: "Subtotal", discount: "Discount", service: "Service", vat: "VAT", delivery: "Delivery fee", total: "Total" };
  const summary = [
    `${labels.subtotal}: ${fmt(r.subtotal)}`,
    r.discountAmount > 0 ? `${labels.discount}: -${fmt(r.discountAmount)}` : null,
    r.serviceAmount > 0 ? `${labels.service} (${r.serviceRate}%): ${fmt(r.serviceAmount)}` : null,
    r.vatAmount > 0 ? `${labels.vat} (${r.vatRate}%): ${fmt(r.vatAmount)}` : null,
    r.deliveryFee > 0 ? `${labels.delivery}: ${fmt(r.deliveryFee)}` : null,
  ].filter(Boolean);
  return `${lines.join("\n")}\n\n${summary.join("\n")}\n*${labels.total}: ${fmt(r.total)}*`;
};
// Customer-facing WhatsApp message templates, in both UI languages — sent in whichever
// language the operator currently has the app set to.
const WHATSAPP_TEMPLATES = {
  en: {
    preparing: (r) =>
      `Hi ${r.customer?.name || "there"}, this is an update on your order #${r.ticketNo}: we've started preparing it now.` +
      (r.eta ? ` Estimated ready/delivery time: ${r.eta}.` : "") +
      ` We'll let you know when it's on its way!\n\n${buildWhatsAppInvoiceText(r, "en")}`,
    out_for_delivery: (r) => `Hi ${r.customer?.name || "there"}, your order #${r.ticketNo} is out for delivery${r.customer?.address ? ` to ${r.customer.address}` : ""}. It should be with you shortly!`,
  },
  ar: {
    preparing: (r) =>
      `مرحبًا ${r.customer?.name || "عزيزي العميل"}، هذا تحديث بخصوص طلبك رقم #${r.ticketNo}: بدأنا الآن في تحضيره.` +
      (r.eta ? ` الوقت المتوقع للجاهزية/التوصيل: ${r.eta}.` : "") +
      ` سنُعلمك عندما يكون في الطريق!\n\n${buildWhatsAppInvoiceText(r, "ar")}`,
    out_for_delivery: (r) => `مرحبًا ${r.customer?.name || "عزيزي العميل"}، طلبك رقم #${r.ticketNo} في الطريق إليك${r.customer?.address ? ` إلى ${r.customer.address}` : ""}. سيصلك قريبًا!`,
  },
};

// Set this to your own backend endpoint once you've deployed one (see notes near
// sendWhatsAppUpdate below). Leave it null to fall back to a manual "open WhatsApp yourself" flow.
const WHATSAPP_BACKEND_URL = null; // e.g. "https://your-backend.example.com/send-whatsapp"
// Keeps only digits, and assumes a leading '0' is a local number missing the country code.
// Adjust DEFAULT_COUNTRY_CODE for your market before relying on this in production.
const DEFAULT_COUNTRY_CODE = "20"; // Egypt
const normalizePhoneForWhatsApp = (raw) => {
  let digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  return digits;
};

// A per-tab monotonic counter, not just Date.now() + a small random suffix — several call sites
// (e.g. bulk-adding items from a scanned menu photo) generate many IDs in one synchronous loop,
// all landing on the same millisecond, where a 3-digit random suffix collides often enough in
// practice to matter: two menu items ending up with the same id makes findMenuItemAnywhere()
// silently resolve to the wrong one, so an item's stock check can run against a completely
// unrelated item's recipe.
let idCounter = 0;
// What this device last saw of a restaurant's look (name, logo, colours, theme, language), kept so the next visit
// paints the right restaurant at once. A device that has never opened this restaurant shows a plain spinner until
// the real details arrive — never anyone else's name or a stock one.
const bootKey = (tenantId) => `pos-boot:${tenantId}`;
const readBoot = (tenantId) => {
  try {
    const v = JSON.parse(window.localStorage.getItem(bootKey(tenantId)) || "null");
    return v && typeof v === "object" ? v : null;
  } catch (e) {
    return null;
  }
};
const writeBoot = (tenantId, patch) => {
  try {
    window.localStorage.setItem(bootKey(tenantId), JSON.stringify({ ...(readBoot(tenantId) || {}), ...patch }));
  } catch (e) {
    // storage full or blocked — the next visit just shows the spinner a moment longer
  }
};
function BootLoader() {
  return (
    <div className="boot-loader" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`.boot-loader{background:#f4f2ee;color:#8a8680}@media (prefers-color-scheme: dark){.boot-loader{background:#20242B;color:#9CA1AC}}@keyframes boot-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 22, height: 22, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "boot-spin .8s linear infinite" }} />
    </div>
  );
}

const newId = (prefix) => `${prefix}_${Date.now()}_${(idCounter++).toString(36)}_${Math.floor(Math.random() * 1e6)}`;

// A short two-tone chime for "a customer just requested the bill" — synthesized rather than an
// audio file so there's nothing extra to host or load. Fails silently if the browser blocks audio
// (e.g. no user interaction yet on this page load) since the on-screen pill is the notification
// of record; sound is just an extra nudge.
const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
    setTimeout(() => ctx.close(), 800);
  } catch (e) {
    // no-op — audio is a nice-to-have, never worth surfacing an error for
  }
};

// Retries a shared-storage read a few times with increasing delay before giving up. Startup loads
// are the very first thing this app does, and on some platforms (embedded mobile WebViews in
// particular) the storage bridge can take a moment to be fully ready — a single failed attempt
// right at mount doesn't necessarily mean genuine connectivity trouble, so this smooths over that
// race rather than immediately reporting real data as unreachable.
const getSharedWithRetry = async (storage, key, attempts = 3, baseDelayMs = 600) => {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await storage.get(key, true);
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (i + 1)));
    }
  }
  throw lastError;
};

// System prompt for the in-app help/troubleshooting chatbot. Built dynamically per restaurant
// name and current UI language so answers stay grounded in what this specific app actually does
// — including known quirks discovered while building it (print/QR only working once deployed,
// offline behavior, PINs being identification-only, etc.) rather than generic POS advice.
// How an order's edit history names the "payment method" field and the methods themselves, in either
// language — the ledger uses this to spot payment-method changes made after an order was paid.
const LEDGER_LABELS = {
  methodByLabel: (() => {
    const map = {};
    ["en", "ar"].forEach((l) => PAYMENT_METHODS.forEach((m) => { map[STRINGS[l][`payment_${m.id}`]] = m.id; }));
    return map;
  })(),
  isPayLabel: (name) => ["en", "ar"].some((l) => STRINGS[l].paymentMethodEditLabel === name),
};
const buildHelpSystemPrompt = (restaurantName, lang) => {
  const responseLang = lang === "ar" ? "Arabic" : "English";
  const S = STRINGS[lang] || STRINGS.en;
  // The exact on-screen wording for the current language, pulled straight from the same
  // dictionary the UI itself renders from — so if the bot says "tap X", X is guaranteed to match
  // what's actually printed on the button, rather than the model improvising its own translation
  // that might use slightly different (if reasonable) Arabic wording than the real interface.
  const glossaryKeys = [
    "tab_order", "tab_menu", "tab_stock", "tab_tables", "tab_delivery", "tab_receipts", "tab_expenses", "tab_dashboard",
    "tab_customers", "tab_shift", "tab_closeday", "tab_website", "tab_staff", "tab_settings",
    "addDiscount", "splitBill", "saveOrder", "printReceipt", "download", "clockOut", "clockIn",
    "qrCode", "addCategory", "addItem", "addEmployee", "editPin", "restockBulk", "paymentMethodEditLabel",
    "confirmOrder", "rejectOrder", "openTicket", "cancelOrder", "refundOrder",
    "payment_wallet", "priceListsTitle", "createProfile", "managePrices", "uploadPhoto",
    "themeLabel", "cashReconciliationTitle", "electronicReconciliationTitle", "deliveryReconciliationTitle",
    "deliveryAddressesLabel", "printShiftReport", "dashboardModeMonth", "dashboardModeDay", "dashboardModeRange",
    "phoneNumberLabel", "callButton", "getDirectionsButton", "shiftHoursTitle",
    "loginClockInOption", "loginViewOnlyOption", "exitViewMode", "addToExistingInvoice", "openShiftsTitle",
  ];
  const glossary = glossaryKeys.map((k) => `- ${S[k]}`).join("\n");

  return `You are a helpful, concise in-app support assistant for "${restaurantName}"'s point-of-sale system, a restaurant POS built for dine-in, takeaway, and delivery orders. Staff members are asking you how to use features or troubleshoot problems while working. Always respond in ${responseLang}, matching the app's current display language.

Keep answers short and actionable — a few sentences or a short numbered list, referencing actual tab names and buttons in the app. Don't pad with generic advice; give the specific steps for THIS app.

## Exact on-screen wording (current language)
When you refer to a tab or button, use the EXACT text below verbatim — it's pulled directly from the app's own interface. Do not translate or rephrase these yourself, even if a different phrasing would also be reasonable; consistency with what the person is actually looking at matters more than natural variation:
${glossary}

## App structure (tabs in the header)
Not every tab below is necessarily visible right now — which tabs show up depends on this
restaurant's subscription package (Basic/Standard/Premium), and Expenses/Dashboard are only ever
visible to a manager even on a package that includes them. If someone asks about a tab/feature you
don't see mentioned anywhere in this list, or one that's missing for them specifically, say plainly
that you don't see it and it may not be included in their current plan — don't guess.
- **Order**: build a ticket for a table or Takeaway/Delivery. Tap menu items to add them, adjust quantities, apply a discount (+ Add discount, available to every staff member, not just managers — the discount needs a written reason, which is saved on the receipt and shown in the Receipts tab), split the bill evenly among any number of people (+ Split bill), choose a payment method (Cash, Visa, InstaPay, or Wallet), then Save order. Once there are items in the cart, "+ Add to existing invoice" also appears if this month has any unpaid ("pay later") invoices — pick one to merge these items straight into that invoice (quantities combine for the same dish, everything else appends as a new line, and the total recalculates) instead of saving a separate new ticket. "Print receipt" and "Download" are both available — see printing notes below. A "Kitchen ticket" button prints the order for the kitchen — dish names, quantities and notes with NO prices — and kitchen tickets can also print automatically (see Kitchen printing under Settings). Switching tables preserves each table's in-progress order separately; switching between Takeaway and Delivery before saving carries the items and customer details across to the other one (unless that one already has its own items).
- **Price list tabs** (if this restaurant has created any): extra pill tabs sitting right next to Order, one per price list (e.g. "Talabat"). Clicking one switches the Order screen into that price list's pricing — same dishes and recipes as the main menu, but with whichever prices were overridden for that list, plus any items added only to that list. Stock still deducts from the one shared ingredient inventory. These price lists are POS-terminal only — they never change what customers see on a table's QR menu or the online-ordering link, which always shows the regular menu at regular prices. Price lists themselves are created and managed from the Menu tab.
- **Menu**: add/edit/delete categories and dishes. Every dish row also has a "Mark out of stock" / "Mark available" button: it switches a dish off by hand (for example when the kitchen runs out of something that isn't tracked in Stock) — the dish shows as out of stock on the Order screen and as not available on the QR menus, the online link and the call center link, until someone marks it available again. This works for any dish, with or without a recipe, and any employee can do it. Each dish can have a "recipe" — which stock ingredients it uses and how much — so orders automatically deduct stock. When adding or editing a dish's recipe, a "Copy the recipe of another item…" dropdown at the top of the recipe section copies all of another dish's ingredients and quantities in one go (for dishes that share a base), after which you can add more ingredients or change a quantity on top — ingredients already in the recipe are kept as typed, only missing ones are added. Every ingredient line in the recipe has an editable quantity box (just type a new number — no need to remove and re-add), and the "Search ingredient…" box under the recipe filters the stock list as you type (tap a result, enter the quantity, then Add or press Enter). A dish with no recipe set is treated as always in stock. Each dish can also have a photo — upload one from the item editor (editable any time; PNG, JPG, WEBP and GIF all work and big pictures are shrunk automatically); until you do, it shows the dish's initials instead. The photo shows everywhere that dish appears (Order screen, Menu tab, customer QR/online menu). There's also a "Scan a menu photo" option (if included in this restaurant's package) that reads a photo of a printed menu and pre-fills items for review before adding them — you check each one, edit anything wrong, then add. The "Price lists" section here is where you create/rename/delete price lists and manage them — see "Price list tabs" above for how they're used while ordering. When creating a price list you choose what it starts from: empty (it follows the main menu's prices), a copy of the main menu (every dish gets its current price written into the list), or a full copy of another price list (its prices, removed dishes, own categories and own dishes with their recipes — the copied dishes are separate dishes from then on). Inside a list ("Manage prices") you can: set a different price for any main-menu dish; add extra dishes (each with its own photo and recipe, so they deduct stock and show availability exactly like main-menu dishes, and an ingredient used by one can't be deleted); add a category that exists only in that list (type the name at the top of the list and tap "Add category" — it appears as a tab when that list is used on the Order screen, and can be deleted with its dishes without touching the main menu); and remove a main-menu dish from that list only ("Remove from this list" — it stays in the main menu, shows as removed, and can be restored with "Restore"). Deleting a category or dish from the main menu also removes it from every price list. Recipe quantities can be fractions of a unit — type 0.5, 1/2, ½ or 1 1/2 (for counted units like pieces, slices or bottles, quick buttons ¼ ⅓ ½ ¾ 1 1½ 2 appear after choosing the ingredient); they are shown as ½, 1¼ and so on, and each order deducts exactly that fraction from stock (the Stock tab can then show 7½ pieces). The category tabs can be rearranged: every category in the Menu tab has small ▲ ▼ arrows that move it earlier or later, and that order is used for the tabs on the Order screen and on the customer menus (a price list's own categories can be reordered the same way inside the list). "Main categories" (a card above the price lists) group the categories into bigger headings — for example Beef holding Cow Burger, Doner Burger and Bomb Burger (the existing categories then act as sub categories): create a main category, then choose which categories it contains, either from its own "Add a category…" list or from the "Add to a main category…" list on each category. Once at least one main category exists, the Order screen shows the main categories as a first row of tabs and the categories inside the chosen one as a second row; categories in no main category appear under "Other"; a category can be in several. Main categories can be renamed, reordered with ▲ ▼ and deleted (their categories and dishes stay). Customer menus list the categories in the same grouped order. With no main category nothing changes.
- **Stock**: manage ingredients, their units (weight/volume/count), and current stock levels. Any staff member can add stock — the +/- buttons adjust by one unit, or type any amount into the restock field next to them and tap "Restock" to add it all at once (handy after a delivery, instead of tapping + repeatedly). Only managers can remove stock (typing a smaller number directly into the stock count, or the − button) — that's for correcting a miscount or returning defective supply, not everyday adjustments. Managers also see an "Import from Excel" button: upload an .xlsx or .csv sheet with one row per item (item name, current balance, measuring unit — columns in any order, English or Arabic headings). A preview shows what will be added (new items), updated (existing items get the new balance), left unchanged or skipped, and any problems, before anything is saved; an existing item keeps its unit (g/kg and ml/L are converted automatically) and nothing is ever deleted. A template and the current stock can be downloaded as Excel files from the same window.
- **Tables**: set how many tables the restaurant has, rename any of them, see which are occupied, and generate/print a QR code per table that customers can scan to view the live menu and place their own order. A table shows "Occupied" while it has an open ticket, and shows a "Bill requested" badge with the customer's chosen payment method once they use the QR menu's checkout option — staff confirm payment with a "Mark as paid" button, which clears the table.
- **Delivery**: also shows a separate call center ordering link (copy it for the call center team): it opens the same menu and ordering as the online link, but agents first sign in with their staff name and PIN, and a phone/name search finds returning customers from the Customers list and fills in their name and address; the order shows up for review like any other online order, labeled as a call center order with the agent's name. Shows the shareable online-ordering link (for social media — customers browse the live menu and order pickup/delivery without a table's QR code) and lets you set delivery zones with a fee per zone, which customers pick from at checkout. The delivery fee retention setting (Settings tab) controls how much of each delivery fee the restaurant keeps vs. the rider — either a flat percentage or a fixed amount per delivery. At the bottom of the Delivery tab there is also a "Delivery employee report" (shown when staff tracking is included in the package): tap a delivery employee, choose From / To dates (today by default), and it lists every completed delivery assigned to them — client name, phone, address and the order amount, with the delivery fee shown separately — plus the totals; "Print report" prints it for the employee with signature lines. Only orders that were assigned to that employee on the Order screen appear in it.
- **Website** (manager-only; comes with the Online ordering link feature): turns the online-ordering link into a branded website for the restaurant. A manager picks one of five looks (Classic, Modern, Dark, Bold, Minimal — each sets fonts, shapes and layout together), can override the button and highlight colors (otherwise the brand colors from Settings are used), uploads a cover photo and up to 6 gallery photos, writes a tagline and an "About us" text in English and Arabic, adds an announcement banner, address and social links (Instagram, Facebook, TikTok, WhatsApp, website), chooses which sections show (About, Popular items row, Gallery, Opening hours — the hours and the "Open now / Closed" badge come from Settings → Shift hours) and chooses the language the page opens in. A live phone preview sits next to the controls (a "Preview" button on phones). Everything saves automatically, but customers keep seeing the original ordering page until the "Published" switch is turned on, and it can be switched off again at any time. The tab also lets the manager claim a short web address (for example /r/my-restaurant) to share on social media or print on menus; the original long link keeps working. Orders can't be sent from the preview. In the Menu editor, each dish has an "On your website" section: labels (Popular, New, Spicy, Vegetarian, Chef's pick) and a "Show in the Popular row" checkbox. Dish photos and the short description are what the website shows on each menu card. The website look also applies to table QR menus once published.
- **Receipts**: order history, filterable by Month, by a single Day, or by a custom Range — the same Month/Day/Range toggle and date picker(s) as the Dashboard. Cancel (restores stock, use when an order never went out) and Refund (stock stays deducted, use when it was already served; the time is recorded) both open a window asking HOW the money goes back to the customer — it defaults to the way the order was paid (for a split payment, as paid) and can be changed to cash, Visa, InstaPay or wallet; that choice is saved on the receipt and used in the cash drawer check (an unpaid pay-later order has nothing to return), since neither can be undone — Edit does not, since it can just be edited again. Editing lets you change each item's quantity (stock adjusts to match), add, change or remove the order's discount (no need to delete the order and make a new one — a discount that is added or changed needs a written reason, the total and the service/VAT recalculate right away, a "Total after this edit" line shows the new bill before you save, and the change is recorded in the edit history and in the cash-drawer explanation on Close the day if the order was already paid), and also change the payment method — useful for fixing a mis-recorded one after the fact; picking a method there replaces a split-payment breakdown with that single method. Every change is logged with who made it, when, and the reason if one was given — viewable via "View edit history" (manager-only). Mark fulfillment status (Preparing/Out for delivery) to trigger a WhatsApp update to the customer if they left a phone number — this opens WhatsApp with the message ready and still needs one tap of Send there, WhatsApp itself never allows sending on someone's behalf automatically.
- **Expenses** (manager-only): log business expenses with a supplier, category, and paid/unpaid status, see totals, outstanding payables, and a by-category breakdown. Like the Dashboard and Receipts, it can be filtered by Month (a month dropdown), a single Day (a calendar), or a custom Range (any start and end date) using the toggle at the top; the totals, payables and category breakdown follow the chosen period.
- **Dashboard** (manager-only): revenue, orders, average order value, an explicit Expenses figure for the period, net profit (revenue minus that expenses figure, with a hint spelling out the subtraction), discounts given, a revenue trend chart, items sold (a category dropdown on that card narrows it to one menu category and lists every dish in it with how many were sold in the period, including dishes that sold none), payment-method mix, and order source — all filterable by Month (a month and a year dropdown), by a single Day (a calendar that opens from the date button), or by a custom Range (any start and end date, e.g. "last 10 days" or a specific week) using the toggle and date picker(s) at the top, so it isn't locked to "this month." Which calendar day an order counts toward follows the Shift hours set in Settings — an order placed after midnight but before the next shift's configured start still counts toward the day that shift began, so a 6pm–2am shift never gets split across two days here.
- **Customers**: anyone whose phone number was entered at checkout is saved here automatically, with order history. Managers also see "Import from Excel" and "Export to Excel" buttons on this screen: Export downloads every customer (name, phone, address, number of orders, last order date) as an Excel file; Import takes an .xlsx or .csv sheet with a phone column (name and address optional, columns in any order, English or Arabic headings), shows a preview of who will be added or updated, and only saves after you confirm — customers are matched by phone number (+20, 0 and spacing differences don't matter), a blank cell never erases stored details, order counts are kept, nothing is ever deleted, and a template can be downloaded from the import window.
- **Shift**: shows the currently clocked-in employee's personal stats (hours worked, their orders, their revenue) plus register-wide totals for the day, including how many orders had a discount and the total discount amount, and — if any expenses were logged since clock-in — how many and their total, subtracted from net sales into a clearly-labeled "Net after expenses" line so it's obvious that figure already accounts for spending, not just sales. Every shift starts and ends with a cash count: signing in (clocking in) first asks you to count the drawer and type the total — you can't start without it — and "Clock out" asks for the closing count the same way (you can't clock out without it), then ends the shift and shows a recap with what was expected, what was counted and the difference. Each shift's opening count, closing count and difference are saved and shown in the Staff tab's shift list, with a warning if a shift opened with a different amount than the previous shift counted at closing. Every employee (not just managers) also sees: a cash reconciliation panel (opening float, cash sales, expected vs. counted cash, variance; the expected cash only subtracts cash expenses recorded during this shift — ones a previous shift already took out of the drawer are not subtracted again), a Visa/InstaPay/wallet reconciliation panel (expected vs. confirmed-on-statement per method, with variance), and — if delivery riders are tracked — a per-rider delivery cash reconciliation panel showing each rider's cash collected, delivery fees kept, what's owed, the list of delivery addresses they went to that shift, and a "Settle up" button. "Print shift report" / "Download" produce one combined report covering all of the above sections together, expenses included.
- **Close the day** (open to every employee, whatever their role; comes with Shift tracking): pick a business day and see, in one place, how it went (revenue, orders, payment methods, discounts, cancellations/refunds, expenses, net), then the cash drawer shift by shift — what each shift opened with (its counted opening), cash received, cash paid out (cash handed back to customers + cash expenses), what the drawer SHOULD hold, what was counted at closing, and the gap — with the whole-day total. Below that, "Why there is a gap" explains each gap in plain words, with who/when/how much: it lists the recorded events that could be behind it (an order whose payment method was changed after it was paid, dishes removed or added after payment, a cancelled order with no recorded return, a cash expense dated that day but outside every shift) and finds the combination that adds up to the gap, saying "together these explain the whole gap" or how much is still unexplained. If the gap only appeared after the shift was closed it says so and what changed. For cash that moved between one shift's closing count and the next shift's opening count it works out what the drawer should have held from the cash received and paid out in between (including orders taken while nobody had a shift). The whole-day row covers every cash movement. At the bottom anyone can press "Close the day" to sign the day off: it saves the figures as the day's record (a note explaining the gap is required when there is a cash gap), and later the screen shows anything that changed since closing; Print and Download give a report. "Also check" lists orders taken outside any shift, unpaid orders, shifts still open, auto-closed shifts and shifts without a cash count. Below the drawer table there is a "Cash collected at the end of the day" box: type the cash taken out of the drawer at the end of that business day (for restaurants that collect the day's cash around the last count). The last shift's drawer is then checked as should be − collected = counted, so a real shortage shows up and a correct collection shows as matching; until an amount is typed, a last-shift difference is shown as an "≈ collection" in blue (not a shortage) and does not need a note to close the day. Each day is checked on its own — the next day's first count is never compared with the previous day's.
- **Staff**: manage the employee roster (name + 4-digit PIN). An employee can only ever edit their OWN PIN, not a colleague's. Also shows a 30-day revenue leaderboard, an "Open shifts right now" list (managers only — everyone currently clocked in on any device, with orders/revenue so far), and shift history. Shift numbers in this list are always worked out from the current orders (so an order edited or a pay-later bill that grew after clock-out is reflected) and show the payment-method split; a shift nobody clocked out of is closed automatically the next time that person signs in, and marked "auto-closed". Managers also get a "Day check" card: pick a business day and see every completed order grouped by the shift it was rung up in — plus a "Not in any logged shift" row for orders taken while the person had no shift in the log — adding up to exactly the Dashboard's revenue for that day. Managers can tap any past shift, or any currently open shift, to see its full detail: orders completed, net sales, payment-method breakdown, and every ticket from that shift — reconstructed live from receipts rather than the few numbers stored in the shift log. For a shift that's still in progress, the detail view is marked "Live now" and keeps refreshing every few seconds so a manager can watch that employee's sales come in in real time.
- **Settings**: a "Print automatically after saving an order" choice (per device): Nothing (default), Customer receipt (with prices), Kitchen ticket (dishes, quantities and notes — no prices) or Both; it prints the moment an order is saved on that device. Right below it, "Where the kitchen ticket prints" has three options: "Print on this device" (the kitchen ticket prints here); "Send to the kitchen printer" (the ticket is sent to the device set as the kitchen printer — for phones, tablets and tills that have no printer); and "This device is the kitchen printer" (connect the kitchen printer to this device and keep the app open and awake — it prints every ticket saved on any device within about 10 seconds, shows the recent tickets with a "Print again" button, and has a test-ticket button). A kitchen ticket shows the table or takeaway, ticket number, time, each dish with its quantity and notes, delivery/pickup, and no prices; adding items to an existing unpaid invoice prints a ticket with only the added items, marked as an addition. Browsers always show a print window unless the computer's Chrome/Edge is started with the --kiosk-printing option and the kitchen printer is the default printer; phones and tablets always show their own print window. Also: a "New order sound" switch (per device) that plays a chime whenever a new customer or call center order arrives for review, with a "Play test sound" button — the browser only allows sound after someone has tapped or clicked on the page once. Also: restaurant name, logo, primary/secondary brand colors, a phone number, and a light/dark theme toggle for the staff app's own display (the customer-facing menu is unaffected) — these apply across the whole app and printed receipts. The phone number adds a "Call us" button to the online-ordering page (next to "Get directions", if a location is also set) so customers can call directly. Shift hours lets you set each weekday's shift start and end time (choose the hour and the minute from the two dropdowns next to each day) — this only affects which calendar day the Dashboard reports an order under (see Dashboard above); it doesn't restrict when staff can actually take orders. If VAT/service charge is included in this restaurant's package, it's also set here (a percentage each, applied automatically to every order — set either to 0 to turn it off). The delivery fee retention mode (percentage vs. fixed amount kept by the restaurant) is also set here. Also the EN/AR language toggle in the header.

## How the money numbers fit together
Every money figure — Dashboard, Receipts, Shift, Staff, Close the day, Expenses — is worked out by the same single calculation from the saved orders, expenses and shifts, so tabs only differ when they answer different questions. The rules: an order counts as a sale when it is completed (an unpaid pay-later bill still counts, and is listed separately; cancelled and refunded orders are not sales). A sale belongs to the business day it was created in (the Shift hours in Settings decide where a day starts). Cash enters the drawer when it is paid (delivery cash when the rider settles — only what the rider actually hands over: the cash collected minus the rider's share of the delivery fees, which is saved when you press Settle up; if the restaurant owes the rider instead, that payout leaves the drawer, and it shows on Close the day and the Shift tab as "Rider pay at delivery settlement") and leaves it when an order is returned or a cash expense is recorded — a cash expense reduces the drawer of the shift it was recorded in. A shift belongs to the business day most of it falls in. Orders created while nobody was clocked in are shown as "not inside any shift". Cash handed from one shift to the next is compared only within the same business day: cash is often collected when a day ends, so the first shift of a day is never compared with the last shift of the day before. Totals saved at clock-out are only a record; screens always recompute from the orders. All screens re-check the server about every 15 seconds, so after a short moment every terminal shows the same figures; if two screens differ for more than a minute, reloading the page forces a fresh read. The Staff tab leaderboard adds up every order each person created in the last 30 days, the same orders the Dashboard counts.
## How staff log in
The app requires signing in with a name + 4-digit PIN before anything else is usable (a login/PIN-pad screen). First-time setup lets someone add themselves. IMPORTANT: PINs here are for quick identification at a shared terminal, not real security — there's no encryption. If someone can't log in, check they're using the right PIN via a manager in the Staff tab (any logged-in staff member can edit their own PIN there).

After a manager's PIN is accepted, they're asked "Clock in for a shift" or "Just view — no shift" (regular staff skip this and clock in directly, since orders need someone actually on shift to attribute to). "Just view" signs them in normally — they see everything a manager normally sees — but starts no shift: it never appears in shift stats, the shift log, or cash/electronic reconciliation, and their exit button just says "Exit" instead of "Clock out" (no shift to end, no confirmation). This is for a manager checking the system remotely (e.g., from their phone) without it looking like they worked a shift. Which employee is signed in (and whether that's a real shift or just-viewing) is stored per-device/browser, not shared — logging in as different people on different devices at the same time already works with no need to clock anyone out first. To help exactly this kind of remote check-in, the Staff tab has an "Open shifts right now" section (managers only) listing everyone currently clocked in on any device, with when they started and their orders/revenue so far — a viewing manager doesn't need to be on shift themselves to see it.

## QR code table ordering and the online-ordering link
Each table's QR code, and the general online-ordering link, land on the same customer-facing menu with a table ID (or no table ID, for the general link) in the URL, showing customers a live, view-only menu (items, descriptions, prices — no stock/availability details, by design, for customer privacy) where they can add items and send an order. That order does NOT go straight to the kitchen — it shows up as a "pending order" for staff to review in the Tables view (a badge appears, plus a pill in the header) and must be explicitly Confirmed (which merges it into that table's ticket) or Rejected. This is intentional so staff always have final say before anything hits the kitchen. Once staff taps Confirm, the customer's own device — if that page is still open — automatically shows a "Your order was confirmed and is being prepared!" banner within a few seconds, with no action needed from the customer. Rejecting an order does NOT notify the customer automatically — staff need to let them know some other way.

## Known limitations — mention these proactively if relevant
- **Printing and QR codes only fully work once this app is deployed to a real, published URL.** If someone is testing inside Claude's chat preview, "Print receipt" and the QR code links won't function — use the "Download" button instead (downloads a receipt/flyer file they can open and print manually), and know that QR codes will start working once the app is actually deployed/published somewhere with a real public URL.
- **Offline behavior**: the staff app keeps working through a lost connection — orders, menu edits, stock changes all still work and are queued to sync automatically once back online (shown via a "changes waiting to sync" indicator in the header). However, nothing survives closing the tab or refreshing while offline. Customer QR ordering is deliberately blocked while offline (no queueing) so no order can exist that the restaurant never sees.
- **Ticket numbers** are simple ascending numbers (1, 2, 3...) that restart when the business day starts (the shift start set in Settings > Shift hours, e.g. 08:00 — not at midnight), shared across every terminal.
- **Split bill** divides the total evenly and rounds to the cent for display — with an odd total split many ways, the per-person amounts may not add up to the exact total to the last cent.
- If someone describes a bug or something not behaving as expected that ISN'T explained by the above, say so plainly rather than guessing, and suggest they double check with whoever manages/built their system.

Never invent features that don't exist in this list. If you're not sure whether something is possible, say so rather than making it up.`;
};

const INITIAL_INGREDIENTS = {
  ing_lamb: { id: "ing_lamb", name: "Lamb rack", unit: "kg", stock: 2 },
  ing_potato: { id: "ing_potato", name: "Potatoes", unit: "kg", stock: 5 },
  ing_halibut: { id: "ing_halibut", name: "Halibut fillet", unit: "kg", stock: 0 },
  ing_butter: { id: "ing_butter", name: "Butter", unit: "kg", stock: 1 },
  ing_mushroom: { id: "ing_mushroom", name: "Wild mushrooms", unit: "kg", stock: 3 },
  ing_arborio: { id: "ing_arborio", name: "Arborio rice", unit: "kg", stock: 4 },
  ing_parmesan: { id: "ing_parmesan", name: "Parmesan", unit: "kg", stock: 1 },
  ing_sirloin: { id: "ing_sirloin", name: "Beef sirloin", unit: "kg", stock: 2 },
  ing_octopus: { id: "ing_octopus", name: "Octopus", unit: "kg", stock: 2 },
  ing_lemon: { id: "ing_lemon", name: "Lemons", unit: "pcs", stock: 15 },
  ing_burrata: { id: "ing_burrata", name: "Burrata", unit: "kg", stock: 1 },
  ing_fig: { id: "ing_fig", name: "Figs", unit: "pcs", stock: 8 },
  ing_tuna: { id: "ing_tuna", name: "Tuna", unit: "kg", stock: 2 },
  ing_vegstock: { id: "ing_vegstock", name: "Vegetable stock", unit: "L", stock: 0 },
  ing_redwine: { id: "ing_redwine", name: "House red wine", unit: "bottle", stock: 10 },
  ing_tea: { id: "ing_tea", name: "Tea leaves", unit: "L", stock: 4 },
  ing_espresso: { id: "ing_espresso", name: "Espresso beans", unit: "kg", stock: 0.06 },
  ing_water: { id: "ing_water", name: "Sparkling water", unit: "bottle", stock: 20 },
  ing_choc: { id: "ing_choc", name: "Dark chocolate", unit: "kg", stock: 0 },
  ing_cheesecake: { id: "ing_cheesecake", name: "Cheesecake batter", unit: "kg", stock: 3 },
  ing_icecream: { id: "ing_icecream", name: "Vanilla ice cream", unit: "L", stock: 2 },
};

const INITIAL_MENU = {
  Starters: [
    { id: "s1", name: "Charred Octopus", tag: "smoked paprika, lemon", price: 16, recipe: [{ ingredientId: "ing_octopus", qty: 0.3 }, { ingredientId: "ing_lemon", qty: 1 }] },
    { id: "s2", name: "Burrata & Fig", tag: "aged balsamic, basil", price: 14, recipe: [{ ingredientId: "ing_burrata", qty: 0.2 }, { ingredientId: "ing_fig", qty: 2 }] },
    { id: "s3", name: "Soup of the Day", tag: "ask your server", price: 9, recipe: [{ ingredientId: "ing_vegstock", qty: 0.3 }] },
    { id: "s4", name: "Tuna Crudo", tag: "yuzu, chili oil", price: 18, recipe: [{ ingredientId: "ing_tuna", qty: 0.15 }, { ingredientId: "ing_lemon", qty: 1 }] },
  ],
  Mains: [
    { id: "m1", name: "Roast Lamb Rack", tag: "rosemary jus, potato", price: 34, recipe: [{ ingredientId: "ing_lamb", qty: 0.4 }, { ingredientId: "ing_potato", qty: 0.3 }] },
    { id: "m2", name: "Pan-Seared Halibut", tag: "brown butter, capers", price: 29, recipe: [{ ingredientId: "ing_halibut", qty: 0.3 }, { ingredientId: "ing_butter", qty: 0.05 }] },
    { id: "m3", name: "Wild Mushroom Risotto", tag: "parmesan, truffle", price: 24, recipe: [{ ingredientId: "ing_mushroom", qty: 0.2 }, { ingredientId: "ing_arborio", qty: 0.15 }, { ingredientId: "ing_parmesan", qty: 0.05 }] },
    { id: "m4", name: "Dry-Aged Sirloin", tag: "10oz, peppercorn", price: 38, recipe: [{ ingredientId: "ing_sirloin", qty: 0.35 }] },
  ],
  Drinks: [
    { id: "d1", name: "House Red", tag: "glass", price: 12, recipe: [{ ingredientId: "ing_redwine", qty: 0.2 }] },
    { id: "d2", name: "Iced Tea", tag: "unsweet, mint", price: 5, recipe: [{ ingredientId: "ing_tea", qty: 0.25 }] },
    { id: "d3", name: "Espresso Martini", tag: "cold brew, vodka", price: 14, recipe: [{ ingredientId: "ing_espresso", qty: 0.02 }] },
    { id: "d4", name: "Sparkling Water", tag: "bottle", price: 6, recipe: [{ ingredientId: "ing_water", qty: 1 }] },
  ],
  Desserts: [
    { id: "p1", name: "Basque Cheesecake", tag: "burnt honey", price: 11, recipe: [{ ingredientId: "ing_cheesecake", qty: 0.2 }] },
    { id: "p2", name: "Dark Chocolate Tart", tag: "sea salt, hazelnut", price: 12, recipe: [{ ingredientId: "ing_choc", qty: 0.15 }] },
    { id: "p3", name: "Affogato", tag: "vanilla, espresso", price: 8, recipe: [{ ingredientId: "ing_icecream", qty: 0.1 }, { ingredientId: "ing_espresso", qty: 0.02 }] },
  ],
};

function initials(name) {
  return name
    .split(" ")
    .filter((w) => w[0] === w[0]?.toUpperCase())
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

// Downscales an uploaded photo client-side before it's stored — a restaurant menu can have
// well over a hundred items, so storing full-resolution photos per item would balloon the
// synced menu payload. A small square thumbnail is all any of the surfaces that show it
// (order screen cards, the menu editor, the customer-facing menu) actually need.
// Some systems hand a PNG over with an empty MIME type, so the file name counts too.
const looksLikeImage = (file) => !!file && ((file.type || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || ""));

// Opens any picture the browser can decode (PNG, JPG, WEBP, GIF…), upright as the camera intended, and
// hands back something drawable plus a close() to release it. A big PNG screenshot is decoded straight from
// the file rather than first being turned into a multi-megabyte text string.
const openImageFile = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close && bmp.close() };
    } catch (e) {
      // fall through to the <img> route below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
};
// Scales to fit maxDim and encodes as JPEG on a white ground, so a transparent PNG doesn't turn black.
const drawAsJpegDataUrl = (opened, maxDim, quality) => {
  const scale = Math.min(1, maxDim / Math.max(opened.width, opened.height));
  const w = Math.max(1, Math.round(opened.width * scale));
  const h = Math.max(1, Math.round(opened.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(opened.source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
};
const resizeImageToDataUrl = async (file, maxDim = 240, quality = 0.72) => {
  const opened = await openImageFile(file);
  try {
    return drawAsJpegDataUrl(opened, maxDim, quality);
  } finally {
    opened.close();
  }
};
// A menu photo has to stay readable (small print), but must also fit the host's request-size limit (4.5 MB):
// a full-size PNG screenshot is far bigger than that, so it is shrunk to a sharp JPEG that is.
const MENU_SCAN_MAX_CHARS = 3_400_000;
const prepareMenuScanImage = async (file) => {
  const opened = await openImageFile(file);
  try {
    let dim = 2200;
    let quality = 0.88;
    let out = "";
    for (let i = 0; i < 6; i++) {
      out = drawAsJpegDataUrl(opened, dim, quality);
      if (out.length <= MENU_SCAN_MAX_CHARS) break;
      dim = Math.round(dim * 0.8);
      quality = Math.max(0.7, quality - 0.04);
    }
    return out;
  } finally {
    opened.close();
  }
};

// Shown wherever a menu item appears — a real uploaded photo if there is one, otherwise the
// item's initials as a placeholder. No access to per-tenant brand colors here (this renders in
// both the staff terminal and the customer-facing menu), so it sticks to fixed, theme-independent
// tones.
function MenuThumb({ item, size = 34 }) {
  const base = { width: size, height: size, borderRadius: 8, flexShrink: 0 };
  if (item.image) {
    return <img src={item.image} alt="" style={{ ...base, objectFit: "cover" }} />;
  }
  return (
    <div style={{ ...base, background: "#3A2A2D", color: "#D8C39A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}>
      {initials(item.name)}
    </div>
  );
}

const money = (n) => `${n.toFixed(2)} EGP`;
const fmtQty = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
// Stock of a counted unit can be part of a piece (a recipe used half): shown as ½, 7¼ … ; weights keep two decimals.
const fmtStock = (n, unit) => (isCountUnit(unit) && !Number.isInteger(n) ? fmtRecipeQty(n, unit) : fmtQty(n));

// Business-day shift hours (Settings > Shift hours) — lets a restaurant say "our shift runs
// 6pm-2am" so a 1am order still counts toward the day the shift started, instead of rolling onto
// the calendar date that began at real midnight. Every weekday defaults to a 00:00 start, under
// which the business date always equals the real calendar date — restaurants that never touch this
// setting see no change in their numbers at all.
// "Today" and "this month" as the person at the terminal sees them. Using the UTC date here (as the
// pickers used to) is a day behind for the first hours after local midnight (UTC+2/+3), which made
// today's date unselectable right when late-night shifts were being reviewed.
const todayLocalStr = () => localDateStr(new Date());
const monthLocalKey = () => todayLocalStr().slice(0, 7);
const formatShortDate = (dateStr, isRtl) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" });
// A full 6-week (42-day) grid for the given "YYYY-MM" month, starting on the Sunday on/before the
// 1st — enough to always fully cover the month regardless of which weekday it starts on.
const monthGridDays = (viewMonthKey) => {
  const [y, m] = viewMonthKey.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstOfMonth.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return { dateStr: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1 };
  });
};

// Pickers built only from buttons and <select>s, which behave the same on every phone, tablet and
// desktop browser — unlike the native date/month/time inputs, which are picker-only on some devices,
// type-only on others, and look different on each.

// One day, picked from the same calendar the custom-range filter uses.
function DayPickerButton({ value, maxDate, isRtl, theme, onChange }) {
  const [open, setOpen] = useState(false);
  const locale = isRtl ? "ar-EG" : "en-US";
  const label = new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="field" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
        📅 {label}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setOpen(false)}>
            <DateRangeCalendar
              startDate={value}
              endDate={value}
              maxDate={maxDate}
              isRtl={isRtl}
              theme={theme}
              onPickDay={(d) => {
                onChange(d);
                setOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// A month and a year, as two dropdowns. Months after `maxMonth` can't be chosen.
function MonthSelects({ value, maxMonth, isRtl, onChange }) {
  const locale = isRtl ? "ar-EG" : "en-US";
  const [y, m] = value.split("-").map(Number);
  const [maxY, maxM] = maxMonth.split("-").map(Number);
  const firstYear = Math.min(maxY - 5, y);
  const years = Array.from({ length: Math.max(maxY, y) - firstYear + 1 }, (_, i) => firstYear + i);
  const monthName = (mo) => new Date(Date.UTC(2023, mo - 1, 1)).toLocaleDateString(locale, { month: "long", timeZone: "UTC" });
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select value={m} onChange={(e) => onChange(`${y}-${pad(Number(e.target.value))}`)} className="field">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
          <option key={mo} value={mo} disabled={y === maxY && mo > maxM}>{monthName(mo)}</option>
        ))}
      </select>
      <select
        value={y}
        onChange={(e) => {
          const ny = Number(e.target.value);
          onChange(`${ny}-${pad(ny === maxY && m > maxM ? maxM : m)}`);
        }}
        className="field"
      >
        {years.map((yr) => (
          <option key={yr} value={yr}>{yr}</option>
        ))}
      </select>
    </div>
  );
}

// A time of day as an hour dropdown and a minute dropdown (24-hour, minutes in steps of 5 — plus
// whatever minute is currently saved, so an existing value like 23:59 still shows correctly).
function TimeSelects({ value, onCommit }) {
  const [h, mi] = (value || "00:00").split(":");
  const pad = (n) => String(n).padStart(2, "0");
  // 59 is always offered because 23:59 is the standard "end of day"; the saved minute is added too
  // if it's something else, so what's stored is always shown.
  const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  if (!minutes.includes("59")) minutes.push("59");
  if (!minutes.includes(mi)) minutes.push(mi);
  minutes.sort();
  const commit = (hh, mm) => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(`${hh}:${mm}`)) onCommit(`${hh}:${mm}`);
  };
  return (
    <div dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <select value={h} onChange={(e) => commit(e.target.value, mi)} className="field" style={{ padding: "9px 8px" }}>
        {Array.from({ length: 24 }, (_, i) => pad(i)).map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span style={{ fontWeight: 600 }}>:</span>
      <select value={mi} onChange={(e) => commit(h, e.target.value)} className="field" style={{ padding: "9px 8px" }}>
        {minutes.map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
    </div>
  );
}

// A small popover calendar for picking a start/end day pair — used by the dashboard's custom
// range filter instead of two separate native date inputs, which are fiddlier to use for picking
// two related dates. Purely a rendering+navigation component: the actual start/end state and the
// "which end am I picking next" logic live in the parent (POSPrototype), passed in via props, so
// this can stay a plain controlled component without its own copy of the selection to keep in sync.
function DateRangeCalendar({ startDate, endDate, maxDate, isRtl, theme, onPickDay }) {
  const [viewMonth, setViewMonth] = useState(endDate.slice(0, 7));
  const locale = isRtl ? "ar-EG" : "en-US";
  const monthLabel = new Date(`${viewMonth}-01T00:00:00Z`).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  // Jan 1 2023 was a Sunday — an arbitrary known Sunday to read weekday names off of, in order.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" }));
  const atMaxMonth = viewMonth >= maxDate.slice(0, 7);
  const shiftMonth = (delta) => {
    const [y, m] = viewMonth.split("-").map(Number);
    setViewMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
  };
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFFFFF", border: "1px solid #D8D0BE", borderRadius: 10, padding: 14, width: "min(300px, 100%)", boxSizing: "border-box", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => shiftMonth(-1)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 15, padding: 4 }}>{isRtl ? "›" : "‹"}</button>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111" }}>{monthLabel}</div>
        <button type="button" onClick={() => !atMaxMonth && shiftMonth(1)} disabled={atMaxMonth} style={{ background: "none", border: "none", color: atMaxMonth ? "#C9C4B8" : "#555", cursor: atMaxMonth ? "default" : "pointer", fontSize: 15, padding: 4 }}>{isRtl ? "‹" : "›"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {weekdayLabels.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9.5, color: "#8A8578", fontWeight: 600 }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {monthGridDays(viewMonth).map((c) => {
          const disabled = c.dateStr > maxDate;
          const inRange = c.dateStr >= startDate && c.dateStr <= endDate;
          const isEdge = c.dateStr === startDate || c.dateStr === endDate;
          return (
            <button
              type="button"
              key={c.dateStr}
              onClick={() => !disabled && onPickDay(c.dateStr)}
              disabled={disabled}
              style={{
                aspectRatio: "1",
                border: "none",
                borderRadius: isEdge ? 999 : 6,
                background: isEdge ? theme.primary : inRange ? "rgba(176,141,87,0.22)" : "transparent",
                color: disabled ? "#C9C4B8" : isEdge ? "#FBF8F2" : !c.inMonth ? "#B8B2A2" : "#222",
                fontSize: 11.5,
                fontWeight: isEdge ? 700 : 400,
                cursor: disabled ? "default" : "pointer",
                fontFamily: "IBM Plex Mono, monospace",
              }}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Blends a hex color toward white by `amount` (0-1) — used to derive a lighter tint of the
// secondary/brand color for badges and highlights, the way the original design derived
// "brassLight" from "brass".
const lighten = (hex, amount) => {
  const clean = (hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
};

// Turns whatever a restaurant owner pasted into the "Location" field into a clickable link that
// opens Google Maps and starts directions there. Accepts either a real Google Maps link (e.g.
// copied from that app/site's own Share button — used as-is, since it already points at the
// right pin) or a plain address (wrapped in Google's documented no-API-key-required directions
// URL scheme, which opens turn-by-turn navigation to that destination). Returns null if nothing
// or only whitespace was ever set, so callers can cleanly hide the button.
const buildMapsHref = (mapsLink) => {
  const trimmed = (mapsLink || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;
};

// Wraps receipt body markup in a small standalone printable document (shared by both the
// on-page print path and the downloadable file below).
const receiptDocument = (title, bodyHtml, autoPrint, rtl) => `<!DOCTYPE html>
<html dir="${rtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 12px; }
      * { box-sizing: border-box; }
      body { font-family: ${rtl ? "'Tajawal', 'Courier New', Courier, monospace" : "'Courier New', Courier, monospace"}; color: #000; width: 300px; margin: 0 auto; padding: 16px; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; }
      .dashed { border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; }
      ${rtl ? "@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');" : ""}
    </style>
    ${autoPrint ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 150); });</script>` : ""}
  </head>
  <body>${bodyHtml}</body>
</html>`;

// Prints via a hidden same-page <iframe>. This works once the app is deployed as a normal
// (unsandboxed) page. It will NOT work inside a sandboxed preview frame (e.g. this chat's
// preview panel) — browsers block the print dialog there at the sandbox level, and no JS
// workaround can override that from inside it. Use downloadReceiptFile below for previewing.
const printViaHiddenFrame = (title, bodyHtml, rtl) => {
  const html = receiptDocument(title, bodyHtml, false, rtl);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error("Print failed:", e);
    }
    try {
      iframe.contentWindow.addEventListener("afterprint", cleanup);
    } catch (e) {
      // ignore
    }
    setTimeout(cleanup, 60000);
  };
  iframe.onload = () => setTimeout(doPrint, 50);
  iframe.srcdoc = html;
};

// Downloads the receipt as a standalone .html file. Downloads are generally permitted even in
// sandboxed preview frames that block print dialogs and pop-ups, so this works right now in
// preview. The file auto-triggers the print dialog the moment it's opened (it runs as a normal,
// unsandboxed page once downloaded) — if that doesn't fire, Ctrl/Cmd+P works from the open file.
const downloadReceiptFile = (title, bodyHtml, rtl) => {
  const html = receiptDocument(title, bodyHtml, true, rtl);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const filename = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}.html`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};

// Units grouped by measurement type — prevents mixing e.g. weight units with count units by mistake
const UNIT_GROUPS = [
  { label: "Weight", units: ["g", "kg"] },
  { label: "Volume", units: ["ml", "L"] },
  { label: "Count", units: ["pcs", "dozen", "bottle", "can", "box", "pack", "slice", "portion"] },
];
const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.units);
// Fine-grained units need small steps; whole-count units step by 1
const FINE_UNITS = ["g", "kg", "ml", "L"];
const stepFor = (unit) => (FINE_UNITS.includes(unit) ? 0.1 : 1);
const restockAmountFor = (unit) => (FINE_UNITS.includes(unit) ? 1 : 10);


function POSPrototype({ tenantId }) {
  const storage = useMemo(() => createTenantStorage(tenantId), [tenantId]);
  const [bootCache] = useState(() => readBoot(tenantId));
  const [tenantStatus, setTenantStatus] = useState(null); // { status, paid_until, days_remaining, restaurant_name } | null while loading
  const [renewalNoticeDismissed, setRenewalNoticeDismissed] = useState(false);
  const [view, setView] = useState("order"); // "order" | "menu" | "stock" | "receipts" | "customers" | "shift"
  const [active, setActive] = useState("Mains");
  // Empty until the real menu is read. The starter menu below is only used for a restaurant the
  // server confirms has never saved one, so no restaurant ever sees placeholder dishes while loading.
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState({});
  const [ingredients, setIngredients] = useState({});
  const [mainCategories, setMainCategories] = useState([]); // [{id, name, subs: [categoryName,...]}] — groups of the categories above (see src/menu/mainCategories.js)
  const [activeMain, setActiveMain] = useState(null); // the main category tab selected on the Order screen
  const [newMainName, setNewMainName] = useState("");
  const [menuLoaded, setMenuLoaded] = useState(false);
  // Couldn't reach the real menu/ingredients on this device (e.g. offline at startup) — distinct
  // from "genuinely never set up yet". Critical: menuLoaded still flips true either way so the UI
  // isn't stuck, but the auto-persist effect below must NOT write while this is true, or a single
  // failed read would save the built-in placeholder starter menu over the tenant's real one.
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);
  const menuLoadFailedRef = useRef(false);

  // Alternate price lists — each one mirrors the base menu (same items, same recipes/stock
  // consumption) but can override individual items' prices and add its own extra items on top.
  // A duty-roster-style light record, not a fork: an item with no override here still tracks the
  // base menu's price automatically, so editing the base item's price/recipe/photo is reflected
  // everywhere without having to touch every profile.
  const [menuProfiles, setMenuProfiles] = useState([]); // [{id, name, priceOverrides: {itemId: price}, extraItems: {category: [item,...]}, extraCategories: [name,...] (categories that exist only in this list), hiddenItems: [itemId,...] (main-menu dishes removed from this list)}]
  const [profileCategoryDraft, setProfileCategoryDraft] = useState({}); // { [profileId]: text typed in "new category for this list" }
  const [menuProfilesLoaded, setMenuProfilesLoaded] = useState(false);
  // Same "don't let a failed read fall through to the placeholder default and get auto-saved over
  // real data" protection as menuLoadFailed above — see that comment. Applies to every config below
  // that's auto-persisted on any change rather than only on an explicit save action.
  const [menuProfilesLoadFailed, setMenuProfilesLoadFailed] = useState(false);
  const menuProfilesLoadFailedRef = useRef(false);
  const [activeMenuProfile, setActiveMenuProfile] = useState(null); // profile id currently governing the order screen's prices, or null for the base menu
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileSource, setNewProfileSource] = useState(""); // "" = start empty, "main" = copy the main menu's prices, or the id of a price list to copy
  const [managingProfileId, setManagingProfileId] = useState(null); // which profile's price-management panel is expanded, if any

  const [tableCount, setTableCount] = useState(12);
  const [tableNames, setTableNames] = useState({});
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const [tablesLoadFailed, setTablesLoadFailed] = useState(false);
  const tablesLoadFailedRef = useRef(false);
  const [activeTableId, setActiveTableId] = useState(null); // null = Takeaway/Delivery
  const [tableDrafts, setTableDrafts] = useState({}); // in-session only — per-table in-progress carts
  const [qrTableId, setQrTableId] = useState(null); // which table's QR modal is open, if any
  const [storeLinkCopied, setStoreLinkCopied] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]); // orders submitted by customers via QR, awaiting staff review
  const [pendingOrdersLoaded, setPendingOrdersLoaded] = useState(false);
  const [reviewTableId, setReviewTableId] = useState(undefined); // which table's pending-orders review modal is open — undefined = closed, null = reviewing Takeaway, "delivery" = reviewing Delivery, else a table id
  const [cart, setCart] = useState([]);
  const [editingNoteLineId, setEditingNoteLineId] = useState(null); // which cart line's note input is open, if any
  const [ticketNo, setTicketNo] = useState(null); // null until ensureTicketNo() actually assigns one — see blankDraft's comment
  const ticketCounterRef = useRef({ date: null, next: 1 }); // { date: "YYYY-MM-DD", next: number } — resets each BUSINESS day (see Settings > Shift hours), shared across every terminal
  const shiftHoursRef = useRef(DEFAULT_SHIFT_HOURS);
  const [ticketCounterLoaded, setTicketCounterLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false); // guards saveOrder against a fast double-click/tap re-submitting the same cart as two orders
  const [confirmingTablePayment, setConfirmingTablePayment] = useState(false); // same guard as savingOrder, for confirmTablePayment's own button
  const [addToInvoiceOpen, setAddToInvoiceOpen] = useState(false); // picker for merging the current cart into an already-saved unpaid invoice
  const [mergingIntoInvoice, setMergingIntoInvoice] = useState(false);
  const [notice, setNotice] = useState(null);
  // Starts optimistic rather than trusting navigator.onLine's initial snapshot — that API is
  // notoriously unreliable inside embedded WebViews (e.g. the Claude mobile app's artifact
  // preview), sometimes reporting "offline" even with a perfectly good connection. The real
  // source of truth here is whether actual storage calls succeed or fail — see syncSet below,
  // which corrects this flag based on real outcomes rather than the OS-level flag.
  const [isOnline, setIsOnline] = useState(true);
  // Tracks viewport width so layout can adapt to phones/tablets — used the same way isRtl already
  // is throughout this file (JS-driven conditional inline styles), rather than introducing a
  // parallel CSS-media-query system that inline styles would just override anyway.
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1280));
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isMobile = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const isCompact = viewportWidth < 1024; // mobile or tablet — use for "should this stack/simplify" decisions
  const [syncQueue, setSyncQueue] = useState([]); // writes that failed (almost always because we're offline) and are waiting to retry
  const syncQueueRef = useRef([]);
  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidNow, setPaidNow] = useState(true); // false = "open tab" — order saved but payment not yet collected
  const [splitAmounts, setSplitAmounts] = useState({}); // {cash: "12.00", visa: "18.64", ...} — only used when paymentMethod === "split"
  const [discount, setDiscount] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountDraft, setDiscountDraft] = useState({ type: "percent", value: "", reason: "" });
  const [splitCount, setSplitCount] = useState(null); // null/1 = not split; any positive integer otherwise
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitDraft, setSplitDraft] = useState("");
  const [assignedTo, setAssignedTo] = useState(null); // {id, name, role: "waiter"|"delivery"} | null — who's handling this order, from dutyRoster
  const [deliveryFee, setDeliveryFee] = useState(0); // non-zero only when a confirmed order came from the online-ordering link with delivery selected
  const [deliveryMethod, setDeliveryMethod] = useState(null); // "pickup" | "delivery" | null (dine-in/table order)
  const [deliveryZoneLabel, setDeliveryZoneLabel] = useState(""); // display label of the chosen zone, snapshotted at order time

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderEta, setOrderEta] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customers, setCustomers] = useState({});
  const [customersLoaded, setCustomersLoaded] = useState(false);

  const [receiptsByMonth, setReceiptsByMonth] = useState({});
  // Live sync (see liveSyncTick): the version each stored copy was read at, when this device last wrote,
  // and the latest of the cached months so the timer always sees current keys.
  const dataVersionsRef = useRef({});
  const lastLocalWriteRef = useRef(0);
  const receiptsByMonthRef = useRef({});
  receiptsByMonthRef.current = receiptsByMonth;
  const [monthKeys, setMonthKeys] = useState([]);
  const [monthsLoaded, setMonthsLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  // Receipts tab's own Month/Day/Range toggle, mirroring the Dashboard's (see below) — separate
  // state so picking a period here doesn't also change what the Dashboard is showing.
  const [receiptsFilterMode, setReceiptsFilterMode] = useState("month"); // "month" | "day" | "range"
  const [receiptsFilterDay, setReceiptsFilterDay] = useState(null);
  const [receiptsFilterRangeStart, setReceiptsFilterRangeStart] = useState(null);
  const [riderReportId, setRiderReportId] = useState(null); // Delivery tab's per-employee report: which rider (null = the first one)
  const [riderReportFrom, setRiderReportFrom] = useState(null); // business-day range, YYYY-MM-DD; null = today
  const [riderReportTo, setRiderReportTo] = useState(null);
  const [receiptsFilterRangeEnd, setReceiptsFilterRangeEnd] = useState(null);
  const [receiptsRangePickerOpen, setReceiptsRangePickerOpen] = useState(false);
  const [receiptsRangePickingEnd, setReceiptsRangePickingEnd] = useState(false);

  // Dashboard's own period selector — deliberately separate from selectedMonth above (which
  // belongs to the Receipts tab) so picking a month to review receipts doesn't also change what
  // the dashboard is showing, and vice versa.
  const [dashboardMode, setDashboardMode] = useState("month"); // "month" | "day" | "range"
  const [dashboardMonth, setDashboardMonth] = useState(null); // "YYYY-MM", defaults to the current month once known
  const [dashboardDay, setDashboardDay] = useState(null); // "YYYY-MM-DD", defaults to today once known
  const [dashboardRangeStart, setDashboardRangeStart] = useState(null); // "YYYY-MM-DD", defaults to 7 days before the end
  const [dashboardRangeEnd, setDashboardRangeEnd] = useState(null); // "YYYY-MM-DD", defaults to today once known
  const [dashboardRangePickerOpen, setDashboardRangePickerOpen] = useState(false);
  const [dashboardCategory, setDashboardCategory] = useState(""); // menu category the "Items sold" card is narrowed to ("" = all)
  const [dashboardRangePickingEnd, setDashboardRangePickingEnd] = useState(false); // whether the next calendar click sets the end day (vs. starting a fresh range)
  const [shiftHoursConfig, setShiftHoursConfig] = useState(DEFAULT_SHIFT_HOURS);
  const [shiftHoursLoaded, setShiftHoursLoaded] = useState(false);
  shiftHoursRef.current = shiftHoursConfig; // always current for code that runs outside a render (see issueTicketNumber)
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editDraftItems, setEditDraftItems] = useState([]);
  const [editReason, setEditReason] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState(null);
  const [editDraftDiscount, setEditDraftDiscount] = useState({ type: "percent", value: "", reason: "" }); // the discount while a saved order is being edited
  const [restockAmounts, setRestockAmounts] = useState({}); // per-ingredient typed bulk-restock amount, keyed by ingredient id
  const [expandedHistoryId, setExpandedHistoryId] = useState(null); // receipt id whose edit-history panel is open, if any

  const [dutyRoster, setDutyRoster] = useState([]); // shared: [{id, name, role: "waiter"|"delivery"}] — non-login personnel orders can be assigned to
  const [dutyRosterLoaded, setDutyRosterLoaded] = useState(false);
  const [newDutyName, setNewDutyName] = useState("");
  const [newDutyRole, setNewDutyRole] = useState("waiter");
  const [expandedDutyId, setExpandedDutyId] = useState(null); // duty-roster id whose assigned-orders panel is open, if any

  const [suppliers, setSuppliers] = useState([]); // shared: [{id, name, category, phone}]
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [showSupplierManager, setShowSupplierManager] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCategory, setNewSupplierCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [deliveryZones, setDeliveryZones] = useState([]); // shared: [{id, label, fee}]
  const [deliveryZonesLoaded, setDeliveryZonesLoaded] = useState(false);
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("");
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editingZoneLabel, setEditingZoneLabel] = useState("");
  const [editingZoneFee, setEditingZoneFee] = useState("");

  const [expensesByMonth, setExpensesByMonth] = useState({}); // shared, monthly-keyed like receipts
  const expensesByMonthRef = useRef({});
  expensesByMonthRef.current = expensesByMonth;
  const [expenseMonthKeys, setExpenseMonthKeys] = useState([]);
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState(null);
  const [expenseFilterMode, setExpenseFilterMode] = useState("month"); // "month" | "day" | "range" — same toggle the Dashboard and Receipts have
  const [expenseFilterDay, setExpenseFilterDay] = useState(null);
  const [expenseFilterRangeStart, setExpenseFilterRangeStart] = useState(null);
  const [expenseFilterRangeEnd, setExpenseFilterRangeEnd] = useState(null);
  const [expenseRangePickerOpen, setExpenseRangePickerOpen] = useState(false);
  const [expenseRangePickingEnd, setExpenseRangePickingEnd] = useState(false);
  const [loadingExpenseMonth, setLoadingExpenseMonth] = useState(false);
  const [expenseEditor, setExpenseEditor] = useState(null); // draft object while adding/editing, or null when closed

  const [shiftStart, setShiftStart] = useState(null); // doubles as this device's clock-in time
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0"); // cash physically in the drawer at clock-in, for cash reconciliation
  const [countedCash, setCountedCash] = useState(""); // cash actually counted at close — entered fresh each time, never persisted
  const [confirmedElectronic, setConfirmedElectronic] = useState({}); // { [methodId]: "123.45" } — what actually shows on the bank/gateway statement, checked against expected settlement; same ephemeral, never-persisted pattern as countedCash

  const [employees, setEmployees] = useState([]); // shared staff roster: [{id, name, pin}]
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [rosterLoadFailed, setRosterLoadFailed] = useState(false); // couldn't reach the roster (e.g. offline) — distinct from "genuinely no staff yet"
  const rosterLoadFailedRef = useRef(false);
  const [currentEmployee, setCurrentEmployee] = useState(null); // {id, name} | null — who's clocked in (or just viewing — see viewingOnly) on this device
  const [currentEmployeeLoaded, setCurrentEmployeeLoaded] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportExpiresAt, setSupportExpiresAt] = useState(null); // ms timestamp while a support session is open on this device
  const supportTapsRef = useRef([]);
  const [viewingOnly, setViewingOnly] = useState(false); // manager checking the system from their phone, e.g. — signed in but not on shift, so it never touches shift stats
  const [pendingManagerLogin, setPendingManagerLogin] = useState(null); // a manager whose PIN just verified, waiting on their Clock in / Just view choice
  // Shared, live registry of shifts currently open on ANY device — {[employeeId]: {employeeId, employeeName, clockIn}}.
  // current-employee/shift-start themselves stay device-local (see tenantStorage.js), so this is
  // the one thing that actually crosses devices while a shift is still running, letting a manager
  // checking in remotely (see viewingOnly) see who's on shift right now — not just past shifts,
  // which only land in the shared shift-log once someone clocks out.
  const [openShifts, setOpenShifts] = useState({});
  const [openShiftsLoaded, setOpenShiftsLoaded] = useState(false);
  const [dayClosings, setDayClosings] = useState({}); // { "YYYY-MM-DD": [ { id, closedAt, closedBy, note, snapshot } ] }
  const [closeDayModal, setCloseDayModal] = useState(null);
  const [dayCollections, setDayCollections] = useState({}); // { "YYYY-MM-DD": { amount, by, at } } — cash taken out at the end of that business day
  const [collectionDraft, setCollectionDraft] = useState({ day: null, value: "" });
  const [closingDaySaving, setClosingDaySaving] = useState(false);
  const [closeDayDate, setCloseDayDate] = useState(null); // business date shown on the Close the day tab; null = today's business day
  const [dayCheckDate, setDayCheckDate] = useState(null); // business date picked in the Staff tab's "Day check"; null = today's business day
  const [viewingShiftDetail, setViewingShiftDetail] = useState(null); // a past shift-log entry a manager tapped, to show its orders/breakdown
  const [shiftLog, setShiftLog] = useState([]); // shared history of completed shifts
  const lastPublishedAvailabilityRef = useRef(null);
  const [shiftLogLoaded, setShiftLogLoaded] = useState(false);
  const shiftLogLoadedRef = useRef(false);
  shiftLogLoadedRef.current = shiftLogLoaded;
  const [loginSelectedId, setLoginSelectedId] = useState(null);
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginAddMode, setLoginAddMode] = useState(false);
  const [loginNewName, setLoginNewName] = useState("");
  const [loginNewPin, setLoginNewPin] = useState("");
  const [shiftRecap, setShiftRecap] = useState(null); // stats shown right after clocking out
  const [pendingOpeningCount, setPendingOpeningCount] = useState(null); // employee about to start a shift, waiting for the opening cash count
  const [openingCountDraft, setOpeningCountDraft] = useState("");
  const [closingCountOpen, setClosingCountOpen] = useState(false);
  const [closingCountDraft, setClosingCountDraft] = useState("");
  const [returnDialog, setReturnDialog] = useState(null); // { receipt, action: "cancel" | "refund", method } — which way the money goes back to the customer
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm } | null — replaces window.confirm, which this preview's sandbox silently blocks
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  const [helpChatMessages, setHelpChatMessages] = useState([]); // [{ role: "user"|"assistant", content: string }]
  const [helpChatInput, setHelpChatInput] = useState("");
  const [helpChatSending, setHelpChatSending] = useState(false);
  const HELP_BTN_SIZE = 52;
  // The help button is draggable — a fixed position inevitably ends up sitting on top of real
  // content in some view. By default it sits bottom-corner on the side OPPOSITE the Order screen's
  // docked ticket panel (that panel sits on the same side "isRtl ? left : right" resolves to,
  // since this app has no explicit RTL flex override — the browser's natural row-reversal under
  // dir="rtl" is what actually places it), so the default position doesn't collide with the
  // Save/Print/Download row that originally prompted this. It stays bottom-anchored, not
  // vertically centered, so the chat panel — which needs ~450px of vertical room — reliably has
  // enough space to open upward from it. It can always be dragged elsewhere if it's still in the
  // way somewhere.
  const [helpButtonPos, setHelpButtonPos] = useState(() => {
    const w = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024;
    const h = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768;
    return { top: h - HELP_BTN_SIZE - 20, left: 20 }; // left side by default (English/LTR); corrected for the real language once it loads, below
  });
  const [helpButtonMoved, setHelpButtonMoved] = useState(false); // once the person drags it, stop re-centering it on them
  const helpDragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0, moved: false });
  const [whatsappFallback, setWhatsappFallback] = useState(null); // { phone, message, name } | null — shown when there's no WhatsApp backend configured
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPin, setNewStaffPin] = useState("");
  const [editingPinId, setEditingPinId] = useState(null);
  const [editingPinValue, setEditingPinValue] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [lang, setLang] = useState(bootCache?.lang === "en" ? "en" : "ar");
  const [langLoaded, setLangLoaded] = useState(false);

  // Staff terminal's own light/dark theme — see the token block in FONTS above. Independent of
  // any per-device local setting so every terminal in the restaurant shows the same theme, same
  // as the rest of branding.
  const [uiTheme, setUiTheme] = useState(bootCache?.theme === "light" ? "light" : "dark");
  const [uiThemeLoaded, setUiThemeLoaded] = useState(false);
  const [uiThemeLoadFailed, setUiThemeLoadFailed] = useState(false);
  const uiThemeLoadFailedRef = useRef(false);

  const [restaurantName, setRestaurantName] = useState(bootCache?.name || "");
  const [logoUrl, setLogoUrl] = useState(bootCache?.logo || null);
  const [primaryColor, setPrimaryColor] = useState(bootCache?.primary || COLORS.burgundy);
  const [secondaryColor, setSecondaryColor] = useState(bootCache?.secondary || COLORS.brass);
  const [mapsLink, setMapsLink] = useState(""); // a Google Maps place link, or a plain address — see openInGoogleMaps
  const [phoneNumber, setPhoneNumber] = useState(""); // shown as a "Call" button on the online-ordering page
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  const [vatPercent, setVatPercent] = useState(0);
  const [servicePercent, setServicePercent] = useState(0);
  const [taxConfigLoaded, setTaxConfigLoaded] = useState(false);
  const [taxConfigLoadFailed, setTaxConfigLoadFailed] = useState(false);
  const taxConfigLoadFailedRef = useRef(false);

  // How much of the delivery fee the restaurant keeps for itself — the rest is the rider's pay.
  // Either a percentage of the fee, or a flat amount per delivery regardless of the fee size.
  // Defaults to 0% (restaurant keeps nothing, rider keeps the whole fee — today's behavior)
  // until a manager sets it otherwise.
  const [deliveryFeeRetentionMode, setDeliveryFeeRetentionMode] = useState("percentage"); // "percentage" | "fixed"
  const [deliveryFeeRetentionPercent, setDeliveryFeeRetentionPercent] = useState(0);
  const [deliveryFeeRetentionFixed, setDeliveryFeeRetentionFixed] = useState(0);
  const [deliveryShareConfigLoaded, setDeliveryShareConfigLoaded] = useState(false);
  const [deliveryShareConfigLoadFailed, setDeliveryShareConfigLoadFailed] = useState(false);
  const deliveryShareConfigLoadFailedRef = useRef(false);

  // Tabs a manager has chosen to require a manager PIN to open — see handleTabClick. Regular
  // staff hit a PIN prompt; a currently-logged-in manager always passes straight through (they've
  // already proven who they are for this whole session by clocking in).
  const [pinGatedTabs, setPinGatedTabs] = useState([]);
  // Which gated tabs this specific sitting has already unlocked, so a non-manager doesn't have to
  // re-enter a manager's PIN every single time they revisit the same tab — cleared on clock-out.
  const [unlockedTabs, setUnlockedTabs] = useState(() => new Set());
  const [tabPinPrompt, setTabPinPrompt] = useState(null); // the tab key awaiting a manager PIN, or null
  const [tabPinInput, setTabPinInput] = useState("");
  const [tabPinError, setTabPinError] = useState(false);

  // Menu/category editor state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [itemEditor, setItemEditor] = useState(null); // { mode, category, id, name, tag, price, recipe }
  const [recipeDraftIng, setRecipeDraftIng] = useState("");
  const [recipeDraftQty, setRecipeDraftQty] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeListOpen, setRecipeListOpen] = useState(false);
  const [recipeQtyDrafts, setRecipeQtyDrafts] = useState({}); // raw text while a recipe line's quantity is being typed
  const recipeQtyInputRef = useRef(null);
  const [manualOutOfStock, setManualOutOfStock] = useState({}); // { [itemId]: true } — items staff marked out of stock by hand, on top of ingredient-based availability
  const [manualOutLoaded, setManualOutLoaded] = useState(false);
  const manualOutWritesRef = useRef(0);
  const [kitchenMode, setKitchenMode] = useState("off"); // device-local: off | here | send | station — see "kitchen-print-mode" in lib/tenantStorage.js
  const [kitchenRecent, setKitchenRecent] = useState([]); // station only: the latest tickets in the shared queue
  const kitchenModeRef = useRef("off");
  const [autoPrint, setAutoPrint] = useState("none"); // device-local: none | receipt | kitchen | both — what prints by itself when an order is saved here
  const autoPrintRef = useRef("none");
  const kitchenPrintedRef = useRef([]); // ids this station has already printed
  const kitchenSinceRef = useRef(0); // only tickets created after the station was switched on are printed
  const kitchenHandlerRef = useRef(() => {}); // always the newest handler, so the poll never uses a stale language/closure
  const [orderSoundOn, setOrderSoundOn] = useState(false); // device-local — see the "order-sound" key in lib/tenantStorage.js
  const audioCtxRef = useRef(null);
  const seenPendingIdsRef = useRef(null);
  const pendingFetchedOkRef = useRef(false);
  const [callCenterLinkCopied, setCallCenterLinkCopied] = useState(false);
  const [stockImportOpen, setStockImportOpen] = useState(false);
  const [customersImportOpen, setCustomersImportOpen] = useState(false);
  const [newIngName, setNewIngName] = useState("");
  const [newIngUnit, setNewIngUnit] = useState("kg");
  const [newIngUnitCustom, setNewIngUnitCustom] = useState("");
  const [newIngStock, setNewIngStock] = useState("");

  // Menu photo scan — upload a picture of a printed menu, Claude reads it, staff reviews the
  // detected items (pre-checked, editable) before they're actually added to the menu.
  const [menuScanImage, setMenuScanImage] = useState(null); // data URL preview, or null when idle
  const [menuScanning, setMenuScanning] = useState(false);
  const [menuScanError, setMenuScanError] = useState("");
  const [menuScanResults, setMenuScanResults] = useState(null); // [{ category, name, tag, price, include }] | null

  const thisMonthKey = () => new Date().toISOString().slice(0, 7);
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  // Fetches this tenant's own subscription state so the terminal can show its own renewal popup
  // (7/3/1 days before paid_until) instead of that being a server-dispatched email — see
  // app/api/pos/[tenantId]/status. Re-checked periodically (not just on mount) so a terminal left
  // open overnight picks up a freshly-crossed threshold, or a payment that just got recorded,
  // without needing a manual refresh.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const res = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/status`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setTenantStatus(data);
      } catch (e) {
        // a transient failure here just means the popup can't show this tick — not worth
        // surfacing as an error to staff mid-shift over a subscription-status check
      }
    };
    loadStatus();
    const interval = setInterval(loadStatus, 30 * 60 * 1000); // every 30 minutes
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tenantId]);
  // Dismissing only suppresses THIS specific day's popup (keyed by paid_until + days_remaining,
  // mirroring how the old server-side reminder_log kept 7/3/1 independent) — extending paid_until
  // naturally re-arms it under the new cycle since the key changes, no manual reset needed.
  useEffect(() => {
    if (!tenantStatus || !tenantId) return;
    const key = `renewal-notice-dismissed-${tenantId}-${tenantStatus.paid_until}-${tenantStatus.days_remaining}`;
    setRenewalNoticeDismissed(typeof window !== "undefined" && window.localStorage.getItem(key) === "1");
  }, [tenantId, tenantStatus?.paid_until, tenantStatus?.days_remaining]);
  const dismissRenewalNotice = () => {
    if (!tenantStatus || !tenantId) return;
    const key = `renewal-notice-dismissed-${tenantId}-${tenantStatus.paid_until}-${tenantStatus.days_remaining}`;
    if (typeof window !== "undefined") window.localStorage.setItem(key, "1");
    setRenewalNoticeDismissed(true);
  };
  const showRenewalNotice =
    tenantStatus?.status === "active" && [7, 3, 1].includes(tenantStatus.days_remaining) && !renewalNoticeDismissed;

  useEffect(() => {
    (async () => {
      try {
        const result = await storage.list("receipts:", false);
        const months = (result?.keys || []).map((k) => k.replace("receipts:", "")).sort().reverse();
        setMonthKeys(months);
        setSelectedMonth(months[0] || thisMonthKey());
      } catch (e) {
        setSelectedMonth(thisMonthKey());
      } finally {
        setMonthsLoaded(true);
      }
    })();

    (async () => {
      try {
        const empResult = await storage.get("current-employee", false);
        const emp = empResult?.value ? JSON.parse(empResult.value) : null;
        setCurrentEmployee(emp);
        if (emp) {
          const viewingResult = await storage.get("viewing-only", false);
          const isViewingOnly = viewingResult?.value === "true";
          setViewingOnly(isViewingOnly);
          if (isViewingOnly) {
            setShiftStart(null);
          } else {
            const result = await storage.get("shift-start", false);
            setShiftStart(result?.value || new Date().toISOString());
            const floatResult = await storage.get("opening-float", false);
            setOpeningFloat(floatResult?.value || "0");
          }
        } else {
          setShiftStart(null);
          setViewingOnly(false);
        }
      } catch (e) {
        setCurrentEmployee(null);
        setShiftStart(null);
        setViewingOnly(false);
      } finally {
        setShiftLoaded(true);
        setCurrentEmployeeLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "staff-roster");
        setEmployees(result?.value ? JSON.parse(result.value) : []);
      } catch (e) {
        setRosterLoadFailed(true);
      } finally {
        setEmployeesLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "shift-log");
        setShiftLog(result?.value ? JSON.parse(result.value) : []);
      } catch (e) {
        setShiftLog([]);
      } finally {
        setShiftLogLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await storage.get("customers-directory", false);
        setCustomers(result && result.value ? JSON.parse(result.value) : {});
      } catch (e) {
        setCustomers({});
      } finally {
        setCustomersLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await storage.get("ui-lang", false);
        // Arabic by default — only an explicit past choice of English should override it.
        setLang(result?.value === "en" ? "en" : "ar");
      } catch (e) {
        setLang("ar");
      } finally {
        setLangLoaded(true);
      }
    })();

    (async () => {
      try {
        // Branding is shared so a QR-scanning customer's device (and any other staff terminal)
        // sees the same restaurant name/logo/colors as this one.
        const result = await getSharedWithRetry(storage, "restaurant-branding");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed) {
          setRestaurantName(parsed.name || "");
          setLogoUrl(parsed.logo || null);
          setPrimaryColor(parsed.primary || theme.primary);
          setSecondaryColor(parsed.secondary || theme.secondary);
          setMapsLink(parsed.mapsLink || "");
          setPhoneNumber(parsed.phone || "");
        }
        // A restaurant that never set its own name shows the one it was registered under — never a stock name.
        if (!parsed || !parsed.name) {
          try {
            const st = await (await fetch(`/api/pos/${encodeURIComponent(tenantId)}/status`)).json();
            if (st?.restaurant_name) setRestaurantName(st.restaurant_name);
          } catch (e) {
            // the name stays empty until the next load
          }
        }
      } catch (e) {
        // fall back to defaults already set
      } finally {
        setBrandingLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "shift-hours-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        // Merged over the defaults rather than replacing outright, so an older saved config
        // missing a weekday (or saved before this feature existed) still fills in safely.
        if (parsed) setShiftHoursConfig({ ...DEFAULT_SHIFT_HOURS, ...parsed });
      } catch (e) {
        // fall back to defaults already set
      } finally {
        setShiftHoursLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "tax-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed) {
          setVatPercent(Number(parsed.vatPercent) || 0);
          setServicePercent(Number(parsed.servicePercent) || 0);
        }
      } catch (e) {
        // Genuinely couldn't reach it — do NOT fall through to 0%/0%: taxConfigLoadFailed blocks
        // the auto-persist effect below from writing that over a real VAT/service rate.
        setTaxConfigLoadFailed(true);
      } finally {
        setTaxConfigLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "delivery-share-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed && parsed.agentSharePercent !== undefined && parsed.retentionMode === undefined) {
          // Old format: agentSharePercent was the rider's share. Convert to the restaurant's
          // retention percentage (its complement) so already-configured tenants keep the exact
          // same split after this field's meaning flipped.
          setDeliveryFeeRetentionMode("percentage");
          setDeliveryFeeRetentionPercent(Math.max(0, Math.min(100, 100 - Number(parsed.agentSharePercent))));
        } else if (parsed) {
          setDeliveryFeeRetentionMode(parsed.retentionMode === "fixed" ? "fixed" : "percentage");
          setDeliveryFeeRetentionPercent(Number(parsed.retentionPercent) || 0);
          setDeliveryFeeRetentionFixed(Number(parsed.retentionFixed) || 0);
        }
      } catch (e) {
        setDeliveryShareConfigLoadFailed(true);
      } finally {
        setDeliveryShareConfigLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "ui-theme-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed?.theme === "light" || parsed?.theme === "dark") setUiTheme(parsed.theme);
      } catch (e) {
        setUiThemeLoadFailed(true);
      } finally {
        setUiThemeLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "tab-access-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed?.pinGated) {
          setPinGatedTabs(parsed.pinGated);
        } else {
          // No config has ever been saved for this tenant — Expenses/Dashboard used to be
          // unconditionally hidden from non-managers before this setting existed, so default
          // them to locked rather than wide open, preserving that expectation until a manager
          // actively chooses otherwise in Settings > Tab access.
          setPinGatedTabs(["expenses", "dashboard"]);
        }
      } catch (e) {
        // fall back to no tabs gated
      }
    })();

    (async () => {
      // Menu/categories/ingredients are shared so they (a) actually persist across reloads for
      // the operator — previously they only lived in memory and reset on every refresh — and
      // (b) are visible to a customer's phone after scanning a table's QR code.
      //
      // If either read fails, this MUST NOT silently fall through to the built-in placeholder
      // starter menu/ingredients still sitting in state — menuLoadFailed blocks the auto-persist
      // effect below from writing anything until a retry actually succeeds, so a transient offline
      // moment at startup can never overwrite the tenant's real data with the demo placeholder.
      let failed = false;
      try {
        const result = await getSharedWithRetry(storage, "menu-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed) {
          if (parsed.categories) setCategories(parsed.categories);
          if (parsed.menu) setMenu(parsed.menu);
          setMainCategories(cleanMains(parsed.mainCategories));
        } else {
          // The server answered and there is no saved menu: a brand-new restaurant. Offer the starter set.
          setCategories(Object.keys(INITIAL_MENU));
          setMenu(INITIAL_MENU);
        }
      } catch (e) {
        failed = true;
      }
      try {
        const ingResult = await getSharedWithRetry(storage, "ingredients-config");
        if (ingResult?.value) setIngredients(JSON.parse(ingResult.value));
        else setIngredients(INITIAL_INGREDIENTS);
      } catch (e) {
        failed = true;
      } finally {
        if (failed) setMenuLoadFailed(true);
        setMenuLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "menu-profiles-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (Array.isArray(parsed)) setMenuProfiles(parsed);
      } catch (e) {
        setMenuProfilesLoadFailed(true);
      } finally {
        setMenuProfilesLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "tables-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed) {
          setTableCount(Number(parsed.count) > 0 ? Number(parsed.count) : 12);
          setTableNames(parsed.names || {});
        }
      } catch (e) {
        setTablesLoadFailed(true);
      } finally {
        setTablesLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "suppliers-config");
        setSuppliers(result?.value ? JSON.parse(result.value) : []);
      } catch (e) {
        setSuppliers([]);
      } finally {
        setSuppliersLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "duty-roster");
        setDutyRoster(result?.value ? JSON.parse(result.value) : []);
      } catch (e) {
        setDutyRoster([]);
      } finally {
        setDutyRosterLoaded(true);
      }
    })();

    (async () => {
      try {
        const result = await getSharedWithRetry(storage, "delivery-zones-config");
        setDeliveryZones(result?.value ? JSON.parse(result.value) : []);
      } catch (e) {
        setDeliveryZones([]);
      } finally {
        setDeliveryZonesLoaded(true);
      }
    })();

    // Ticket numbers ascend sequentially and reset each morning (order #1, #2, #3...), shared
    // across every terminal so two stations never hand out the same number for the same day.
    (async () => {
      // The saved counter is loaded as-is; whether it's still "today's" is decided when a ticket is
      // actually issued (issueTicketNumber), by which time the shift hours have loaded — deciding it
      // here, before they have, would use the wrong notion of when the business day starts.
      try {
        const result = await getSharedWithRetry(storage, "ticket-counter");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        ticketCounterRef.current = parsed || { date: null, next: 1 };
      } catch (e) {
        ticketCounterRef.current = { date: null, next: 1 };
      } finally {
        setTicketCounterLoaded(true);
      }
    })();
  }, []);

  // Polls for orders customers have submitted via QR (a separate shared key from anything else
  // this app stores) so new ones show up on their own without the operator needing to refresh —
  // this is the one piece of shared data that genuinely needs to be "live" across devices, since
  // it's how a customer's phone hands work off to the staff terminal.
  useEffect(() => {
    let cancelled = false;
    const loadPending = async () => {
      try {
        const result = await storage.get("pending-orders", true);
        if (cancelled) return;
        setPendingOrders(result?.value ? JSON.parse(result.value) : []);
        pendingFetchedOkRef.current = true;
      } catch (e) {
        // leave whatever was there before — a transient failure shouldn't wipe the list
      } finally {
        if (!cancelled) setPendingOrdersLoaded(true);
      }
    };
    loadPending();
    // Kept fresh by the shared live-sync timer below (one batched request for everything).
    return () => {
      cancelled = true;
    };
  }, []);

  // Same live-polling reasoning as pending-orders above — this is how a manager viewing from
  // another device sees who's currently on shift without needing to refresh.
  useEffect(() => {
    let cancelled = false;
    const loadOpenShifts = async () => {
      try {
        const result = await storage.get("open-shifts", true);
        if (cancelled) return;
        setOpenShifts(result?.value ? JSON.parse(result.value) : {});
      } catch (e) {
        // leave whatever was there before — a transient failure shouldn't wipe the list
      } finally {
        if (!cancelled) setOpenShiftsLoaded(true);
      }
    };
    loadOpenShifts();
    // Kept fresh by the shared live-sync timer below (one batched request for everything).
    return () => {
      cancelled = true;
    };
  }, []);

  // Items staff have marked out of stock by hand. Kept in its own small shared key (not inside
  // menu-config) so toggling one is a tiny write any employee can make, and so it can't collide
  // with menu editing. Polled like the other live shared state; poll results are ignored while one
  // of this device's own writes is still in flight so the switch doesn't flicker back.
  useEffect(() => {
    let cancelled = false;
    const loadManualOut = async () => {
      try {
        const result = await storage.get("item-out-of-stock", true);
        if (cancelled || manualOutWritesRef.current > 0) return;
        setManualOutOfStock(result?.value ? JSON.parse(result.value) : {});
        setManualOutLoaded(true);
      } catch (e) {
        // keep whatever was there — and manualOutLoaded stays false until one real read succeeds,
        // which holds back publishing availability (see the menu-availability effect)
      }
    };
    loadManualOut();
    // Kept fresh by the shared live-sync timer below (one batched request for everything).
    return () => {
      cancelled = true;
    };
  }, []);

  // New-order sound. The on/off choice is per device (a kitchen screen may want it, a back-office
  // PC may not). Browsers only allow audio after the person has interacted with the page once, so
  // the first click/tap/keypress anywhere quietly creates the audio context.
  useEffect(() => {
    storage.get("order-sound").then((r) => setOrderSoundOn(r?.value === "1")).catch(() => {});
  }, []);
  const ensureAudioContext = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch (e) {
      return null;
    }
  };
  useEffect(() => {
    const unlock = () => ensureAudioContext();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const playOrderChime = () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    [880, 1174.66, 1567.98].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.2;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  };
  // ---- Kitchen printing (per device) ----
  useEffect(() => {
    Promise.all([storage.get("kitchen-print-mode"), storage.get("kitchen-print-since"), storage.get("kitchen-printed"), storage.get("auto-print")])
      .then(([m, since, printed, auto]) => {
        const mode = KITCHEN_MODES.includes(m?.value) ? m.value : "off";
        kitchenModeRef.current = mode;
        setKitchenMode(mode);
        // A device that was already printing kitchen tickets keeps doing exactly that.
        const savedAuto = ["none", "receipt", "kitchen", "both"].includes(auto?.value) ? auto.value : mode !== "off" ? "kitchen" : "none";
        autoPrintRef.current = savedAuto;
        setAutoPrint(savedAuto);
        kitchenSinceRef.current = Number(since?.value) || 0;
        try {
          const ids = JSON.parse(printed?.value || "[]");
          kitchenPrintedRef.current = Array.isArray(ids) ? ids : [];
        } catch (e) {
          kitchenPrintedRef.current = [];
        }
      })
      .catch(() => {});
  }, []);
  // The printer device must not fall asleep, or it would stop checking for new tickets.
  useEffect(() => {
    if (kitchenMode !== "station" || typeof navigator === "undefined" || !navigator.wakeLock) return undefined;
    let lock = null;
    let stopped = false;
    const grab = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch (e) {
        // not allowed right now (battery saver, hidden page) — tried again when the page is visible
      }
    };
    grab();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopped) grab();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      try {
        if (lock) lock.release();
      } catch (e) {
        // already released
      }
    };
  }, [kitchenMode]);
  const changeAutoPrint = (mode) => {
    setAutoPrint(mode);
    autoPrintRef.current = mode;
    storage.set("auto-print", mode).catch(() => {});
    // Kitchen tickets need somewhere to go: print here unless this device already sends them elsewhere or is the printer.
    if ((mode === "kitchen" || mode === "both") && kitchenModeRef.current === "off") changeKitchenMode("here");
  };
  const changeKitchenMode = (mode) => {
    setKitchenMode(mode);
    kitchenModeRef.current = mode;
    storage.set("kitchen-print-mode", mode).catch(() => {});
    if (mode === "station") {
      kitchenSinceRef.current = Date.now();
      storage.set("kitchen-print-since", String(kitchenSinceRef.current)).catch(() => {});
      delete dataVersionsRef.current["kitchen-queue"];
    }
  };
  const toggleOrderSound = (on) => {
    setOrderSoundOn(on);
    storage.set("order-sound", on ? "1" : "0").catch(() => {});
    if (on) playOrderChime();
  };
  // Rings when an order that wasn't there before shows up in the pending list. The very first
  // successful read only records what's already waiting, so opening the terminal (or a failed
  // read recovering) never plays a sound for orders staff have already seen.
  useEffect(() => {
    if (!pendingFetchedOkRef.current) return;
    const ids = pendingOrders.filter((o) => o.status !== "confirmed").map((o) => o.id);
    if (seenPendingIdsRef.current === null) {
      seenPendingIdsRef.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seenPendingIdsRef.current.has(id));
    ids.forEach((id) => seenPendingIdsRef.current.add(id));
    if (fresh.length > 0 && orderSoundOn) playOrderChime();
  }, [pendingOrders, orderSoundOn]);

  // Auto-persists menu/category/ingredient edits to shared storage as they change, rather than
  // threading a save call through every individual add/edit/delete handler. Routed through
  // syncSet so an edit made while offline is queued and retried instead of silently lost.
  useEffect(() => {
    // menuLoadFailed: the initial read never actually succeeded, so categories/menu are still
    // whatever placeholder they started as — writing that out would overwrite the tenant's real
    // data. Stays blocked until retryMenuLoad() below confirms a real read.
    if (!menuLoaded || menuLoadFailed) return undefined;
    // A burst of edits (grouping several categories in a row, say) is saved once, with the final state — separate
    // requests sent back to back can arrive out of order and leave an older state stored.
    const timer = setTimeout(() => syncSet("menu-config", JSON.stringify({ categories, menu, mainCategories }), true, t("syncLabelMenu")), 500);
    return () => clearTimeout(timer);
  }, [categories, menu, mainCategories, menuLoaded, menuLoadFailed]);
  // No blanket auto-persist effect for ingredients-config — every mutation (updateIngredientStock,
  // addIngredient, deleteIngredient, commitIngredientStockValue) writes it explicitly against a
  // freshly-fetched value instead. See the "Ingredient stock helpers" section for why.
  useEffect(() => {
    if (!menuProfilesLoaded || menuProfilesLoadFailed) return;
    syncSet("menu-profiles-config", JSON.stringify(menuProfiles), true, t("syncLabelMenu"));
  }, [menuProfiles, menuProfilesLoaded, menuProfilesLoadFailed]);
  useEffect(() => {
    if (!tablesLoaded || tablesLoadFailed) return;
    syncSet("tables-config", JSON.stringify({ count: tableCount, names: tableNames }), true, t("syncLabelTables"));
  }, [tableCount, tableNames, tablesLoaded, tablesLoadFailed]);
  useEffect(() => {
    if (!taxConfigLoaded || taxConfigLoadFailed) return;
    syncSet("tax-config", JSON.stringify({ vatPercent, servicePercent }), true, t("syncLabelSettings"));
  }, [vatPercent, servicePercent, taxConfigLoaded, taxConfigLoadFailed]);
  useEffect(() => {
    if (!deliveryShareConfigLoaded || deliveryShareConfigLoadFailed) return;
    syncSet(
      "delivery-share-config",
      JSON.stringify({ retentionMode: deliveryFeeRetentionMode, retentionPercent: deliveryFeeRetentionPercent, retentionFixed: deliveryFeeRetentionFixed }),
      true,
      t("syncLabelSettings")
    );
  }, [deliveryFeeRetentionMode, deliveryFeeRetentionPercent, deliveryFeeRetentionFixed, deliveryShareConfigLoaded, deliveryShareConfigLoadFailed]);
  useEffect(() => {
    if (!uiThemeLoaded || uiThemeLoadFailed) return;
    syncSet("ui-theme-config", JSON.stringify({ theme: uiTheme }), true, t("syncLabelSettings"));
  }, [uiTheme, uiThemeLoaded, uiThemeLoadFailed]);
  // Publishes ONLY a per-item true/false availability flag to shared storage — never the
  // underlying ingredient names, quantities, or stock counts. This is what the public online-
  // ordering link (and table QR menus) read to show "Available"/"Not available" per dish, without
  // any path to the actual inventory data that produced that flag. Also gated on menuLoadFailed —
  // a failed menu/ingredients read would otherwise publish availability computed from the
  // placeholder starter menu's item ids instead of the tenant's real ones.
  useEffect(() => {
    // Also waits for one successful read of the hand-set out-of-stock flags, so a failed read can't
    // publish "available" for an item staff deliberately turned off.
    if (!menuLoaded || menuLoadFailed || !manualOutLoaded) return;
    const availability = {};
    Object.values(menu).flat().forEach((item) => {
      const available =
        manualOutOfStock[item.id]
          ? false
          : !item.recipe || item.recipe.length === 0
          ? true
          : item.recipe.every((r) => {
              const ing = ingredients[r.ingredientId];
              return ing && r.qty > 0 && ing.stock >= r.qty;
            });
      availability[item.id] = available;
    });
    // Every order changes stock, but most orders don't change what is available — only write when it did.
    const serialized = JSON.stringify(availability);
    if (serialized === lastPublishedAvailabilityRef.current) return;
    lastPublishedAvailabilityRef.current = serialized;
    syncSet("menu-availability", serialized, true, t("syncLabelStock"));
  }, [menu, ingredients, menuLoaded, menuLoadFailed, manualOutOfStock, manualOutLoaded]);

  useEffect(() => {
    if (!brandingLoaded || !restaurantName) return;
    writeBoot(tenantId, { name: restaurantName, logo: logoUrl && logoUrl.length < 650000 ? logoUrl : null, primary: primaryColor, secondary: secondaryColor });
  }, [brandingLoaded, restaurantName, logoUrl, primaryColor, secondaryColor]);
  useEffect(() => {
    if (uiThemeLoaded && !uiThemeLoadFailed) writeBoot(tenantId, { theme: uiTheme });
  }, [uiTheme, uiThemeLoaded, uiThemeLoadFailed]);
  useEffect(() => {
    if (langLoaded) writeBoot(tenantId, { lang });
  }, [lang, langLoaded]);

  // Ticks once a minute purely to refresh the live "hours worked so far" display while someone's
  // clocked in — doesn't touch storage, just forces a re-render of that one computed string.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const toggleLang = async (next) => {
    setLang(next);
    syncSet("ui-lang", next, false, t("syncLabelSettings"));
  };

  // Fire-and-forget log of a "major" edit (restaurant name change, logo change, a menu scan) for
  // /admin/activity to notice if this tenant makes an unusual number of them in a short window —
  // see app/api/pos/[tenantId]/activity/route.js. Never awaited by callers and never surfaces an
  // error to staff: this is a background admin-visibility signal, not something that should ever
  // block or fail a real POS action (especially not while offline).
  const logActivity = (eventType, detail) => {
    fetch(`/api/pos/${encodeURIComponent(tenantId)}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, detail: detail || null }),
    }).catch(() => {});
  };

  // Persists the full branding bundle (name, logo, colors) together in one key, since they're
  // edited together on the Settings screen and read together everywhere else. Shared, same
  // reasoning as above — a QR-scanning customer needs to see the current branding too.
  const persistBranding = async (next) => {
    const ok = await syncSet("restaurant-branding", JSON.stringify(next), true, t("syncLabelSettings"));
    if (!ok) flashNotice(t("notice_brandingSaveFailed"));
  };
  const updateRestaurantName = (value) => {
    setRestaurantName(value);
    persistBranding({ name: value, logo: logoUrl, primary: primaryColor, secondary: secondaryColor, mapsLink, phone: phoneNumber });
  };
  // The name field persists on every keystroke (see updateRestaurantName above), which would spam
  // the activity log if logged there — instead, capture the value when the field gains focus and
  // log a single event on blur, only if it actually ended up different.
  const nameOnFocusRef = useRef(restaurantName);
  const handleNameFocus = () => {
    nameOnFocusRef.current = restaurantName;
  };
  const handleNameBlur = () => {
    if (restaurantName !== nameOnFocusRef.current) {
      logActivity("restaurant_name_changed", `"${nameOnFocusRef.current}" -> "${restaurantName}"`);
    }
  };
  const updatePrimaryColor = (value) => {
    setPrimaryColor(value);
    persistBranding({ name: restaurantName, logo: logoUrl, primary: value, secondary: secondaryColor, mapsLink, phone: phoneNumber });
  };
  const updateSecondaryColor = (value) => {
    setSecondaryColor(value);
    persistBranding({ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: value, mapsLink, phone: phoneNumber });
  };
  const updateMapsLink = (value) => {
    setMapsLink(value);
    persistBranding({ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: secondaryColor, mapsLink: value, phone: phoneNumber });
  };
  const updatePhoneNumber = (value) => {
    setPhoneNumber(value);
    persistBranding({ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: secondaryColor, mapsLink, phone: value });
  };

  const updateShiftHours = (weekday, field, value) => {
    const next = { ...shiftHoursConfig, [weekday]: { ...shiftHoursConfig[weekday], [field]: value } };
    setShiftHoursConfig(next);
    syncSet("shift-hours-config", JSON.stringify(next), true, t("syncLabelSettings"));
  };

  const togglePinGatedTab = (key) => {
    const next = pinGatedTabs.includes(key) ? pinGatedTabs.filter((k) => k !== key) : [...pinGatedTabs, key];
    setPinGatedTabs(next);
    syncSet("tab-access-config", JSON.stringify({ pinGated: next }), true, t("syncLabelSettings"));
  };

  // Order-taking is deliberately never gate-able — it's the one thing every employee needs
  // immediate access to regardless of what a manager has locked down. Expenses/Dashboard use this
  // same mechanism (see the default-gated fallback in the tab-access-config load effect above) —
  // they used to be unconditionally hidden from non-managers with no way to change that; now a
  // manager can choose to unlock them like any other tab, but they still start out locked for
  // anyone who's never touched this setting, so nothing about the old default behavior changes on
  // its own.
  const GATEABLE_TABS = ["menu", "stock", "tables", "delivery", "receipts", "expenses", "dashboard", "customers", "shift", "staff", "settings"];

  // A manager who's already clocked in has proven who they are for this whole session, so gated
  // tabs open normally for them — the PIN prompt is only ever shown to non-manager staff, and only
  // once per gated tab per sitting (see unlockedTabs, cleared on clock-out in finishClockOut).
  const handleTabClick = (key) => {
    if (hasFeature("tabAccessControl") && pinGatedTabs.includes(key) && !isManager && !unlockedTabs.has(key)) {
      setTabPinPrompt(key);
      setTabPinInput("");
      setTabPinError(false);
      return;
    }
    // Clicking the base Order tab always means "back to the base menu" — a price-list profile
    // tab is really just the Order tab with a profile applied (see openMenuProfileTab), so
    // switching here has to explicitly drop whichever profile was active.
    if (key === "order") setActiveMenuProfile(null);
    setView(key);
  };
  const openMenuProfileTab = (profileId) => {
    setActiveMenuProfile(profileId);
    setView("order");
  };

  const submitTabPin = (pin) => {
    const match = employees.find((e) => e.pin === pin && e.role === "manager");
    if (!match) {
      setTabPinError(true);
      setTabPinInput("");
      return;
    }
    setUnlockedTabs((prev) => new Set([...prev, tabPinPrompt]));
    setView(tabPinPrompt);
    setTabPinPrompt(null);
    setTabPinInput("");
    setTabPinError(false);
  };

  const MAX_LOGO_BYTES = 700 * 1024; // keep the header/receipts snappy and well under the storage cap
  const handleLogoFile = (file) => {
    if (!file) return;
    if (!looksLikeImage(file)) {
      flashNotice(t("notice_logoInvalidType"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      flashNotice(t("notice_logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setLogoUrl(dataUrl);
      persistBranding({ name: restaurantName, logo: dataUrl, primary: primaryColor, secondary: secondaryColor, mapsLink, phone: phoneNumber });
      flashNotice(t("notice_logoUpdated"));
      logActivity("logo_changed");
    };
    reader.onerror = () => flashNotice(t("notice_logoInvalidType"));
    reader.readAsDataURL(file);
  };
  const removeLogo = () => {
    setLogoUrl(null);
    persistBranding({ name: restaurantName, logo: null, primary: primaryColor, secondary: secondaryColor, mapsLink, phone: phoneNumber });
  };

  // Looks up a UI string in the current language, falling back to English, with {{var}}
  // interpolation. This covers app chrome only — menu items, categories, and ingredient/stock
  // names are the restaurant's own data and are never run through this.
  const t = (key, vars) => {
    const template = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
  };
  // Simple two-way pluralizer for the small set of countable UI strings ("N items", etc.).
  const tCount = (baseKey, n, vars) => t(n === 1 ? baseKey : `${baseKey}_plural`, { n, ...vars });
  const isRtl = lang === "ar";

  // Derived brand palette — everywhere the UI previously used the fixed COLORS.burgundy /
  // COLORS.brass / COLORS.brassLight now reads from here instead, so editing the two colors in
  // Settings re-themes the whole app immediately.
  const theme = useMemo(
    () => ({
      primary: primaryColor,
      secondary: secondaryColor,
      secondaryLight: lighten(secondaryColor, 0.42),
    }),
    [primaryColor, secondaryColor]
  );

  // Whether the currently clocked-in person can see manager-only areas (Expenses, for now).
  // Missing/undefined role is treated as manager rather than staff — that's what an employee
  // record looks like if it existed before this permission system did, and defaulting those to
  // "restricted" would lock an existing restaurant out of its own data with nobody able to grant
  // access back. Only an employee EXPLICITLY marked "staff" is restricted; that's a deliberate
  // action a manager takes from the Staff tab, not a side effect of upgrading the app.
  const currentEmployeeRecord = employees.find((e) => e.id === currentEmployee?.id);
  const isManager = (currentEmployeeRecord?.role || "manager") !== "staff";
  const siteT = makeSiteT(lang);

  // Which package-gated tabs/features this tenant can use (see lib/packageFeatures.js and
  // /admin/packages) — "order" and "settings" are always available regardless of package, every
  // other tab needs an explicit true here. Fails closed (nothing gated shows) until the status
  // fetch resolves, rather than flashing tabs a Basic tenant shouldn't see and then hiding them.
  const hasFeature = (key) => !!tenantStatus?.features?.[key];

  // Defense in depth: if package-gated tabs are open when the admin downgrades this restaurant's
  // package mid-session, don't leave a now-disallowed screen up — bounce back to Order.
  const PACKAGE_GATED_VIEWS = ["menu", "stock", "tables", "delivery", "website", "receipts", "expenses", "dashboard", "customers", "shift", "closeday", "staff"];
  const tabStillAllowed = (key) => (key === "delivery" ? hasFeature("onlineOrderingLink") || hasFeature("deliveryZones") : key === "website" ? hasFeature("onlineOrderingLink") : key === "closeday" ? hasFeature("shift") : hasFeature(key));
  useEffect(() => {
    if (PACKAGE_GATED_VIEWS.includes(view) && tenantStatus?.features && !tabStillAllowed(view)) setView("order");
  }, [view, tenantStatus?.features]);
  // Same idea for PIN-gated tabs (which now includes Expenses/Dashboard — see GATEABLE_TABS):
  // `view` is component state that outlives any single employee's
  // sitting (clocking out doesn't reset it), so without this, a non-manager who clocks in right
  // after someone was looking at a gated tab would land straight on it, PIN prompt never shown.
  useEffect(() => {
    if (hasFeature("tabAccessControl") && pinGatedTabs.includes(view) && !isManager && !unlockedTabs.has(view)) setView("order");
  }, [view, isManager, pinGatedTabs, unlockedTabs, tenantStatus?.features]);

  // Resolves a table id ("1", "2", ...) to its display name — a custom name if the operator set
  // one, otherwise "Table N". `null` means Takeaway/Delivery, the original non-table flow.
  // "dine-in" is a second sentinel, distinct from any real numbered table: the single generic
  // bucket shown instead of individual tables when the "tables" package feature is off (see the
  // Order view's table-switcher strip) — a restaurant that doesn't track individual tables still
  // wants to separate "eating here" from "takeaway/delivery" without naming/numbering tables.
  const tableLabel = (id) => {
    if (id === null || id === undefined) return t("takeawayLabel");
    if (id === "delivery") return t("deliveryLabel");
    if (id === "dine-in") return t("dineInLabel");
    return tableNames[id] || t("tableNumbered", { n: id });
  };
  const tableIds = useMemo(() => (tablesLoaded ? Array.from({ length: tableCount }, (_, i) => String(i + 1)) : []), [tableCount, tablesLoaded]);
  // Confirmed orders are kept around (not removed) so the customer's device can pick up the status
  // change — see markPendingOrderConfirmed — so every staff-facing view of "what's pending review"
  // needs to explicitly exclude them.
  const activePendingOrders = pendingOrders.filter((o) => o.status !== "confirmed");
  const pendingOrdersForTable = (id) => activePendingOrders.filter((o) => o.tableId === id);
  // How many items are sitting in a given table's in-progress order right now — checks the live
  // top-level cart if it's the currently active table, otherwise its stashed draft.
  const tableItemCount = (id) => {
    const key = id === null ? "takeaway" : id;
    if (id === activeTableId) return cart.length;
    return tableDrafts[key]?.cart?.length || 0;
  };
  const blankDraft = () => ({
    cart: [],
    // Deliberately not issued yet — see ensureTicketNo. Assigning a real number here would burn
    // one just from opening an empty table, which is exactly what made the sequence look random.
    ticketNo: null,
    paymentMethod: "cash",
    paidNow: true,
    splitAmounts: {},
    discount: null,
    splitCount: null,
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    orderEta: "",
    deliveryFee: 0,
    deliveryMethod: null,
    deliveryZoneLabel: "",
    assignedTo: null,
  });
  // Switches which table (or Takeaway/Delivery) the Order screen is currently building a ticket
  // for. Stashes the outgoing table's in-progress cart in memory and restores (or starts fresh)
  // the incoming one — so staff can hop between tables without losing anyone's order. These
  // drafts live only for this browser session; they're not persisted to storage.
  const switchTable = (nextId) => {
    if (nextId === activeTableId) return;
    const outgoingKey = activeTableId === null ? "takeaway" : activeTableId;
    const outgoingDraft = { cart, ticketNo, paymentMethod, paidNow, splitAmounts, discount, splitCount, customerName, customerPhone, customerAddress, orderEta, deliveryFee, deliveryMethod, deliveryZoneLabel, assignedTo };
    const incomingKey = nextId === null ? "takeaway" : nextId;
    let incoming = tableDrafts[incomingKey] || blankDraft();
    // Takeaway and Delivery are the same order with a different fulfilment — if the cashier flips
    // between them before confirming, bring the items (and the customer/payment details typed so
    // far) along instead of leaving them behind on the other tab. Only when the destination is
    // still empty, so it never overwrites or merges into an order already in progress there. The
    // delivery fee, zone and assignee stay behind — they only make sense for one of the two.
    const pickupDeliveryHop = (activeTableId === null && nextId === "delivery") || (activeTableId === "delivery" && nextId === null);
    const carryOver = pickupDeliveryHop && cart.length > 0 && !(incoming.cart && incoming.cart.length > 0);
    if (carryOver) {
      incoming = { ...blankDraft(), cart, ticketNo, paymentMethod, paidNow, splitAmounts, discount, splitCount, customerName, customerPhone, customerAddress, orderEta };
      if (nextId === "delivery" && customerAddress) {
        const addressWords = customerAddress.toLowerCase().split(/[\s,،/]+/).filter(Boolean);
        const zone = deliveryZones.find((z) => z.label.toLowerCase().split(/[\s,،/]+/).filter(Boolean).some((zw) => addressWords.includes(zw)));
        if (zone) incoming = { ...incoming, deliveryFee: zone.fee, deliveryZoneLabel: zone.label };
      }
    }
    const leftBehind = carryOver ? blankDraft() : outgoingDraft;
    setTableDrafts((prev) => ({ ...prev, [outgoingKey]: leftBehind }));
    setCart(incoming.cart);
    setTicketNo(incoming.ticketNo);
    setPaymentMethod(incoming.paymentMethod);
    setPaidNow(incoming.paidNow !== false);
    setSplitAmounts(incoming.splitAmounts || {});
    setDiscount(incoming.discount);
    setSplitCount(incoming.splitCount ?? null);
    setCustomerName(incoming.customerName);
    setCustomerPhone(incoming.customerPhone);
    setCustomerAddress(incoming.customerAddress);
    setOrderEta(incoming.orderEta);
    setDeliveryFee(incoming.deliveryFee || 0);
    // The "delivery" slot always means a delivery order — no need to make the cashier pick a
    // fulfillment method separately the way an online order's own choice would set it.
    setDeliveryMethod(nextId === "delivery" ? "delivery" : incoming.deliveryMethod || null);
    setDeliveryZoneLabel(incoming.deliveryZoneLabel || "");
    setAssignedTo(incoming.assignedTo || null);
    setDiscountOpen(false);
    setSplitOpen(false);
    setSplitDraft("");
    setShowCustomerSuggestions(false);
    setSaved(false);
    setActiveTableId(nextId);
  };
  // Defense in depth: if a specific numbered table was open when a manager turns the "tables"
  // package feature off (or the admin downgrades the package), don't leave that numbered ticket
  // active — drop back to the single "Dine In" bucket the simplified switcher now shows.
  useEffect(() => {
    if (!hasFeature("tables") && activeTableId !== null && activeTableId !== "dine-in") {
      switchTable("dine-in");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantStatus?.features]);
  const clearActiveTable = () => {
    setConfirmDialog({
      message: t("confirm_clearTable"),
      onConfirm: () => {
        const fresh = blankDraft();
        setCart(fresh.cart);
        setTicketNo(fresh.ticketNo);
        setPaymentMethod(fresh.paymentMethod);
        setPaidNow(fresh.paidNow);
        setSplitAmounts(fresh.splitAmounts);
        setDiscount(fresh.discount);
        setSplitCount(fresh.splitCount);
        setSplitOpen(false);
        setSplitDraft("");
        setCustomerName(fresh.customerName);
        setCustomerPhone(fresh.customerPhone);
        setCustomerAddress(fresh.customerAddress);
        setOrderEta(fresh.orderEta);
        setDeliveryFee(fresh.deliveryFee);
        setDeliveryMethod(fresh.deliveryMethod);
        setDeliveryZoneLabel(fresh.deliveryZoneLabel);
        setAssignedTo(fresh.assignedTo);
        const key = activeTableId === null ? "takeaway" : activeTableId;
        setTableDrafts((prev) => ({ ...prev, [key]: fresh }));
      },
    });
  };
  const updateTableName = (id, name) => {
    setTableNames((prev) => ({ ...prev, [id]: name }));
  };

  // Keeps a shared, cross-device copy of each table's current running order — the "one invoice
  // per table" a customer's QR checkout request reads (see CustomerMenuView) to show their bill
  // total, and what "Mark as paid" below falls back to if this terminal's own local draft was
  // lost to a refresh or was never loaded here (built up on a different terminal instead).
  // Merges rather than overwrites so a customer's in-flight checkout request isn't clobbered by
  // an unrelated item edit landing at the same time.
  const persistTableTab = async (tableId, items) => {
    if (tableId === null || tableId === undefined) return; // takeaway/delivery isn't a "table"
    const key = `table-tab:${tableId}`;
    if (!items || items.length === 0) {
      await storage.delete(key);
      return;
    }
    let existing = {};
    try {
      const res = await storage.get(key);
      existing = res?.value ? JSON.parse(res.value) : {};
    } catch (e) {
      // proceed without the existing checkout-request fields — worst case a concurrent request
      // gets briefly overwritten here and re-synced on its own next write
    }
    await storage.set(key, JSON.stringify({ ...existing, items, updatedAt: new Date().toISOString() }));
  };
  // Fires on every cart edit for whichever table is currently open in the Order screen — covers
  // switching tables, confirming a pending QR order, clearing a table, and finishing a sale
  // (cart resets to []), all without needing a separate call at each of those sites.
  useEffect(() => {
    persistTableTab(activeTableId, cart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, activeTableId]);

  // Bill requests a customer submits from their table's QR page (see CustomerMenuView's
  // requestCheckout) — polled the same way pending-orders is, since this is the one piece of
  // table-tab data that genuinely needs to be "live" across devices for staff to notice promptly.
  const [checkoutRequests, setCheckoutRequests] = useState([]);
  // Tracks which request ids this device has already alerted on, so the chime fires once per new
  // request rather than replaying on every 8s poll. Starts as null so the very first load (which
  // may already contain requests from before this device was watching) seeds the set silently
  // instead of chiming for every pre-existing one.
  const seenCheckoutRequestIds = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const loadRequests = async () => {
      try {
        const result = await storage.get("checkout-requests", true);
        if (cancelled) return;
        const next = result?.value ? JSON.parse(result.value) : [];
        if (seenCheckoutRequestIds.current === null) {
          seenCheckoutRequestIds.current = new Set(next.map((r) => r.id));
        } else {
          const isNew = next.some((r) => !seenCheckoutRequestIds.current.has(r.id));
          if (isNew) playNotificationChime();
          seenCheckoutRequestIds.current = new Set(next.map((r) => r.id));
        }
        setCheckoutRequests(next);
      } catch (e) {
        // leave whatever was there before — a transient failure shouldn't wipe the list
      }
    };
    loadRequests();
    // Kept fresh by the shared live-sync timer below (one batched request for everything).
    return () => {
      cancelled = true;
    };
  }, []);
  const checkoutRequestForTable = (id) => checkoutRequests.find((r) => r.tableId === id);
  const clearCheckoutRequest = async (tableId) => {
    let latest;
    try {
      const result = await storage.get("checkout-requests", true);
      latest = result?.value ? JSON.parse(result.value) : [];
    } catch (e) {
      latest = checkoutRequests;
    }
    const next = latest.filter((r) => r.tableId !== tableId);
    setCheckoutRequests(next);
    await syncSet("checkout-requests", JSON.stringify(next), true, t("syncLabelOrders"));
  };

  const [payTableModal, setPayTableModal] = useState(null); // { tableId, items, paymentMethod } | null
  // "Mark as paid" in the Tables tab — reads the table's SHARED tab (not just this terminal's
  // local draft) so it works correctly even after a refresh, or for a table this terminal never
  // actively opened. Falls back to the local draft only if the shared read itself fails.
  const openPayTableModal = async (tableId) => {
    let items = [];
    try {
      const res = await storage.get(`table-tab:${tableId}`);
      const parsed = res?.value ? JSON.parse(res.value) : null;
      items = parsed?.items || [];
    } catch (e) {
      items = tableId === activeTableId ? cart : tableDrafts[tableId]?.cart || [];
    }
    if (items.length === 0) {
      flashNotice(t("notice_tableEmpty"));
      return;
    }
    // The payment method the customer picked when requesting checkout lives in the separate
    // checkout-requests list (see requestCheckout in CustomerMenuView), not on the table-tab
    // entry itself — checkoutRequests is already polled, so this is just a lookup.
    const requestedPaymentMethod = checkoutRequestForTable(tableId)?.paymentMethod || null;
    setPayTableModal({ tableId, items, paymentMethod: requestedPaymentMethod || "cash", splitAmounts: {} });
  };
  // Finalizes a table's bill directly from the Tables tab — the same shape of work saveOrder()
  // does for the actively-open table, but sourced from the table's tab (shared or local) rather
  // than requiring staff to switch to that table in the Order screen first.
  const confirmTablePayment = async () => {
    if (!payTableModal || confirmingTablePayment) return;
    setConfirmingTablePayment(true);
    const { tableId, items, paymentMethod, splitAmounts: tableSplitAmounts } = payTableModal;

    const modalSubtotalForValidation = items.reduce((s, i) => s + i.price * i.qty, 0);
    const modalServicePercent = hasFeature("vatService") ? servicePercent : 0;
    const modalVatPercent = hasFeature("vatService") ? vatPercent : 0;
    const modalSvcAmt = Math.round(modalSubtotalForValidation * (modalServicePercent / 100) * 100) / 100;
    const modalVtAmt = Math.round((modalSubtotalForValidation + modalSvcAmt) * (modalVatPercent / 100) * 100) / 100;
    const modalGrandTotal = modalSubtotalForValidation + modalSvcAmt + modalVtAmt;
    const splitPayments = paymentMethod === "split"
      ? PAYMENT_METHODS.map((m) => ({ method: m.id, amount: Math.round((Number(tableSplitAmounts?.[m.id]) || 0) * 100) / 100 })).filter((sp) => sp.amount > 0)
      : null;
    if (paymentMethod === "split") {
      const splitSum = splitPayments.reduce((s, sp) => s + sp.amount, 0);
      if (splitPayments.length < 2 || Math.abs(splitSum - modalGrandTotal) > 0.01) {
        flashNotice(t("notice_splitPaymentMismatch", { amount: money(modalGrandTotal) }));
        setConfirmingTablePayment(false);
        return;
      }
    }

    items.forEach((cartItem) => {
      const menuItem = findMenuItemAnywhere(cartItem.id);
      (menuItem?.recipe || []).forEach((r) => updateIngredientStock(r.ingredientId, -r.qty * cartItem.qty));
    });

    const itemsSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const tablePaymentServicePercent = hasFeature("vatService") ? servicePercent : 0;
    const tablePaymentVatPercent = hasFeature("vatService") ? vatPercent : 0;
    const svcAmt = Math.round(itemsSubtotal * (tablePaymentServicePercent / 100) * 100) / 100;
    const vtAmt = Math.round((itemsSubtotal + svcAmt) * (tablePaymentVatPercent / 100) * 100) / 100;
    const grandTotal = itemsSubtotal + svcAmt + vtAmt;
    const ticketForThisTable = tableId === activeTableId ? ensureTicketNo() : (tableDrafts[tableId]?.ticketNo || issueTicketNumber());

    const receipt = {
      id: `${ticketForThisTable}-${Date.now()}`,
      ticketNo: ticketForThisTable,
      timestamp: new Date().toISOString(),
      table: tableLabel(tableId),
      tableId,
      servedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
      assignedTo: (tableId === activeTableId ? assignedTo : tableDrafts[tableId]?.assignedTo) || null,
      items: items.map((c) => {
        const menuItem = findMenuItemAnywhere(c.id);
        return { id: c.id, name: c.name, qty: c.qty, price: c.price, note: c.note || "", recipeSnapshot: menuItem?.recipe || [] };
      }),
      subtotal: itemsSubtotal,
      discount: null,
      discountAmount: 0,
      serviceRate: tablePaymentServicePercent,
      serviceAmount: svcAmt,
      vatRate: tablePaymentVatPercent,
      vatAmount: vtAmt,
      deliveryFee: 0,
      deliveryMethod: null,
      deliveryZoneLabel: "",
      total: grandTotal,
      splitCount: null,
      paymentMethod,
      splitPayments,
      paid: true,
      paidAt: new Date().toISOString(),
      customer: null,
      eta: "",
      status: "completed",
      fulfillmentStatus: "placed",
      whatsappLog: [],
    };

    await appendReceipt(thisMonthKey(), receipt);
    await persistTableTab(tableId, []);
    await clearCheckoutRequest(tableId);

    if (tableId === activeTableId) {
      const fresh = blankDraft();
      setCart(fresh.cart);
      setTicketNo(fresh.ticketNo);
      setDiscount(fresh.discount);
      setSplitCount(fresh.splitCount);
      setDeliveryFee(fresh.deliveryFee);
      setDeliveryMethod(fresh.deliveryMethod);
      setDeliveryZoneLabel(fresh.deliveryZoneLabel);
      setAssignedTo(fresh.assignedTo);
      setPaymentMethod(fresh.paymentMethod);
      setPaidNow(fresh.paidNow);
      setSplitAmounts(fresh.splitAmounts);
      setSaved(false);
      setTableDrafts((prev) => ({ ...prev, [tableId]: fresh }));
    } else {
      setTableDrafts((prev) => ({ ...prev, [tableId]: blankDraft() }));
    }

    flashNotice(t("notice_paymentConfirmed", { table: tableLabel(tableId) }));
    setPayTableModal(null);
    setConfirmingTablePayment(false);
  };

  // Removes an order from the shared pending-orders list. Re-reads the list right before writing
  // so a second device's write in between (e.g. another order coming in) isn't clobbered — but
  // falls back to this device's own in-memory copy if that read fails (most likely offline), so
  // staff can still confirm/reject orders without a live connection; the removal syncs once back
  // online.
  const removePendingOrder = async (orderId) => {
    let latest;
    try {
      const result = await storage.get("pending-orders", true);
      latest = result?.value ? JSON.parse(result.value) : [];
    } catch (e) {
      latest = pendingOrders;
    }
    const next = latest.filter((o) => o.id !== orderId);
    setPendingOrders(next);
    await syncSet("pending-orders", JSON.stringify(next), true, t("syncLabelOrders"));
  };
  // Marks an order confirmed instead of removing it outright, so the customer's own device (still
  // polling this same shared list for its order id) can pick up the status change and show
  // "confirmed, being prepared" feedback. Confirmed orders older than 30 minutes are pruned on
  // every write so the list doesn't grow unbounded once nobody's device is polling for them anymore.
  const markPendingOrderConfirmed = async (orderId) => {
    let latest;
    try {
      const result = await storage.get("pending-orders", true);
      latest = result?.value ? JSON.parse(result.value) : [];
    } catch (e) {
      latest = pendingOrders;
    }
    const cutoff = Date.now() - 30 * 60 * 1000;
    const next = latest
      .filter((o) => o.status !== "confirmed" || new Date(o.confirmedAt || 0).getTime() > cutoff)
      .map((o) => (o.id === orderId ? { ...o, status: "confirmed", confirmedAt: new Date().toISOString() } : o));
    setPendingOrders(next);
    await syncSet("pending-orders", JSON.stringify(next), true, t("syncLabelOrders"));
  };
  // Pulls a customer-submitted order's items into that table's ticket. If the table is the one
  // currently open in the Order screen, merges straight into the live cart; otherwise merges into
  // its stashed draft so it's there waiting the next time staff switches to it. Existing lines for
  // the same item get their quantity bumped rather than duplicated.
  const mergeItemsIntoCart = (existingCart, items) => {
    const next = [...existingCart];
    items.forEach((it) => {
      const noteKey = it.note || "";
      const idx = next.findIndex((c) => c.id === it.id && (c.note || "") === noteKey);
      if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + it.qty };
      else next.push({ id: it.id, name: it.name, price: it.price, qty: it.qty, note: noteKey, lineId: newId("line") });
    });
    return next;
  };
  const confirmPendingOrder = (order) => {
    const targetId = order.tableId;
    const orderDeliveryFee = order.deliveryFee || 0;
    const orderFulfillmentType = order.deliveryMethod || null;
    const orderZoneLabel = order.deliveryZoneLabel || "";
    if (targetId === activeTableId) {
      // Already viewing this table — merge straight into the live cart.
      setCart((prev) => mergeItemsIntoCart(prev, order.items));
      if (orderFulfillmentType) {
        setDeliveryFee(orderDeliveryFee);
        setDeliveryMethod(orderFulfillmentType);
        setDeliveryZoneLabel(orderZoneLabel);
      }
      if (order.customer) {
        setCustomerName(order.customer.name || "");
        setCustomerPhone(order.customer.phone || "");
        setCustomerAddress(order.customer.address || "");
      }
    } else {
      // Switching to a different table: stash the currently active table's live state into its
      // draft, and load the target table's draft — with the new items merged in — into the live
      // state, all from one consistent snapshot. (Calling the separate switchTable() helper here
      // instead would read tableDrafts via a stale closure, since React batches the state update
      // from a merge and the switch together — that would silently drop the merged items.)
      const outgoingKey = activeTableId === null ? "takeaway" : activeTableId;
      const outgoingDraft = { cart, ticketNo, paymentMethod, paidNow, splitAmounts, discount, splitCount, customerName, customerPhone, customerAddress, orderEta, deliveryFee, deliveryMethod, deliveryZoneLabel, assignedTo };
      const incomingExisting = tableDrafts[targetId] || blankDraft();
      const incoming = {
        ...incomingExisting,
        cart: mergeItemsIntoCart(incomingExisting.cart, order.items),
        // A confirmed online order carries its own fulfillment context (pickup/delivery + fee) —
        // overwrite the target draft's with it rather than merging two different fulfillment
        // contexts together.
        deliveryFee: orderFulfillmentType ? orderDeliveryFee : incomingExisting.deliveryFee || 0,
        deliveryMethod: orderFulfillmentType || incomingExisting.deliveryMethod || null,
        deliveryZoneLabel: orderFulfillmentType ? orderZoneLabel : incomingExisting.deliveryZoneLabel || "",
        customerName: order.customer ? order.customer.name || "" : incomingExisting.customerName,
        customerPhone: order.customer ? order.customer.phone || "" : incomingExisting.customerPhone,
        customerAddress: order.customer ? order.customer.address || "" : incomingExisting.customerAddress,
      };
      setTableDrafts((prev) => ({ ...prev, [outgoingKey]: outgoingDraft, [targetId]: incoming }));
      setCart(incoming.cart);
      setTicketNo(incoming.ticketNo);
      setPaymentMethod(incoming.paymentMethod);
      setPaidNow(incoming.paidNow !== false);
      setSplitAmounts(incoming.splitAmounts || {});
      setDiscount(incoming.discount);
      setSplitCount(incoming.splitCount ?? null);
      setCustomerName(incoming.customerName);
      setCustomerPhone(incoming.customerPhone);
      setCustomerAddress(incoming.customerAddress);
      setOrderEta(incoming.orderEta);
      setDeliveryFee(incoming.deliveryFee || 0);
      setDeliveryMethod(incoming.deliveryMethod || null);
      setDeliveryZoneLabel(incoming.deliveryZoneLabel || "");
      setAssignedTo(incoming.assignedTo || null);
      setDiscountOpen(false);
      setSplitOpen(false);
      setSplitDraft("");
      setShowCustomerSuggestions(false);
      setSaved(false);
      setActiveTableId(targetId);
    }
    markPendingOrderConfirmed(order.id);
    flashNotice(t("notice_orderConfirmed", { table: tableLabel(targetId) }));
    setView("order");
    setReviewTableId(undefined);
  };
  const rejectPendingOrder = (order) => {
    setConfirmDialog({
      message: t("confirm_rejectOrder"),
      onConfirm: () => {
        removePendingOrder(order.id);
        flashNotice(t("notice_orderRejected"));
      },
    });
  };

  const ensureMonthLoaded = async (monthKey) => {
    if (receiptsByMonth[monthKey] !== undefined) return receiptsByMonth[monthKey];
    setLoadingMonth(true);
    let list = [];
    try {
      const result = await storage.get(`receipts:${monthKey}`, false);
      if (result && result.value) list = JSON.parse(result.value);
      if (result && result.updated_at) dataVersionsRef.current[`receipts:${monthKey}`] = result.updated_at;
    } catch (e) {
      list = [];
    }
    setReceiptsByMonth((prev) => ({ ...prev, [monthKey]: list }));
    setLoadingMonth(false);
    return list;
  };

  // Re-fetches a month's receipts regardless of what's already cached — used to keep the open-shift
  // detail modal live while it's watching a shift that's still in progress on (possibly) another device.
  // Re-reads one stored record only if it changed since this device last read it, then hands the new value
  // to `apply`. Returns quietly on any failure (offline, a hiccup) and keeps what is already on screen.
  const syncStoredKey = async (key, apply) => {
    const since = dataVersionsRef.current[key];
    try {
      const res = since ? await storage.getIfChanged(key, since) : await storage.get(key, true);
      if (res.unchanged) return;
      if (res.updated_at) dataVersionsRef.current[key] = res.updated_at;
      apply(res.value);
    } catch (e) {
      // keep what we have
    }
  };
  const refreshMonthLoaded = (monthKey) =>
    syncStoredKey(`receipts:${monthKey}`, (value) => setReceiptsByMonth((prev) => ({ ...prev, [monthKey]: value ? JSON.parse(value) : [] })));
  const refreshExpenseMonthLoaded = (monthKey) =>
    syncStoredKey(`expenses:${monthKey}`, (value) => setExpensesByMonth((prev) => ({ ...prev, [monthKey]: value ? JSON.parse(value) : [] })));
  // The one timer behind every live screen. Every few seconds it asks the server ONE question — "which of
  // these records changed?" — and only records that did come back with their value. It replaces what used to
  // be dozens of separate polls per terminal (pending orders, open shifts, out-of-stock flags, checkout
  // requests, plus every cached month of receipts and expenses), which is what made the hosting bill grow.
  //  - customer orders and bill requests: checked every 10 s (staff must notice them quickly)
  //  - everything else: every 30 s
  //  - nothing is asked while the page is hidden, and a short pause follows this device's own writes so a
  //    half-saved local change is never overwritten by an older copy.
  useEffect(() => {
    const parse = (v, fallback) => (v ? JSON.parse(v) : fallback);
    const subs = {
      "pending-orders": { every: 10000, apply: (v) => { setPendingOrders(parse(v, [])); pendingFetchedOkRef.current = true; setPendingOrdersLoaded(true); } },
      "checkout-requests": {
        every: 10000,
        apply: (v) => {
          const next = parse(v, []);
          if (seenCheckoutRequestIds.current === null) {
            seenCheckoutRequestIds.current = new Set(next.map((r) => r.id));
          } else {
            const isNew = next.some((r) => !seenCheckoutRequestIds.current.has(r.id));
            if (isNew) playNotificationChime();
            seenCheckoutRequestIds.current = new Set(next.map((r) => r.id));
          }
          setCheckoutRequests(next);
        },
      },
      // Only the device set up as the kitchen printer asks for this one.
      "kitchen-queue": { every: 10000, only: () => kitchenModeRef.current === "station", apply: (v) => { kitchenHandlerRef.current(parseKitchenQueue(v)); } },
      "open-shifts": { every: 30000, apply: (v) => { setOpenShifts(parse(v, {})); setOpenShiftsLoaded(true); } },
      "item-out-of-stock": {
        every: 30000,
        apply: (v) => {
          // While one of this device's own writes is in flight, ignore the poll (and try again next time).
          if (manualOutWritesRef.current > 0) return false;
          setManualOutOfStock(parse(v, {}));
          setManualOutLoaded(true);
        },
      },
    };
    const applyDynamic = (key, v) => {
      if (key.startsWith("receipts:")) {
        const mk = key.slice("receipts:".length);
        setReceiptsByMonth((prev) => ({ ...prev, [mk]: parse(v, []) }));
      } else if (key.startsWith("expenses:")) {
        const mk = key.slice("expenses:".length);
        setExpensesByMonth((prev) => ({ ...prev, [mk]: parse(v, []) }));
      } else if (key === "shift-log") {
        setShiftLog(parse(v, []));
      }
    };
    const last = {};
    let inFlight = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (inFlight) return;
      const now = Date.now();
      const keys = [];
      Object.entries(subs).forEach(([k, s]) => {
        if (s.only && !s.only()) return;
        if (now - (last[k] || 0) >= s.every - 500) keys.push(k);
      });
      if (now - lastLocalWriteRef.current >= 6000) {
        const dynamic = [
          ...Object.keys(receiptsByMonthRef.current).map((mk) => `receipts:${mk}`),
          ...Object.keys(expensesByMonthRef.current).map((mk) => `expenses:${mk}`),
          ...(shiftLogLoadedRef.current ? ["shift-log"] : []),
        ];
        dynamic.forEach((k) => {
          if (now - (last[k] || 0) >= 30000 - 500) keys.push(k);
        });
      }
      if (keys.length === 0) return;
      inFlight = true;
      try {
        const results = await storage.getMany(keys, dataVersionsRef.current);
        keys.forEach((k) => (last[k] = now));
        keys.forEach((k) => {
          const r = results[k];
          if (!r || r.unchanged) return;
          const applied = subs[k] ? subs[k].apply(r.value) : applyDynamic(k, r.value);
          if (applied !== false) dataVersionsRef.current[k] = r.updated_at || "none";
        });
      } catch (e) {
        // offline or a hiccup: keep what is on screen and try again next time
      } finally {
        inFlight = false;
      }
    };
    const id = setInterval(tick, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Receipts tab: which month(s) to fetch depends on its own Month/Day/Range toggle, widened one
  // month either side the same way the Dashboard's loading effects are (see businessDateForTimestamp
  // — a receipt's business date can spill into a neighboring month's storage bucket).
  useEffect(() => {
    if (receiptsFilterMode === "range") {
      const end = receiptsFilterRangeEnd || todayLocalStr();
      const start = receiptsFilterRangeStart || addDaysStr(end, -6);
      const [s, e] = start <= end ? [start, end] : [end, start];
      const reportingKeys = monthKeysInRange(s, e);
      const storageKeys = new Set(reportingKeys.flatMap((mk) => [prevMonthKey(mk), mk, nextMonthKey(mk)]));
      storageKeys.forEach((mk) => ensureMonthLoaded(mk));
      return;
    }
    const monthKey = receiptsFilterMode === "day"
      ? (receiptsFilterDay || todayLocalStr()).slice(0, 7)
      : selectedMonth || thisMonthKey();
    [prevMonthKey(monthKey), monthKey, nextMonthKey(monthKey)].forEach((mk) => ensureMonthLoaded(mk));
  }, [receiptsFilterMode, selectedMonth, receiptsFilterDay, receiptsFilterRangeStart, receiptsFilterRangeEnd]);
  useEffect(() => {
    ensureMonthLoaded(thisMonthKey());
  }, []);
  useEffect(() => {
    if (shiftStart) monthKeysInRange(storageMonthOf(shiftStart), thisMonthKey()).forEach((mk) => ensureMonthLoaded(mk));
  }, [shiftStart]);
  useEffect(() => {
    if (selectedExpenseMonth) ensureExpenseMonthLoaded(selectedExpenseMonth);
  }, [selectedExpenseMonth]);
  useEffect(() => {
    ensureExpenseMonthLoaded(thisMonthKey());
  }, []);
  // Expenses tab, Day / Range mode: fetch every month the chosen period touches.
  useEffect(() => {
    if (expenseFilterMode === "day") {
      ensureExpenseMonthLoaded((expenseFilterDay || todayLocalStr()).slice(0, 7));
    } else if (expenseFilterMode === "range") {
      const end = expenseFilterRangeEnd || todayLocalStr();
      const start = expenseFilterRangeStart || addDaysStr(end, -6);
      const [a, b] = start <= end ? [start, end] : [end, start];
      monthKeysInRange(a, b).forEach((mk) => ensureExpenseMonthLoaded(mk));
    }
  }, [expenseFilterMode, expenseFilterDay, expenseFilterRangeStart, expenseFilterRangeEnd]);
  useEffect(() => {
    const monthKey = dashboardMode === "day" ? (dashboardDay || todayLocalStr()).slice(0, 7) : dashboardMonth || monthLocalKey();
    // Widened one month either side — a receipt's business date (see businessDateForTimestamp)
    // can land a day, and therefore a month, earlier than the real timestamp it was filed under.
    [prevMonthKey(monthKey), monthKey, nextMonthKey(monthKey)].forEach((mk) => ensureMonthLoaded(mk));
    ensureExpenseMonthLoaded(monthKey);
  }, [dashboardMode, dashboardMonth, dashboardDay]);
  // A custom day range can span multiple months (or years), unlike the single-month/single-day
  // modes above — every month touched by the selected range needs its own fetch (plus, same as
  // above, one month either side of the whole span for business-date spillover).
  useEffect(() => {
    if (dashboardMode !== "range") return;
    const end = dashboardRangeEnd || todayLocalStr();
    const start = dashboardRangeStart || addDaysStr(end, -6);
    const [s, e] = start <= end ? [start, end] : [end, start];
    const reportingKeys = monthKeysInRange(s, e);
    const storageKeys = new Set(reportingKeys.flatMap((mk) => [prevMonthKey(mk), mk, nextMonthKey(mk)]));
    storageKeys.forEach((mk) => ensureMonthLoaded(mk));
    reportingKeys.forEach((mk) => ensureExpenseMonthLoaded(mk));
  }, [dashboardMode, dashboardRangeStart, dashboardRangeEnd]);
  // Delivery tab's employee report: fetch every month its dates touch (plus one either side, for
  // the same business-date spillover as the Dashboard).
  useEffect(() => {
    if (view !== "delivery") return;
    const end = riderReportTo || todayLocalStr();
    const start = riderReportFrom || end;
    const [s, e] = start <= end ? [start, end] : [end, start];
    storageMonthKeysFor(monthKeysInRange(s, e)).forEach((mk) => ensureMonthLoaded(mk));
  }, [view, riderReportFrom, riderReportTo]);

  // Tracks connectivity and retries failed writes automatically once back online. Restaurant-wide
  // data now lives in a real tenant-scoped Postgres table via lib/tenantStorage.js (see
  // db/schema.sql's tenant_pos_kv), reached over the network same as before — a lost connection
  // still means "offline mode" here: stay fully usable while offline (everything already runs off
  // in-memory React state moment to moment), track what failed to save, and sync it the moment
  // connectivity returns. It does NOT mean data survives a refresh or closed tab while offline —
  // that would need real local persistence (IndexedDB, etc.), which this app still doesn't use for
  // restaurant-wide data; only the handful of genuinely device-local keys (current-employee,
  // shift-start, ui-lang) are in localStorage and do survive a refresh.
  //
  // Three independent triggers, since no single signal is reliable enough on its own here: the
  // browser's "online" event (fires immediately when it fires, but some browsers/OSes/embedded
  // WebViews don't fire it consistently), a short periodic sweep as backup, and a check whenever
  // the tab/app becomes visible again (the common mobile case — connectivity often changes while
  // backgrounded, and reopening the app is exactly when someone expects it to have caught up).
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      flushSyncQueue();
      if (rosterLoadFailed) retryRosterLoad();
      if (menuLoadFailed) retryMenuLoad();
      if (menuProfilesLoadFailed) retryMenuProfilesLoad();
      if (tablesLoadFailed) retryTablesLoad();
      if (taxConfigLoadFailed) retryTaxConfigLoad();
      if (deliveryShareConfigLoadFailed) retryDeliveryShareConfigLoad();
      if (uiThemeLoadFailed) retryUiThemeLoad();
    };
    const goOffline = () => setIsOnline(false);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (syncQueueRef.current.length > 0) flushSyncQueue();
      if (rosterLoadFailedRef.current) retryRosterLoad();
      if (menuLoadFailedRef.current) retryMenuLoad();
      if (menuProfilesLoadFailedRef.current) retryMenuProfilesLoad();
      if (tablesLoadFailedRef.current) retryTablesLoad();
      if (taxConfigLoadFailedRef.current) retryTaxConfigLoad();
      if (deliveryShareConfigLoadFailedRef.current) retryDeliveryShareConfigLoad();
      if (uiThemeLoadFailedRef.current) retryUiThemeLoad();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [rosterLoadFailed, menuLoadFailed, menuProfilesLoadFailed, tablesLoadFailed, taxConfigLoadFailed, deliveryShareConfigLoadFailed, uiThemeLoadFailed]);
  useEffect(() => {
    const interval = setInterval(() => {
      // No longer gated on navigator.onLine — that flag is exactly what's unreliable here, so
      // gating retries on it risked never even trying when the real connection was actually fine.
      if (syncQueueRef.current.length > 0) flushSyncQueue();
      if (rosterLoadFailedRef.current) retryRosterLoad();
      if (menuLoadFailedRef.current) retryMenuLoad();
      if (menuProfilesLoadFailedRef.current) retryMenuProfilesLoad();
      if (tablesLoadFailedRef.current) retryTablesLoad();
      if (taxConfigLoadFailedRef.current) retryTaxConfigLoad();
      if (deliveryShareConfigLoadFailedRef.current) retryDeliveryShareConfigLoad();
      if (uiThemeLoadFailedRef.current) retryUiThemeLoad();
    }, 3000); // short enough that automatic recovery feels immediate, not just "eventually"
    return () => clearInterval(interval);
  }, []);
  // Queues a write for retry, replacing any earlier queued write to the same key so a burst of
  // rapid edits made while offline (e.g. several stock adjustments) doesn't pile up stale copies —
  // only the latest value per key is ever kept and eventually synced.
  const queueForSync = (label, key, value, shared) => {
    setSyncQueue((prev) => [...prev.filter((t) => t.key !== key), { id: `${key}_${Date.now()}`, label, key, value, shared }]);
  };
  const retrySyncTask = async (task) => {
    try {
      const result = await storage.set(task.key, task.value, task.shared);
      if (result) {
        setSyncQueue((prev) => prev.filter((t) => t.id !== task.id));
        setIsOnline(true); // a write just succeeded — whatever navigator.onLine claims, we're clearly connected
        return true;
      }
    } catch (e) {
      // stays queued — will retry on the next flush
    }
    return false;
  };
  const flushSyncQueue = () => {
    syncQueueRef.current.forEach((task) => retrySyncTask(task));
  };
  // Every shared/personal write in this app should go through here instead of calling
  // storage.set directly, so a failure (almost always meaning "currently offline") is
  // captured and retried automatically rather than silently discarded. This is also the real
  // source of truth for the isOnline indicator — a successful write proves connectivity more
  // reliably than navigator.onLine does, and a failure is a real signal something's actually wrong.
  const syncSet = async (key, value, shared, label) => {
    lastLocalWriteRef.current = Date.now();
    delete dataVersionsRef.current[key];
    try {
      const result = await storage.set(key, value, shared);
      if (!result) throw new Error("no result");
      setSyncQueue((prev) => prev.filter((t) => t.key !== key));
      setIsOnline(true);
      return true;
    } catch (e) {
      queueForSync(label, key, value, shared);
      setIsOnline(false);
      return false;
    }
  };
  const retryRosterLoad = async () => {
    try {
      const result = await getSharedWithRetry(storage, "staff-roster");
      setEmployees(result?.value ? JSON.parse(result.value) : []);
      setRosterLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  const retryMenuLoad = async () => {
    try {
      const [result, ingResult] = await Promise.all([
        getSharedWithRetry(storage, "menu-config"),
        getSharedWithRetry(storage, "ingredients-config"),
      ]);
      const parsed = result?.value ? JSON.parse(result.value) : null;
      if (parsed) {
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.menu) setMenu(parsed.menu);
        setMainCategories(cleanMains(parsed.mainCategories));
      } else {
        setCategories(Object.keys(INITIAL_MENU));
        setMenu(INITIAL_MENU);
      }
      if (ingResult?.value) setIngredients(JSON.parse(ingResult.value));
      else setIngredients(INITIAL_INGREDIENTS);
      setMenuLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  const retryMenuProfilesLoad = async () => {
    try {
      const result = await getSharedWithRetry(storage, "menu-profiles-config");
      const parsed = result?.value ? JSON.parse(result.value) : null;
      if (Array.isArray(parsed)) setMenuProfiles(parsed);
      setMenuProfilesLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  const retryTablesLoad = async () => {
    try {
      const result = await getSharedWithRetry(storage, "tables-config");
      const parsed = result?.value ? JSON.parse(result.value) : null;
      if (parsed) {
        setTableCount(Number(parsed.count) > 0 ? Number(parsed.count) : 12);
        setTableNames(parsed.names || {});
      }
      setTablesLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  const retryTaxConfigLoad = async () => {
    try {
      const result = await getSharedWithRetry(storage, "tax-config");
      const parsed = result?.value ? JSON.parse(result.value) : null;
      if (parsed) {
        setVatPercent(Number(parsed.vatPercent) || 0);
        setServicePercent(Number(parsed.servicePercent) || 0);
      }
      setTaxConfigLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  const retryDeliveryShareConfigLoad = async () => {
    try {
      const result = await getSharedWithRetry(storage, "delivery-share-config");
      const parsed = result?.value ? JSON.parse(result.value) : null;
      if (parsed && parsed.agentSharePercent !== undefined && parsed.retentionMode === undefined) {
        setDeliveryFeeRetentionMode("percentage");
        setDeliveryFeeRetentionPercent(Math.max(0, Math.min(100, 100 - Number(parsed.agentSharePercent))));
      } else if (parsed) {
        setDeliveryFeeRetentionMode(parsed.retentionMode === "fixed" ? "fixed" : "percentage");
        setDeliveryFeeRetentionPercent(Number(parsed.retentionPercent) || 0);
        setDeliveryFeeRetentionFixed(Number(parsed.retentionFixed) || 0);
      }
      setDeliveryShareConfigLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  const retryUiThemeLoad = async () => {
    try {
      const result = await getSharedWithRetry(storage, "ui-theme-config");
      const parsed = result?.value ? JSON.parse(result.value) : null;
      if (parsed?.theme === "light" || parsed?.theme === "dark") setUiTheme(parsed.theme);
      setUiThemeLoadFailed(false);
    } catch (e) {
      // still offline/unreachable — stays in the failed state, will try again on the next signal
    }
  };
  // One combined sync instead of seven near-identical effects — keeps every "did this config's
  // load actually fail" ref current after every render so the retry triggers below (which live
  // inside listeners/intervals and would otherwise close over stale state) always see the latest.
  useEffect(() => {
    rosterLoadFailedRef.current = rosterLoadFailed;
    menuLoadFailedRef.current = menuLoadFailed;
    menuProfilesLoadFailedRef.current = menuProfilesLoadFailed;
    tablesLoadFailedRef.current = tablesLoadFailed;
    taxConfigLoadFailedRef.current = taxConfigLoadFailed;
    deliveryShareConfigLoadFailedRef.current = deliveryShareConfigLoadFailed;
    uiThemeLoadFailedRef.current = uiThemeLoadFailed;
  });

  // Hands out the next ticket number and advances the shared counter. Uses the ref (not state)
  // so a burst of tickets issued in quick succession — e.g. several tables opened back to back —
  // each get a distinct number instead of racing against a stale render's snapshot. Two different
  // terminals issuing a ticket at the exact same instant could in principle still collide, since
  // there's no real transactional backend here to prevent it — an acceptable, rare edge case for
  // a display number, not something the business logic depends on being unique.
  const issueTicketNumber = () => {
    // The business day, not the UTC date: with a 08:00–04:00 shift, a UTC-midnight reset restarted
    // the numbering at 03:00 in the middle of the night shift, so two tickets could share a number.
    const today = businessDateForTimestamp(new Date().toISOString(), shiftHoursRef.current);
    if (ticketCounterRef.current.date !== today) {
      ticketCounterRef.current = { date: today, next: 1 }; // new business day — start the count over at 1
    }
    const n = ticketCounterRef.current.next;
    ticketCounterRef.current = { ...ticketCounterRef.current, next: n + 1 };
    syncSet("ticket-counter", JSON.stringify(ticketCounterRef.current), true, t("syncLabelSettings"));
    return String(n);
  };
  // Assigns this ticket's real number the first time it's actually needed — printing, downloading,
  // or saving — rather than the moment the table/ticket is opened. Caches it on first call so
  // repeated prints of the same still-open ticket don't each mint a new number.
  const ensureTicketNo = () => {
    if (ticketNo) return ticketNo;
    const n = issueTicketNumber();
    setTicketNo(n);
    return n;
  };

  const persistMonth = async (monthKey, updatedList) => {
    setReceiptsByMonth((prev) => ({ ...prev, [monthKey]: updatedList }));
    if (!monthKeys.includes(monthKey)) setMonthKeys((prev) => [monthKey, ...prev].sort().reverse());
    return syncSet(`receipts:${monthKey}`, JSON.stringify(updatedList), false, t("syncLabelOrders"));
  };
  // Re-fetches a month's receipts straight from the server instead of trusting this device's
  // local cache, which can be minutes or hours stale. Every write below (appendReceipt,
  // updateReceiptInStorage) builds its new list from THIS, not from receiptsByMonth — otherwise
  // two devices saving/cancelling/editing orders around the same time would race: whichever
  // writes second replaces the whole month with its own stale snapshot plus its one change,
  // silently erasing every receipt the other device saved in between. Falls back to the local
  // cache only if the fresh read itself fails, so a real offline moment still degrades gracefully
  // instead of blocking the save outright.
  const fetchFreshMonth = async (monthKey) => {
    try {
      const result = await storage.get(`receipts:${monthKey}`, false);
      return result?.value ? JSON.parse(result.value) : [];
    } catch (e) {
      return receiptsByMonth[monthKey] || [];
    }
  };
  const appendReceipt = async (monthKey, receipt) => {
    const existing = await fetchFreshMonth(monthKey);
    return persistMonth(monthKey, [receipt, ...existing]);
  };
  // Resolves and updates a receipt directly in its own real storage month, rather than assuming
  // it's whichever month happens to be currently selected in the Receipts tab — needed now that
  // Receipts, like the Dashboard, can show a day/range whose business dates (see
  // businessDateForTimestamp) spill into a neighboring month's storage bucket.
  const updateReceiptInStorage = async (r, updater) => {
    const monthKey = new Date(r.timestamp).toISOString().slice(0, 7);
    const list = await fetchFreshMonth(monthKey);
    return persistMonth(monthKey, list.map((x) => (x.id === r.id ? updater(x) : x)));
  };
  // Shared by Dashboard and Receipts: widens a set of "reporting" months by one month either side,
  // then filters receipts from that wider pool back down to exactly the reporting months by their
  // real business date — see the note on dashboardStorageMonthKeys for why the widening is needed.
  const storageMonthKeysFor = (reportingMonthKeys) => Array.from(new Set(reportingMonthKeys.flatMap((mk) => [prevMonthKey(mk), mk, nextMonthKey(mk)])));
  const receiptsForReportingMonths = (reportingMonthKeys, extraFilter = () => true) =>
    storageMonthKeysFor(reportingMonthKeys)
      .flatMap((mk) => receiptsByMonth[mk] || [])
      .filter((r) => reportingMonthKeys.includes(businessDateForTimestamp(r.timestamp, shiftHoursConfig).slice(0, 7)) && extraFilter(r));

  // --- Expenses (mirrors the receipts monthly-storage pattern above, but shared across
  // terminals rather than personal — a supplier payment logged on one device should be visible
  // to a manager checking from another) ---
  const ensureExpenseMonthLoaded = async (monthKey) => {
    if (expensesByMonth[monthKey] !== undefined) return expensesByMonth[monthKey];
    setLoadingExpenseMonth(true);
    let list = [];
    try {
      const result = await getSharedWithRetry(storage, `expenses:${monthKey}`);
      if (result && result.value) list = JSON.parse(result.value);
      if (result && result.updated_at) dataVersionsRef.current[`expenses:${monthKey}`] = result.updated_at;
    } catch (e) {
      list = [];
    }
    setExpensesByMonth((prev) => ({ ...prev, [monthKey]: list }));
    setLoadingExpenseMonth(false);
    return list;
  };
  const persistExpenseMonth = async (monthKey, updatedList) => {
    setExpensesByMonth((prev) => ({ ...prev, [monthKey]: updatedList }));
    if (!expenseMonthKeys.includes(monthKey)) setExpenseMonthKeys((prev) => [monthKey, ...prev].sort().reverse());
    return syncSet(`expenses:${monthKey}`, JSON.stringify(updatedList), true, t("syncLabelExpenses"));
  };
  // Same fetch-fresh-before-write reasoning as fetchFreshMonth for receipts above — two devices
  // logging expenses around the same time must not let whichever saves second silently erase
  // what the first just logged.
  const fetchFreshExpenseMonth = async (monthKey) => {
    try {
      const result = await getSharedWithRetry(storage, `expenses:${monthKey}`);
      return result?.value ? JSON.parse(result.value) : [];
    } catch (e) {
      return expensesByMonth[monthKey] || [];
    }
  };
  const appendExpense = async (monthKey, expense) => {
    const existing = await fetchFreshExpenseMonth(monthKey);
    return persistExpenseMonth(monthKey, [expense, ...existing]);
  };
  const updateExpenseInMonth = async (monthKey, expenseId, updater) => {
    const existing = await fetchFreshExpenseMonth(monthKey);
    return persistExpenseMonth(monthKey, existing.map((e) => (e.id === expenseId ? updater(e) : e)));
  };
  const deleteExpenseFromMonth = async (monthKey, expenseId) => {
    const existing = await fetchFreshExpenseMonth(monthKey);
    return persistExpenseMonth(monthKey, existing.filter((e) => e.id !== expenseId));
  };

  const flashNotice = (text) => {
    setNotice(text);
    window.clearTimeout(window.__posNoticeTimer);
    window.__posNoticeTimer = window.setTimeout(() => setNotice(null), 2600);
  };

  // Copies text to the clipboard reliably even where the modern Clipboard API is blocked — the
  // same category of restriction this app has repeatedly hit in sandboxed preview contexts
  // (window.print, window.confirm, pop-ups, navigator.onLine all needed similar workarounds).
  // Falls back to the older execCommand technique via a temporary textarea, and only ever reports
  // success if one of the two actually worked — so a failure is never silent.
  const copyTextToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // fall through to the legacy method below
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch (e) {
      return false;
    }
  };

  // Sends the conversation so far (plus the new question) to Claude, with a system prompt
  // describing this specific app's features and known quirks, so answers are grounded in what
  // this POS actually does rather than generic support-bot filler. Goes through our own
  // /api/pos/[tenantId]/help proxy rather than api.anthropic.com directly — a real deployment
  // needs a server-side API key, which can't live in browser code (see that route for why).
  const sendHelpMessage = async (text) => {
    const question = text.trim();
    if (!question || helpChatSending) return;
    const nextMessages = [...helpChatMessages, { role: "user", content: question }];
    setHelpChatMessages(nextMessages);
    setHelpChatInput("");
    setHelpChatSending(true);
    try {
      const response = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildHelpSystemPrompt(restaurantName, lang),
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = (data.content || [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      setHelpChatMessages([...nextMessages, { role: "assistant", content: reply || t("helpChatError") }]);
    } catch (e) {
      setHelpChatMessages([...nextMessages, { role: "assistant", content: t("helpChatError") }]);
    } finally {
      setHelpChatSending(false);
    }
  };

  // Re-centers the help button's default position on the correct edge when the language (and
  // therefore layout direction) changes — but only if the person hasn't manually dragged it
  // somewhere themselves, since a deliberate placement should stick. Stays on the side OPPOSITE
  // the Order screen's docked ticket panel and bottom-anchored (not vertically centered) so the
  // chat panel always has enough room to open upward.
  useEffect(() => {
    if (helpButtonMoved) return;
    const w = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024;
    const h = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768;
    setHelpButtonPos({ top: h - HELP_BTN_SIZE - 20, left: isRtl ? w - HELP_BTN_SIZE - 20 : 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRtl]);

  const clampHelpButtonPos = (top, left) => {
    const w = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024;
    const h = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768;
    return {
      top: Math.max(8, Math.min(h - HELP_BTN_SIZE - 8, top)),
      left: Math.max(8, Math.min(w - HELP_BTN_SIZE - 8, left)),
    };
  };
  const handleHelpDragMove = (e) => {
    if (!helpDragRef.current.dragging) return;
    if (e.cancelable) e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    helpDragRef.current.moved = true;
    setHelpButtonPos(clampHelpButtonPos(point.clientY - helpDragRef.current.offsetY, point.clientX - helpDragRef.current.offsetX));
  };
  const handleHelpDragEnd = () => {
    if (helpDragRef.current.moved) setHelpButtonMoved(true);
    helpDragRef.current.dragging = false;
    window.removeEventListener("mousemove", handleHelpDragMove);
    window.removeEventListener("mouseup", handleHelpDragEnd);
    window.removeEventListener("touchmove", handleHelpDragMove);
    window.removeEventListener("touchend", handleHelpDragEnd);
  };
  const handleHelpDragStart = (e) => {
    const point = e.touches ? e.touches[0] : e;
    helpDragRef.current = { dragging: true, offsetX: point.clientX - helpButtonPos.left, offsetY: point.clientY - helpButtonPos.top, moved: false };
    window.addEventListener("mousemove", handleHelpDragMove);
    window.addEventListener("mouseup", handleHelpDragEnd);
    window.addEventListener("touchmove", handleHelpDragMove, { passive: false });
    window.addEventListener("touchend", handleHelpDragEnd);
  };

  const persistCustomers = async (dict) => {
    setCustomers(dict);
    return syncSet("customers-directory", JSON.stringify(dict), false, t("syncLabelCustomers"));
  };
  // Applies an Excel/CSV customer import against the freshest stored directory (not this device's copy), so customers
  // another terminal saved meanwhile are never overwritten. Nothing is deleted.
  const applyCustomersImport = async (rows, updateExisting) => {
    let fresh = customers;
    try {
      const result = await storage.get("customers-directory", false);
      fresh = result?.value ? JSON.parse(result.value) : {};
    } catch (e) {
      fresh = customers;
    }
    const { directory, added, updated } = applyCustomersPlan(buildCustomersPlan(rows, fresh, { updateExisting }), fresh);
    if (added + updated === 0) return { added, updated, saved: true };
    const saved = await persistCustomers(directory);
    return { added, updated, saved };
  };
  const exportCustomers = async () => {
    try {
      const n = await exportCustomersFile(customers, isRtl);
      flashNotice(t("notice_customersExported", { n }));
    } catch (e) {
      flashNotice(t("notice_customersExportFailed"));
    }
  };

  const handlePhoneChange = (value) => {
    setCustomerPhone(value);
    const match = customers[value];
    if (match && !customerName && !customerAddress) {
      setCustomerName(match.name || "");
      setCustomerAddress(match.address || "");
      flashNotice(t("notice_recognizedCustomer", { name: match.name || value }));
    }
  };
  // Matches whole words, not substrings — a zone called "Giza" shouldn't fire on an address that
  // just happens to contain "Gizawy". Only applies while no zone is picked yet, so it never
  // overwrites a zone the cashier chose (or corrected) themselves.
  const handleAddressChange = (value) => {
    setCustomerAddress(value);
    if (activeTableId !== "delivery" || deliveryZoneLabel) return;
    const addressWords = value.toLowerCase().split(/[\s,،/]+/).filter(Boolean);
    const match = deliveryZones.find((z) => z.label.toLowerCase().split(/[\s,،/]+/).filter(Boolean).some((zw) => addressWords.includes(zw)));
    if (match) {
      setDeliveryMethod("delivery");
      setDeliveryFee(match.fee);
      setDeliveryZoneLabel(match.label);
      flashNotice(t("notice_zoneAutoDetected", { zone: match.label }));
    }
  };
  // Driven by the phone field itself now — typing a number searches existing customers by phone
  // (or name, in case the cashier types it there instead) rather than needing a separate search box.
  const customerMatches = useMemo(() => {
    const q = customerPhone.trim().toLowerCase();
    if (!q) return [];
    return Object.values(customers).filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 6);
  }, [customerPhone, customers]);
  const selectCustomer = (c) => {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
    setShowCustomerSuggestions(false);
    flashNotice(t("notice_loadedCustomerDetails", { name: c.name || c.phone }));
  };

  // --- Ingredient stock helpers ---
  // ingredients-config has no blanket auto-persist effect (unlike most other shared config) —
  // every mutation below writes it explicitly, fetching the current server value immediately
  // before merging in, rather than trusting this device's local `ingredients` state. Stock
  // changes on every single order (every device, all day), so trusting a stale local snapshot
  // here would routinely let one device's save silently erase another's — the same race that hit
  // receipts, just far more frequent since it fires on every sale, not only on edits/cancellations.
  const fetchFreshIngredients = async () => {
    try {
      const result = await storage.get("ingredients-config", true);
      return result?.value ? JSON.parse(result.value) : ingredients;
    } catch (e) {
      return ingredients;
    }
  };
  // Deltas from one synchronous burst (e.g. every recipe line of every item in one saved order)
  // are batched into a single fetch-merge-write rather than one round trip per line — both for
  // efficiency and so they can't race against each other.
  const pendingIngredientDeltasRef = useRef({}); // { [ingredientId]: accumulatedDelta }
  const ingredientFlushScheduledRef = useRef(false);
  const flushIngredientDeltas = async () => {
    ingredientFlushScheduledRef.current = false;
    const deltas = pendingIngredientDeltasRef.current;
    pendingIngredientDeltasRef.current = {};
    if (Object.keys(deltas).length === 0) return;
    const fresh = await fetchFreshIngredients();
    const next = { ...fresh };
    Object.entries(deltas).forEach(([id, delta]) => {
      if (!next[id]) return;
      const nextVal = Math.max(0, Math.round((next[id].stock + delta) * 1000) / 1000);
      next[id] = { ...next[id], stock: nextVal };
    });
    setIngredients(next);
    await syncSet("ingredients-config", JSON.stringify(next), true, t("syncLabelStock"));
  };
  const updateIngredientStock = (id, delta) => {
    // Optimistic local update for immediate UI feedback — the actual persisted write happens in
    // flushIngredientDeltas above, against a freshly-fetched value, not this local state.
    setIngredients((prev) => {
      if (!prev[id]) return prev;
      const nextVal = Math.max(0, Math.round((prev[id].stock + delta) * 1000) / 1000);
      return { ...prev, [id]: { ...prev[id], stock: nextVal } };
    });
    pendingIngredientDeltasRef.current[id] = (pendingIngredientDeltasRef.current[id] || 0) + delta;
    if (!ingredientFlushScheduledRef.current) {
      ingredientFlushScheduledRef.current = true;
      setTimeout(flushIngredientDeltas, 0);
    }
  };
  // Manual correction of an ingredient's exact stock count (Stock tab) — updates locally on every
  // keystroke for responsive typing, but only commits to the server on blur (see the input's
  // onBlur below), same fetch-fresh-before-write treatment as everything else here.
  const setIngredientStockValue = (id, value) => {
    const n = Math.max(0, parseFloat(value) || 0);
    setIngredients((prev) => ({ ...prev, [id]: { ...prev[id], stock: n } }));
  };
  const commitIngredientStockValue = async (id, value) => {
    const n = Math.max(0, parseFloat(value) || 0);
    const fresh = await fetchFreshIngredients();
    if (!fresh[id]) return;
    const next = { ...fresh, [id]: { ...fresh[id], stock: n } };
    setIngredients(next);
    await syncSet("ingredients-config", JSON.stringify(next), true, t("syncLabelStock"));
  };
  // Adds whatever amount is currently typed into that ingredient's restock field in one go —
  // open to any employee, same as the old fixed "+10" button this replaces, so staff can restock
  // in bulk (e.g. after a delivery) without repeatedly tapping "+" one unit at a time.
  const applyBulkRestock = (id) => {
    const amt = parseFloat(restockAmounts[id]);
    if (!amt || amt <= 0) return;
    updateIngredientStock(id, amt);
    setRestockAmounts((prev) => ({ ...prev, [id]: "" }));
  };
  const addIngredient = async () => {
    if (!newIngName.trim()) {
      flashNotice(t("notice_giveIngredientName"));
      return;
    }
    const resolvedUnit = newIngUnit === "custom" ? newIngUnitCustom.trim() : newIngUnit;
    if (!resolvedUnit) {
      flashNotice(t("notice_enterCustomUnit"));
      return;
    }
    const id = newId("ing");
    const entry = { id, name: newIngName.trim(), unit: resolvedUnit, stock: Math.max(0, parseFloat(newIngStock) || 0) };
    const fresh = await fetchFreshIngredients();
    const next = { ...fresh, [id]: entry };
    setIngredients(next);
    await syncSet("ingredients-config", JSON.stringify(next), true, t("syncLabelStock"));
    setNewIngName("");
    setNewIngStock("");
    setNewIngUnitCustom("");
    flashNotice(t("notice_ingredientAdded", { name: entry.name, unit: resolvedUnit }));
  };
  // Applies an Excel/CSV stock import. The plan is worked out again against the freshest stored stock (not this
  // device's copy) and written once, so orders being rung up on other terminals meanwhile are never overwritten.
  const applyStockImport = async (items, updateExisting) => {
    const fresh = await fetchFreshIngredients();
    const plan = buildStockImportPlan(items, fresh, { updateExisting });
    const next = { ...fresh };
    let added = 0;
    let updated = 0;
    plan.rows.forEach((r) => {
      if (r.action === "add") {
        const id = newId("ing");
        next[id] = { id, name: r.name, unit: r.unit, stock: r.qty };
        added++;
      } else if (r.action === "update" && next[r.existingId]) {
        next[r.existingId] = { ...next[r.existingId], stock: r.qty };
        updated++;
      }
    });
    if (added + updated === 0) return { added, updated, saved: true };
    setIngredients(next);
    const saved = await syncSet("ingredients-config", JSON.stringify(next), true, t("syncLabelStock"));
    return { added, updated, saved };
  };
  const isIngredientUsed = (id) =>
    [...Object.values(menu), ...menuProfiles.flatMap((p) => Object.values(p.extraItems || {}))].some((items) => (items || []).some((it) => (it.recipe || []).some((r) => r.ingredientId === id)));
  const deleteIngredient = (id) => {
    if (isIngredientUsed(id)) {
      flashNotice(t("notice_cantDeleteUsed"));
      return;
    }
    setConfirmDialog({
      message: t("confirm_removeIngredient", { name: ingredients[id]?.name || "" }),
      onConfirm: async () => {
        const fresh = await fetchFreshIngredients();
        const next = { ...fresh };
        delete next[id];
        setIngredients(next);
        await syncSet("ingredients-config", JSON.stringify(next), true, t("syncLabelStock"));
      },
    });
  };

  // Looks up a menu item's definition (for its recipe, mainly) wherever it might live — the base
  // menu, or as an extra item exclusive to one of the price-list profiles below. A profile's
  // extra item never exists in `menu`, so any stock/recipe lookup keyed only off `menu` would
  // silently treat it as untracked; this is the one lookup every such call site should go through
  // instead, whether or not a profile is currently active (an order rung up under a profile can
  // still be getting paid/edited later when a different profile — or none — is active).
  const findMenuItemAnywhere = (id) => {
    const base = Object.values(menu).flat().find((m) => m.id === id);
    if (base) return base;
    for (const p of menuProfiles) {
      const found = Object.values(p.extraItems || {}).flat().find((m) => m.id === id);
      if (found) return found;
    }
    return null;
  };
  const activeMenuProfileObj = menuProfiles.find((p) => p.id === activeMenuProfile) || null;
  // The menu as it should actually be browsed/ordered from right now: unchanged when no profile
  // is active, otherwise the base items with that profile's price overrides applied, plus its
  // own extra items appended into their category. Recipes/stock always come from the base item
  // (a profile changes price, not what the dish actually is), except for extra items, which only
  // exist within the profile to begin with.
  // A price list can also have categories of its own, and can leave out main-menu dishes it should not sell.
  const effectiveCategories = !activeMenuProfileObj ? categories : [...categories, ...(activeMenuProfileObj.extraCategories || []).filter((c) => !categories.includes(c))];
  const effectiveMenu = !activeMenuProfileObj
    ? menu
    : Object.fromEntries(
        effectiveCategories.map((cat) => [
          cat,
          [
            ...(menu[cat] || [])
              .filter((it) => !(activeMenuProfileObj.hiddenItems || []).includes(it.id))
              .map((it) => (activeMenuProfileObj.priceOverrides[it.id] !== undefined ? { ...it, price: activeMenuProfileObj.priceOverrides[it.id] } : it)),
            ...((activeMenuProfileObj.extraItems || {})[cat] || []),
          ],
        ])
      );
  // Switching to a price list that lacks the category being browsed (or back to the main menu from a list's own
  // category) lands on the first category that exists.
  // With main categories, the first row of tabs is the mains and the second row the categories inside the chosen one.
  const mainTabs = mainTabsFor(effectiveCategories, mainCategories, t("mainCategoryOther"));
  const activeMainTab = mainTabs.find((m) => m.id === activeMain) || mainTabs[0] || null;
  const visibleSubs = activeMainTab ? activeMainTab.subs : effectiveCategories;
  const selectMain = (tab) => {
    setActiveMain(tab.id);
    if (tab.subs.length > 0) setActive(tab.subs[0]);
  };
  useEffect(() => {
    if (visibleSubs.length > 0 && !visibleSubs.includes(active)) setActive(visibleSubs[0]);
  }, [activeMenuProfile, menuProfiles, categories, mainCategories, activeMain, active]);

  // remaining ingredient stock after subtracting what's already reserved by the current cart
  const remainingIngredientStock = useMemo(() => {
    const remaining = {};
    Object.values(ingredients).forEach((ing) => (remaining[ing.id] = ing.stock));
    cart.forEach((cartItem) => {
      const menuItem = findMenuItemAnywhere(cartItem.id);
      if (!menuItem) return;
      menuItem.recipe.forEach((r) => {
        if (remaining[r.ingredientId] !== undefined) remaining[r.ingredientId] -= r.qty * cartItem.qty;
      });
    });
    return remaining;
  }, [ingredients, cart, menu, menuProfiles]);

  const rawMaxServings = (item) => {
    if (manualOutOfStock[item.id]) return 0; // switched off by hand, regardless of ingredient stock
    if (!item.recipe || item.recipe.length === 0) return null; // not tracked
    return Math.min(...item.recipe.map((r) => {
      const ing = ingredients[r.ingredientId];
      if (!ing || r.qty <= 0) return 0;
      return Math.floor(ing.stock / r.qty);
    }));
  };
  const canAddOneMore = (item) => {
    if (manualOutOfStock[item.id]) return { ok: false, reason: t("reasonMarkedOut", { item: item.name }) };
    if (!item.recipe || item.recipe.length === 0) return { ok: true };
    for (const r of item.recipe) {
      const rem = remainingIngredientStock[r.ingredientId] ?? 0;
      if (rem < r.qty) {
        const ing = ingredients[r.ingredientId];
        return { ok: false, reason: t("notEnoughForAnother", { ingredient: ing?.name || t("genericStock"), item: item.name }) };
      }
    }
    return { ok: true };
  };

  const servingsBadge = (item) => {
    const max = rawMaxServings(item);
    if (max === null) return { text: t("stockNotTracked"), color: "var(--track)", fg: "var(--text-muted)" };
    if (max === 0) return { text: t("outOfStock"), color: "#3A2A28", fg: "#E3A79C" };
    if (max <= 3) return { text: t("lowLeft", { n: max }), color: "#3A331F", fg: "#E3C98A" };
    return { text: t("available", { n: max }), color: "#22301F", fg: "#9FCB8E" };
  };

  const addItem = (item) => {
    const check = canAddOneMore(item);
    if (!check.ok) {
      flashNotice(check.reason);
      return;
    }
    setSaved(false);
    setCart((prev) => {
      // Merges into an existing plain (no-note) line for this item so quick repeat taps still
      // just bump the quantity — but a line that already has a special-request note stays
      // separate, so a second "no onions" burger doesn't silently combine with a plain one.
      const found = prev.find((p) => p.id === item.id && !p.note);
      if (found) return prev.map((p) => (p.lineId === found.lineId ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { ...item, qty: 1, note: "", lineId: newId("line") }];
    });
  };
  const changeQty = (lineId, delta) => {
    setSaved(false);
    if (delta > 0) {
      const line = cart.find((c) => c.lineId === lineId);
      const item = line && findMenuItemAnywhere(line.id);
      const check = canAddOneMore(item);
      if (!check.ok) {
        flashNotice(check.reason);
        return;
      }
    }
    setCart((prev) => prev.map((p) => (p.lineId === lineId ? { ...p, qty: p.qty + delta } : p)).filter((p) => p.qty > 0));
  };
  const updateCartNote = (lineId, note) => {
    setCart((prev) => prev.map((p) => (p.lineId === lineId ? { ...p, note } : p)));
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);
  const discountAmount = (baseSubtotal, disc) => {
    if (!disc || !disc.value) return 0;
    const v = Number(disc.value) || 0;
    if (disc.type === "percent") return Math.min(baseSubtotal, baseSubtotal * (v / 100));
    return Math.min(baseSubtotal, v);
  };
  const discAmt = discountAmount(subtotal, discount);
  // Service charge applies to the discounted subtotal; VAT applies on top of that (subtotal −
  // discount + service) — the standard restaurant-bill order (matches how it's normally done in
  // Egypt, where this app's defaults are already centered — see DEFAULT_COUNTRY_CODE). Delivery
  // fee is a separate pass-through charge, not subject to either. Forced to 0 if this tenant's
  // package doesn't include VAT/service at all, regardless of whatever percentages happen to
  // still be stored from before a downgrade — package gating shouldn't silently keep charging
  // something staff can no longer see or adjust.
  const netAfterDiscount = subtotal - discAmt;
  const effectiveServicePercent = hasFeature("vatService") ? servicePercent : 0;
  const effectiveVatPercent = hasFeature("vatService") ? vatPercent : 0;
  const serviceAmt = Math.round(netAfterDiscount * (effectiveServicePercent / 100) * 100) / 100;
  const vatAmt = Math.round((netAfterDiscount + serviceAmt) * (effectiveVatPercent / 100) * 100) / 100;
  const total = netAfterDiscount + serviceAmt + vatAmt + (deliveryFee || 0);

  const applyDiscount = () => {
    const v = Number(discountDraft.value);
    if (!v || v <= 0) {
      flashNotice(t("notice_enterDiscountValue"));
      return;
    }
    const reason = (discountDraft.reason || "").trim();
    if (reason.length < 3) {
      flashNotice(t("notice_discountReasonRequired"));
      return;
    }
    setDiscount({ type: discountDraft.type, value: v, reason });
    setDiscountOpen(false);
  };
  const removeDiscount = () => {
    setDiscount(null);
    setDiscountDraft({ type: "percent", value: "", reason: "" });
    setDiscountOpen(false);
  };

  const applySplit = () => {
    const n = Math.floor(Number(splitDraft));
    if (!n || n < 2) {
      flashNotice(t("notice_enterSplitValue"));
      return;
    }
    setSplitCount(n);
    setSplitOpen(false);
  };
  const removeSplit = () => {
    setSplitCount(null);
    setSplitDraft("");
    setSplitOpen(false);
  };

  const saveOrder = async () => {
    // savingOrder stays true from here through the 1.1s "Saved" window below (reset alongside the
    // rest of the form there) — closes the window where a fast double-click/tap, or someone
    // unsure their first tap registered, would otherwise re-run this on the same still-populated
    // cart and save the same order twice.
    if (cart.length === 0 || savingOrder) return;
    // A discount already sitting on a ticket (e.g. one started before reasons were required) can't be
    // saved without its reason.
    if (discount && !(discount.reason || "").trim()) {
      flashNotice(t("notice_discountReasonRequired"));
      setDiscountDraft({ type: discount.type, value: String(discount.value), reason: "" });
      setDiscountOpen(true);
      return;
    }
    setSavingOrder(true);
    const finalTicketNo = ensureTicketNo();

    const splitPayments = paymentMethod === "split"
      ? PAYMENT_METHODS.map((m) => ({ method: m.id, amount: Math.round((Number(splitAmounts[m.id]) || 0) * 100) / 100 })).filter((sp) => sp.amount > 0)
      : null;
    if (paymentMethod === "split") {
      const splitSum = splitPayments.reduce((s, sp) => s + sp.amount, 0);
      if (splitPayments.length < 2 || Math.abs(splitSum - total) > 0.01) {
        flashNotice(t("notice_splitPaymentMismatch", { amount: money(total) }));
        setSavingOrder(false);
        return;
      }
    }

    // deduct ingredient stock per recipe, and snapshot the recipe used at time of sale
    cart.forEach((cartItem) => {
      const menuItem = findMenuItemAnywhere(cartItem.id);
      (menuItem?.recipe || []).forEach((r) => updateIngredientStock(r.ingredientId, -r.qty * cartItem.qty));
    });

    const hasCustomer = customerName.trim() || customerPhone.trim() || customerAddress.trim();
    const customer = hasCustomer ? { name: customerName.trim(), phone: customerPhone.trim(), address: customerAddress.trim() } : null;

    const receipt = {
      id: `${finalTicketNo}-${Date.now()}`,
      ticketNo: finalTicketNo,
      timestamp: new Date().toISOString(),
      table: activeTableId === null ? null : tableLabel(activeTableId),
      tableId: activeTableId,
      servedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
      assignedTo: assignedTo ? { ...assignedTo } : null,
      items: cart.map((c) => {
        const menuItem = findMenuItemAnywhere(c.id);
        return { id: c.id, name: c.name, qty: c.qty, price: c.price, note: c.note || "", recipeSnapshot: menuItem?.recipe || [] };
      }),
      subtotal,
      discount: discount ? { ...discount } : null,
      discountAmount: discAmt,
      serviceRate: effectiveServicePercent,
      serviceAmount: serviceAmt,
      vatRate: effectiveVatPercent,
      vatAmount: vatAmt,
      deliveryFee: deliveryFee || 0,
      deliveryMethod: deliveryMethod || null,
      deliveryZoneLabel: deliveryZoneLabel || "",
      total,
      splitCount: splitCount && splitCount > 1 ? splitCount : null,
      paymentMethod,
      splitPayments,
      paid: paidNow,
      paidAt: paidNow ? new Date().toISOString() : null,
      customer,
      eta: orderEta.trim(),
      status: "completed",
      fulfillmentStatus: "placed",
      whatsappLog: [],
    };

    // Whatever this device prints by itself happens straight away, whatever happens to the save below.
    autoPrintAfterSave(receipt);

    const receiptOk = await appendReceipt(thisMonthKey(), receipt);

    let customerOk = true;
    if (customer && customer.phone) {
      // Fresh fetch, not the local `customers` cache — two devices checking out different
      // customers (or the same one) around the same time must not let whichever saves second
      // silently revert the other's order-count bump or contact-detail update.
      let freshCustomers;
      try {
        const result = await storage.get("customers-directory", false);
        freshCustomers = result?.value ? JSON.parse(result.value) : {};
      } catch (e) {
        freshCustomers = customers;
      }
      const existing = freshCustomers[customer.phone];
      const updatedEntry = {
        name: customer.name || existing?.name || "",
        phone: customer.phone,
        address: customer.address || existing?.address || "",
        orderCount: (existing?.orderCount || 0) + 1,
        lastOrder: receipt.timestamp,
      };
      customerOk = await persistCustomers({ ...freshCustomers, [customer.phone]: updatedEntry });
    }

    setSaved(true);
    if (!receiptOk) flashNotice(t("notice_orderSavedNoSync"));
    else if (!customerOk) flashNotice(t("notice_orderSavedNoCustomer"));
    else flashNotice(t("notice_orderSavedOk"));

    setTimeout(() => {
      const fresh = blankDraft();
      setCart(fresh.cart);
      setDiscount(fresh.discount);
      setSplitCount(fresh.splitCount);
      setSplitOpen(false);
      setSplitDraft("");
      setDeliveryFee(fresh.deliveryFee);
      setDeliveryMethod(fresh.deliveryMethod);
      setDeliveryZoneLabel(fresh.deliveryZoneLabel);
      setAssignedTo(fresh.assignedTo);
      setPaymentMethod(fresh.paymentMethod);
      setPaidNow(fresh.paidNow);
      setSplitAmounts(fresh.splitAmounts);
      setCustomerName(fresh.customerName);
      setCustomerPhone(fresh.customerPhone);
      setCustomerAddress(fresh.customerAddress);
      setOrderEta(fresh.orderEta);
      setTicketNo(fresh.ticketNo);
      setSaved(false);
      setSavingOrder(false);
      // Free up this table (or Takeaway/Delivery slot) now that its order has been placed —
      // otherwise switching away and back would restore the just-saved cart as if still open.
      const key = activeTableId === null ? "takeaway" : activeTableId;
      setTableDrafts((prev) => ({ ...prev, [key]: fresh }));
    }, 1100);
  };

  // Unpaid ("pay later") invoices from this month that the current cart could be merged into —
  // e.g. a customer who already has a running, unpaid tab ordering more before it's settled,
  // rather than that becoming a separate second ticket. Scoped to this month since that's the one
  // month always guaranteed loaded; an unpaid tab from further back is rare enough not to need the
  // Dashboard/Receipts-style cross-month widening.
  const unpaidInvoicesThisMonth = (receiptsByMonth[thisMonthKey()] || []).filter((r) => r.status === "completed" && r.paid === false);
  // Merges the current cart into an already-saved unpaid invoice instead of creating a new one —
  // matching quantities get bumped, everything else appends as a new line, then subtotal/discount/
  // service/VAT are recomputed using that invoice's own stored rates (same rule saveEditReceipt
  // uses), not today's live settings. Stock is deducted for the newly added items exactly like a
  // normal save, since these are genuinely new items being added to the kitchen's workload.
  const addCartToUnpaidInvoice = (receiptId) => {
    if (cart.length === 0 || mergingIntoInvoice) return;
    const target = unpaidInvoicesThisMonth.find((r) => r.id === receiptId);
    if (!target) return;
    setMergingIntoInvoice(true);

    cart.forEach((cartItem) => {
      const menuItem = findMenuItemAnywhere(cartItem.id);
      (menuItem?.recipe || []).forEach((r) => updateIngredientStock(r.ingredientId, -r.qty * cartItem.qty));
    });

    // Only the items being added go to the kitchen, marked as an addition to an existing order.
    if (autoPrintRef.current === "kitchen" || autoPrintRef.current === "both") dispatchKitchenTicket(kitchenTicketFromReceipt({ ...target, items: cart.map((c) => ({ name: c.name, qty: c.qty, note: c.note || "" })), servedBy: currentEmployee ? { name: currentEmployee.name } : target.servedBy }, true));

    const newItems = cart.map((c) => {
      const menuItem = findMenuItemAnywhere(c.id);
      return { id: c.id, name: c.name, qty: c.qty, price: c.price, note: c.note || "", recipeSnapshot: menuItem?.recipe || [] };
    });
    const mergedItems = [...target.items];
    newItems.forEach((it) => {
      const idx = mergedItems.findIndex((m) => m.id === it.id && (m.note || "") === (it.note || ""));
      if (idx >= 0) mergedItems[idx] = { ...mergedItems[idx], qty: mergedItems[idx].qty + it.qty };
      else mergedItems.push(it);
    });

    const newSubtotal = mergedItems.reduce((s, it) => s + it.price * it.qty, 0);
    const newDiscAmt = discountAmount(newSubtotal, target.discount);
    const newNet = newSubtotal - newDiscAmt;
    const newServiceAmt = Math.round(newNet * ((target.serviceRate || 0) / 100) * 100) / 100;
    const newVatAmt = Math.round((newNet + newServiceAmt) * ((target.vatRate || 0) / 100) * 100) / 100;
    const newTotal = newNet + newServiceAmt + newVatAmt + (target.deliveryFee || 0);
    const updatedReceipt = {
      ...target,
      items: mergedItems,
      subtotal: newSubtotal,
      discountAmount: newDiscAmt,
      serviceAmount: newServiceAmt,
      vatAmount: newVatAmt,
      total: newTotal,
    };
    updateReceiptInStorage(target, () => updatedReceipt);
    flashNotice(t("notice_addedToInvoice", { n: target.ticketNo }));

    const fresh = blankDraft();
    setCart(fresh.cart);
    setDiscount(fresh.discount);
    setSplitCount(fresh.splitCount);
    setSplitOpen(false);
    setSplitDraft("");
    setDeliveryFee(fresh.deliveryFee);
    setDeliveryMethod(fresh.deliveryMethod);
    setDeliveryZoneLabel(fresh.deliveryZoneLabel);
    setAssignedTo(fresh.assignedTo);
    setPaymentMethod(fresh.paymentMethod);
    setPaidNow(fresh.paidNow);
    setSplitAmounts(fresh.splitAmounts);
    setCustomerName(fresh.customerName);
    setCustomerPhone(fresh.customerPhone);
    setCustomerAddress(fresh.customerAddress);
    setOrderEta(fresh.orderEta);
    setTicketNo(fresh.ticketNo);
    const key = activeTableId === null ? "takeaway" : activeTableId;
    setTableDrafts((prev) => ({ ...prev, [key]: fresh }));
    setAddToInvoiceOpen(false);
    setMergingIntoInvoice(false);
  };

  // Small header block (logo + name) shared by both printable documents.
  const brandHeaderHtml = () => {
    const nameHtml = `<div style="font-size:16px;font-weight:700;">${escapeHtml(restaurantName)}</div>`;
    if (!logoUrl) return nameHtml;
    return `<img src="${logoUrl}" alt="${escapeHtml(restaurantName)}" style="max-width:130px;max-height:60px;margin:0 auto 6px;display:block;" />${nameHtml}`;
  };

  const buildOrderReceiptBodyHtml = (ticketNoOverride) => {
    const displayTicketNo = ticketNoOverride || ticketNo;
    const rows = cart
      .map(
        (item) => `
      <div class="row" style="font-size:12px;margin-bottom:${item.note ? 0 : 4}px;">
        <span>${item.qty}&times; ${escapeHtml(item.name)}</span>
        <span>${money(item.price * item.qty)}</span>
      </div>
      ${item.note ? `<div style="font-size:10.5px;color:#555;font-style:italic;margin-bottom:4px;">${escapeHtml(item.note)}</div>` : ""}`
      )
      .join("");
    const customerBlock =
      customerName || customerPhone || customerAddress
        ? `<div style="font-size:11px;margin-top:4px;">
            ${escapeHtml(customerName)}${customerName && customerPhone ? " &middot; " : ""}${escapeHtml(customerPhone)}
            ${customerAddress ? `<div>${escapeHtml(customerAddress)}</div>` : ""}
          </div>`
        : "";
    const discountRow = discount
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("discount"))} ${discount.type === "percent" ? `(${discount.value}%)` : ""}</span>
          <span>-${money(discAmt)}</span>
        </div>`
      : "";
    const serviceRow = effectiveServicePercent > 0
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("serviceCharge"))} (${effectiveServicePercent}%)</span>
          <span>${money(serviceAmt)}</span>
        </div>`
      : "";
    const vatRow = effectiveVatPercent > 0
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("vat"))} (${effectiveVatPercent}%)</span>
          <span>${money(vatAmt)}</span>
        </div>`
      : "";
    const deliveryFeeRow = deliveryMethod === "delivery" && deliveryFee > 0
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("deliveryFeeLineLabel"))}${deliveryZoneLabel ? ` (${escapeHtml(deliveryZoneLabel)})` : ""}</span>
          <span>${money(deliveryFee)}</span>
        </div>`
      : "";
    const deliveryMethodLine = deliveryMethod
      ? `<div style="font-size:10.5px;color:#555;margin-top:2px;">${escapeHtml(deliveryMethod === "pickup" ? t("pickupBadge") : t("deliveryBadge", { zone: deliveryZoneLabel }))}</div>`
      : "";
    return `
      <div class="center">
        ${brandHeaderHtml()}
        <div style="font-size:11px;">${escapeHtml(tableLabel(activeTableId))}</div>
        <div style="font-size:11px;">${escapeHtml(t("ticketNumber", { n: displayTicketNo }))}</div>
        <div style="font-size:11px;">${new Date().toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
        ${deliveryMethodLine}
        ${customerBlock}
      </div>
      <div class="dashed">${rows}</div>
      <div class="dashed">
        <div class="row" style="font-size:11px;"><span>${escapeHtml(t("subtotal"))}</span><span>${money(subtotal)}</span></div>
        ${discountRow}
        ${serviceRow}
        ${vatRow}
        ${deliveryFeeRow}
        <div class="row" style="font-size:14px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("total"))}</span><span>${money(total)}</span></div>
        ${splitCount > 1 ? `<div class="row" style="font-size:12px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("splitLabel", { n: splitCount }))}</span><span>${escapeHtml(t("eachPays", { amount: money(total / splitCount) }))}</span></div>` : ""}
        ${paymentMethod === "split"
          ? PAYMENT_METHODS.filter((m) => Number(splitAmounts[m.id]) > 0)
              .map((m) => `<div style="font-size:11px;margin-top:2px;">${escapeHtml(t("paidVia", { method: t(`payment_${m.id}`) }))} &mdash; ${money(Number(splitAmounts[m.id]) || 0)}</div>`)
              .join("")
          : `<div style="font-size:11px;margin-top:4px;">${escapeHtml(t("paidVia", { method: t(`payment_${paymentMethod}`) }))}</div>`}
      </div>
      <div class="center" style="font-size:10px;margin-top:14px;">${escapeHtml(t("thankYou"))}</div>`;
  };
  const printOrderReceipt = () => {
    const n = ensureTicketNo();
    printViaHiddenFrame(t("ticketNumber", { n }), buildOrderReceiptBodyHtml(n), isRtl);
  };
  const downloadOrderReceipt = () => {
    const n = ensureTicketNo();
    downloadReceiptFile(t("ticketNumber", { n }), buildOrderReceiptBodyHtml(n), isRtl);
    flashNotice(t("notice_receiptDownloaded"));
  };

  // Reprints an already-saved receipt from history — same layout as buildOrderReceiptBodyHtml,
  // but sourced entirely from the saved record's own fields rather than the live order state,
  // since by the time it's in the Receipts tab the cart/discount/etc. that produced it are gone.
  const buildSavedReceiptBodyHtml = (r) => {
    const rows = r.items
      .map(
        (item) => `
      <div class="row" style="font-size:12px;margin-bottom:${item.note ? 0 : 4}px;">
        <span>${item.qty}&times; ${escapeHtml(item.name)}</span>
        <span>${money(item.price * item.qty)}</span>
      </div>
      ${item.note ? `<div style="font-size:10.5px;color:#555;font-style:italic;margin-bottom:4px;">${escapeHtml(item.note)}</div>` : ""}`
      )
      .join("");
    const customerBlock =
      r.customer && (r.customer.name || r.customer.phone)
        ? `<div style="font-size:11px;margin-top:4px;">
            ${escapeHtml(r.customer.name || "")}${r.customer.name && r.customer.phone ? " &middot; " : ""}${escapeHtml(r.customer.phone || "")}
            ${r.customer.address ? `<div>${escapeHtml(r.customer.address)}</div>` : ""}
          </div>`
        : "";
    const discountRow = r.discount
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("discount"))} ${r.discount.type === "percent" ? `(${r.discount.value}%)` : ""}</span>
          <span>-${money(r.discountAmount)}</span>
        </div>`
      : "";
    const serviceRow = r.serviceRate > 0
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("serviceCharge"))} (${r.serviceRate}%)</span>
          <span>${money(r.serviceAmount)}</span>
        </div>`
      : "";
    const vatRow = r.vatRate > 0
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("vat"))} (${r.vatRate}%)</span>
          <span>${money(r.vatAmount)}</span>
        </div>`
      : "";
    const deliveryFeeRow = r.deliveryMethod === "delivery" && r.deliveryFee > 0
      ? `<div class="row" style="font-size:11px;">
          <span>${escapeHtml(t("deliveryFeeLineLabel"))}${r.deliveryZoneLabel ? ` (${escapeHtml(r.deliveryZoneLabel)})` : ""}</span>
          <span>${money(r.deliveryFee)}</span>
        </div>`
      : "";
    const deliveryMethodLine = r.deliveryMethod
      ? `<div style="font-size:10.5px;color:#555;margin-top:2px;">${escapeHtml(r.deliveryMethod === "pickup" ? t("pickupBadge") : t("deliveryBadge", { zone: r.deliveryZoneLabel }))}</div>`
      : "";
    return `
      <div class="center">
        ${brandHeaderHtml()}
        <div style="font-size:11px;">${escapeHtml(r.table || t("takeawayLabel"))}</div>
        <div style="font-size:11px;">${escapeHtml(t("ticketNumber", { n: r.ticketNo }))}</div>
        <div style="font-size:11px;">${new Date(r.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
        ${deliveryMethodLine}
        ${customerBlock}
      </div>
      <div class="dashed">${rows}</div>
      <div class="dashed">
        <div class="row" style="font-size:11px;"><span>${escapeHtml(t("subtotal"))}</span><span>${money(r.subtotal)}</span></div>
        ${discountRow}
        ${serviceRow}
        ${vatRow}
        ${deliveryFeeRow}
        <div class="row" style="font-size:14px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("total"))}</span><span>${money(r.total)}</span></div>
        ${r.splitCount > 1 ? `<div class="row" style="font-size:12px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("splitLabel", { n: r.splitCount }))}</span><span>${escapeHtml(t("eachPays", { amount: money(r.total / r.splitCount) }))}</span></div>` : ""}
        ${r.paymentMethod === "split" && Array.isArray(r.splitPayments)
          ? r.splitPayments.map((sp) => `<div style="font-size:11px;margin-top:2px;">${escapeHtml(t("paidVia", { method: t(`payment_${sp.method}`) }))} &mdash; ${money(sp.amount)}</div>`).join("")
          : `<div style="font-size:11px;margin-top:4px;">${escapeHtml(t("paidVia", { method: t(`payment_${r.paymentMethod}`) }))}</div>`}
      </div>
      <div class="center" style="font-size:10px;margin-top:14px;">${escapeHtml(t("thankYou"))}</div>`;
  };
  const printSavedReceipt = (r) => {
    printViaHiddenFrame(t("ticketNumber", { n: r.ticketNo }), buildSavedReceiptBodyHtml(r), isRtl);
  };

  // ---- Kitchen tickets: the order without prices, printed here or sent to the kitchen printer device ----
  const kitchenLabels = () => ({
    title: t("kitchenTicketTitle"),
    ticketNumber: (n) => t("ticketNumber", { n }),
    takeaway: t("takeawayLabel"),
    pickup: t("pickupBadge"),
    delivery: (zone) => t("deliveryBadge", { zone }),
    added: t("kitchenAddedLabel"),
    total: (n) => t("kitchenItemsTotal", { n }),
    servedBy: (name) => t("kitchenServedBy", { name }),
    eta: (text) => t("kitchenEta", { text }),
  });
  const printKitchenTicket = (ticket) => {
    const time = new Date(ticket.at).toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" });
    printViaHiddenFrame(t("kitchenTicketTitle"), kitchenTicketBodyHtml(ticket, kitchenLabels(), time), isRtl);
  };
  const kitchenTicketFromReceipt = (r, extra = false) =>
    buildKitchenTicket({
      ticketNo: r.ticketNo,
      table: r.table,
      items: r.items,
      customerName: r.customer?.name,
      deliveryMethod: r.deliveryMethod,
      zoneLabel: r.deliveryZoneLabel,
      eta: r.eta,
      servedBy: r.servedBy?.name,
      extra,
    });
  // Puts a ticket in the shared queue and checks it is really there afterwards (two tills saving at the very same
  // moment could otherwise overwrite each other's entry); true once it is safely queued.
  const queueKitchenTicket = async (ticket) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const current = await storage.get("kitchen-queue");
        const next = addToKitchenQueue(parseKitchenQueue(current?.value), ticket);
        if (!(await storage.set("kitchen-queue", JSON.stringify(next)))) continue;
        await new Promise((resolve) => setTimeout(resolve, 700));
        const check = await storage.get("kitchen-queue");
        if (parseKitchenQueue(check?.value).some((x) => x.id === ticket.id)) return true;
      } catch (e) {
        // try again
      }
    }
    return false;
  };
  // Called whenever an order is created: does whatever this device is set up to do (nothing, by default).
  const dispatchKitchenTicket = async (ticket) => {
    const mode = kitchenModeRef.current === "off" ? "here" : kitchenModeRef.current;
    if (mode === "here") {
      printKitchenTicket(ticket);
    } else if (mode === "station") {
      kitchenPrintedRef.current = [...kitchenPrintedRef.current, ticket.id].slice(-80);
      storage.set("kitchen-printed", JSON.stringify(kitchenPrintedRef.current)).catch(() => {});
      printKitchenTicket(ticket);
    } else if (mode === "send") {
      const queued = await queueKitchenTicket(ticket);
      if (!queued) {
        printKitchenTicket(ticket);
        flashNotice(t("notice_kitchenSendFailed"));
      }
    }
  };
  // What this device prints by itself the moment an order is saved: the customer receipt (with prices), the kitchen
  // ticket (without), both, or nothing — as chosen in Settings.
  const autoPrintAfterSave = (receipt) => {
    const mode = autoPrintRef.current;
    if (mode === "receipt" || mode === "both") printViaHiddenFrame(t("ticketNumber", { n: receipt.ticketNo }), buildSavedReceiptBodyHtml(receipt), isRtl);
    if (mode === "kitchen" || mode === "both") {
      // Two print windows at once get in each other's way, so the second follows a moment later.
      setTimeout(() => dispatchKitchenTicket(kitchenTicketFromReceipt(receipt)), mode === "both" ? 1500 : 0);
    }
  };
  // The kitchen-printer device: prints each new ticket from the shared queue once.
  const handleKitchenQueue = (list) => {
    setKitchenRecent([...list].reverse().slice(0, 12));
    const todo = kitchenTicketsToPrint(list, kitchenPrintedRef.current, kitchenSinceRef.current);
    if (todo.length === 0) return;
    kitchenPrintedRef.current = [...kitchenPrintedRef.current, ...todo.map((x) => x.id)].slice(-80);
    storage.set("kitchen-printed", JSON.stringify(kitchenPrintedRef.current)).catch(() => {});
    todo.forEach((ticket, i) => setTimeout(() => printKitchenTicket(ticket), i * 2500));
  };
  kitchenHandlerRef.current = handleKitchenQueue;
  const printKitchenTicketFromCart = () => {
    const n = ensureTicketNo();
    printKitchenTicket(buildKitchenTicket({
      ticketNo: n,
      table: activeTableId === null ? null : tableLabel(activeTableId),
      items: cart,
      customerName,
      deliveryMethod,
      zoneLabel: deliveryZoneLabel,
      eta: orderEta,
      servedBy: currentEmployee?.name,
    }));
  };
  const printKitchenTestTicket = () => {
    printKitchenTicket(buildKitchenTicket({ ticketNo: null, table: t("kitchenTestLabel"), items: [{ name: t("kitchenTestDish"), qty: 2, note: "" }, { name: t("kitchenTestDish"), qty: 1, note: "—" }], servedBy: currentEmployee?.name }));
  };

  // One ledger over the receipts, expenses and shifts this device has loaded. Every money figure on every tab
  // comes from it (see src/ledger.js), so tabs cannot disagree about how things add up.
  const ledger = useMemo(
    () => createLedger({ receiptsByMonth, expensesByMonth, shiftLog, openShifts, shiftHours: shiftHoursConfig, menu, labels: LEDGER_LABELS, collections: dayCollections }),
    [receiptsByMonth, expensesByMonth, shiftLog, openShifts, shiftHoursConfig, menu, dayCollections]
  );
  const monthLabel = (key) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  };
  const formatHour = (h) => new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" });
  const availableMonths = useMemo(() => Array.from(new Set([thisMonthKey(), ...monthKeys])).sort().reverse(), [monthKeys]);
  const currentMonth = selectedMonth || thisMonthKey();
  // Receipts tab: Month/Day/Range filtering, mirroring the Dashboard's own (see
  // dashboardReportingMonthKeys) — Month mode keeps using the dropdown above (only months that
  // actually have data); Day and Range pick their own period independent of it, exactly like the
  // Dashboard's equivalent modes.
  const effectiveReceiptsDay = receiptsFilterDay || todayLocalStr();
  const rawReceiptsRangeEnd = receiptsFilterRangeEnd || todayLocalStr();
  const rawReceiptsRangeStart = receiptsFilterRangeStart || addDaysStr(rawReceiptsRangeEnd, -6);
  const effectiveReceiptsRangeStart = rawReceiptsRangeStart <= rawReceiptsRangeEnd ? rawReceiptsRangeStart : rawReceiptsRangeEnd;
  const effectiveReceiptsRangeEnd = rawReceiptsRangeStart <= rawReceiptsRangeEnd ? rawReceiptsRangeEnd : rawReceiptsRangeStart;
  const handleReceiptsRangeDayClick = (dateStr) => {
    if (!receiptsRangePickingEnd || dateStr < effectiveReceiptsRangeStart) {
      setReceiptsFilterRangeStart(dateStr);
      setReceiptsFilterRangeEnd(dateStr);
      setReceiptsRangePickingEnd(true);
    } else {
      setReceiptsFilterRangeEnd(dateStr);
      setReceiptsRangePickingEnd(false);
      setReceiptsRangePickerOpen(false);
    }
  };
  const receiptsReportingMonthKeys = receiptsFilterMode === "range"
    ? monthKeysInRange(effectiveReceiptsRangeStart, effectiveReceiptsRangeEnd)
    : receiptsFilterMode === "day"
    ? [effectiveReceiptsDay.slice(0, 7)]
    : [currentMonth];
  const receiptsStorageMonthKeys = storageMonthKeysFor(receiptsReportingMonthKeys);
  const receiptsDataLoaded = receiptsStorageMonthKeys.every((mk) => receiptsByMonth[mk] !== undefined);
  // Every status, unlike the Dashboard (which only counts completed sales) — Receipts is a full
  // history, cancellations and refunds included.
  const receiptsPoolAll = ledger.ordersInDays(`${receiptsReportingMonthKeys[0]}-01`, lastDayOfMonth(receiptsReportingMonthKeys[receiptsReportingMonthKeys.length - 1])) || [];
  const filteredReceipts = (
    receiptsFilterMode === "day"
      ? receiptsPoolAll.filter((r) => businessDateForTimestamp(r.timestamp, shiftHoursConfig) === effectiveReceiptsDay)
      : receiptsFilterMode === "range"
      ? receiptsPoolAll.filter((r) => { const bd = businessDateForTimestamp(r.timestamp, shiftHoursConfig); return bd >= effectiveReceiptsRangeStart && bd <= effectiveReceiptsRangeEnd; })
      : receiptsPoolAll
  ).sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0)); // newest first — the widened, multi-month pool above isn't naturally in this order
  const receiptsListSummary = summarize(filteredReceipts.filter((r) => r.status === "completed"));
  const receiptsListRevenue = receiptsListSummary.revenue;
  const receiptsListUnpaid = receiptsListSummary.unpaid.orders;
  const receiptsListUnpaidTotal = receiptsListSummary.unpaid.total;

  // Delivery tab: one delivery employee's completed deliveries for a run of business days. The order
  // amount is everything the client was charged except the delivery fee, which is listed beside it.
  const riderReportRiders = dutyRoster.filter((p) => p.role === "delivery");
  const riderReportRider = riderReportRiders.find((p) => p.id === riderReportId) || riderReportRiders[0] || null;
  const riderReportEndRaw = riderReportTo || todayLocalStr();
  const riderReportStartRaw = riderReportFrom || riderReportEndRaw;
  const [riderReportFirstDay, riderReportLastDay] = riderReportStartRaw <= riderReportEndRaw ? [riderReportStartRaw, riderReportEndRaw] : [riderReportEndRaw, riderReportStartRaw];
  const riderReportPool = ledger.ordersInDays(riderReportFirstDay, riderReportLastDay); // null until the months have loaded
  const riderReportRows = (riderReportPool && riderReportRider
    ? riderReportPool.filter((r) => r.status === "completed" && r.tableId === "delivery" && r.assignedTo?.id === riderReportRider.id)
    : []
  )
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
    .map((r) => {
      const fee = Number(r.deliveryFee) || 0;
      return { r, fee, amount: Math.round((r.total - fee) * 100) / 100 };
    });
  const riderReportOrdersTotal = riderReportRows.reduce((s, x) => s + x.amount, 0);
  const riderReportFeesTotal = riderReportRows.reduce((s, x) => s + x.fee, 0);
  const riderReportRangeText = riderReportFirstDay === riderReportLastDay ? riderReportFirstDay : `${riderReportFirstDay} → ${riderReportLastDay}`;
  const printRiderReport = () => {
    if (!riderReportRider || riderReportRows.length === 0) return;
    const locale = isRtl ? "ar-EG" : "en-US";
    const stamp = (iso) => new Date(iso).toLocaleString(locale, riderReportFirstDay === riderReportLastDay
      ? { hour: "numeric", minute: "2-digit" }
      : { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const summaryRow = (label, value, bold) => `<div class="row" style="font-size:${bold ? 14 : 12}px;${bold ? "font-weight:700;" : ""}margin-top:${bold ? 6 : 3}px;"><span>${escapeHtml(label)}</span><span>${money(value)}</span></div>`;
    const orderBlocks = riderReportRows
      .map(({ r, fee, amount }, i) => `
      <div style="border:1px solid #000;border-radius:5px;padding:6px 8px;margin-top:8px;page-break-inside:avoid;">
        <div class="row" style="font-size:10.5px;color:#444;"><span>${i + 1} &middot; ${escapeHtml(t("ticketNumber", { n: r.ticketNo }))}</span><span>${escapeHtml(stamp(r.timestamp))}</span></div>
        <div style="font-size:13px;font-weight:700;margin-top:4px;">${escapeHtml(r.customer?.name || t("riderReportNoName"))}</div>
        ${r.customer?.phone ? `<div style="font-size:11px;">${escapeHtml(r.customer.phone)}</div>` : ""}
        ${r.customer?.address ? `<div style="font-size:11px;margin-top:2px;">${escapeHtml(r.customer.address)}</div>` : ""}
        <div style="border-top:1px dashed #000;margin-top:6px;padding-top:5px;">
          <div class="row" style="font-size:12px;"><span>${escapeHtml(t("riderReportOrderAmount"))}</span><span style="font-weight:700;">${money(amount)}</span></div>
          <div class="row" style="font-size:11px;margin-top:2px;"><span>${escapeHtml(t("deliveryFeeLineLabel"))}</span><span>${money(fee)}</span></div>
        </div>
      </div>`)
      .join("");
    const body = `
      <div class="center">
        ${brandHeaderHtml()}
        <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;margin-top:8px;">${escapeHtml(t("riderReportTitle"))}</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px;">${escapeHtml(riderReportRider.name)}</div>
        <div style="font-size:11px;margin-top:2px;">${escapeHtml(riderReportRangeText)}</div>
      </div>
      <div class="dashed" style="margin-top:10px;">
        <div class="row" style="font-size:12px;"><span>${escapeHtml(t("riderReportOrders"))}</span><span>${riderReportRows.length}</span></div>
        ${summaryRow(t("riderReportOrdersTotal"), riderReportOrdersTotal)}
        ${summaryRow(t("riderReportFeesTotal"), riderReportFeesTotal)}
        <div style="border-top:1px solid #000;margin-top:6px;"></div>
        ${summaryRow(t("riderReportGrandTotal"), riderReportOrdersTotal + riderReportFeesTotal, true)}
      </div>
      ${orderBlocks}
      <div style="margin-top:26px;font-size:11px;">
        <div style="border-top:1px solid #000;padding-top:3px;">${escapeHtml(t("riderReportSignature"))}</div>
        <div style="border-top:1px solid #000;padding-top:3px;margin-top:22px;">${escapeHtml(t("riderReportReceivedBy"))}</div>
      </div>
      <div class="center" style="font-size:10px;margin-top:14px;color:#444;">${escapeHtml(t("riderReportPrintedAt", { time: new Date().toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) }))}</div>`;
    printViaHiddenFrame(`${t("riderReportTitle")} — ${riderReportRider.name}`, body, isRtl);
  };

  const availableExpenseMonths = useMemo(() => Array.from(new Set([thisMonthKey(), ...expenseMonthKeys])).sort().reverse(), [expenseMonthKeys]);
  const currentExpenseMonth = selectedExpenseMonth || thisMonthKey();
  const effectiveExpenseDay = expenseFilterDay || todayLocalStr();
  const rawExpenseRangeEnd = expenseFilterRangeEnd || todayLocalStr();
  const rawExpenseRangeStart = expenseFilterRangeStart || addDaysStr(rawExpenseRangeEnd, -6);
  const effectiveExpenseRangeStart = rawExpenseRangeStart <= rawExpenseRangeEnd ? rawExpenseRangeStart : rawExpenseRangeEnd;
  const effectiveExpenseRangeEnd = rawExpenseRangeStart <= rawExpenseRangeEnd ? rawExpenseRangeEnd : rawExpenseRangeStart;
  const handleExpenseRangeDayClick = (dateStr) => {
    if (!expenseRangePickingEnd || dateStr < effectiveExpenseRangeStart) {
      setExpenseFilterRangeStart(dateStr);
      setExpenseFilterRangeEnd(dateStr);
      setExpenseRangePickingEnd(true);
    } else {
      setExpenseFilterRangeEnd(dateStr);
      setExpenseRangePickingEnd(false);
      setExpenseRangePickerOpen(false);
    }
  };
  const [expenseFirstDay, expenseLastDay] =
    expenseFilterMode === "day" ? [effectiveExpenseDay, effectiveExpenseDay]
    : expenseFilterMode === "range" ? [effectiveExpenseRangeStart, effectiveExpenseRangeEnd]
    : [`${currentExpenseMonth}-01`, lastDayOfMonth(currentExpenseMonth)];
  const expensePeriodLoaded = monthKeysInRange(expenseFirstDay.slice(0, 7), expenseLastDay.slice(0, 7)).every((mk) => expensesByMonth[mk] !== undefined);
  // The ledger's own expense list for the period — the same one the Dashboard's Expenses figure adds up — so
  // the two tabs agree for the same dates. A whole month keeps the order it is stored in (newest logged first).
  const monthExpenses = expenseFilterMode === "month"
    ? expensesByMonth[currentExpenseMonth] || []
    : [...ledger.expensesInDays(expenseFirstDay, expenseLastDay)].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.recordedAt || "") < (a.recordedAt || "") ? -1 : 1));
  const expenseTotalThisMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const expenseByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    id: cat,
    total: monthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);
  const outstandingExpenses = monthExpenses.filter((e) => e.status === "unpaid");
  const outstandingTotal = outstandingExpenses.reduce((s, e) => s + e.amount, 0);

  // Dashboard analytics — filterable to either a whole month or a single day (dashboardMode),
  // independent of whatever month a manager might have selected in the Receipts or Expenses view
  // dropdowns elsewhere (those use selectedMonth/selectedExpenseMonth, not these). Defaults to the
  // current month / today until changed. The month containing whichever period is selected gets
  // fetched on demand (see the effect near ensureMonthLoaded) since it may not be the one already
  // loaded eagerly at startup.
  const effectiveDashboardMonth = dashboardMonth || monthLocalKey();
  const effectiveDashboardDay = dashboardDay || todayLocalStr();
  // A custom range clamps to (start <= end) regardless of which end the manager last edited, so
  // the two date pickers can never silently produce an inverted, empty-looking period.
  const rawRangeEnd = dashboardRangeEnd || todayLocalStr();
  const rawRangeStart = dashboardRangeStart || addDaysStr(rawRangeEnd, -6);
  const effectiveDashboardRangeStart = rawRangeStart <= rawRangeEnd ? rawRangeStart : rawRangeEnd;
  const effectiveDashboardRangeEnd = rawRangeStart <= rawRangeEnd ? rawRangeEnd : rawRangeStart;
  // Airbnb-style two-click picking: the first click on the calendar starts a fresh single-day
  // range, the second extends it into an end day (or, if it lands before the start, restarts the
  // range from there instead) and closes the popover.
  const handleDashboardRangeDayClick = (dateStr) => {
    if (!dashboardRangePickingEnd || dateStr < effectiveDashboardRangeStart) {
      setDashboardRangeStart(dateStr);
      setDashboardRangeEnd(dateStr);
      setDashboardRangePickingEnd(true);
    } else {
      setDashboardRangeEnd(dateStr);
      setDashboardRangePickingEnd(false);
      setDashboardRangePickerOpen(false);
    }
  };
  const dashboardActiveMonthKey = dashboardMode === "day" ? effectiveDashboardDay.slice(0, 7) : effectiveDashboardMonth;
  const dashboardReportingMonthKeys = dashboardMode === "range" ? monthKeysInRange(effectiveDashboardRangeStart, effectiveDashboardRangeEnd) : [dashboardActiveMonthKey];
  // Expenses have no business-date ambiguity (their date is picked explicitly, not derived from a
  // timestamp), so they stay scoped to exactly the reporting months — see receiptsForReportingMonths
  // for why receipts need the wider net.
  const dashboardStorageMonthKeys = storageMonthKeysFor(dashboardReportingMonthKeys);
  const dashboardMonthDataLoaded = dashboardStorageMonthKeys.every((mk) => receiptsByMonth[mk] !== undefined);

  // Everything the Dashboard shows is the ledger's figure for the chosen period — the same one the Receipts
  // footer, Close the day and the Staff tab use.
  const dashboardMonthFirstDay = `${dashboardReportingMonthKeys[0]}-01`;
  const dashboardMonthLastDay = lastDayOfMonth(dashboardReportingMonthKeys[dashboardReportingMonthKeys.length - 1]);
  const dashboardMonthReceiptsAll = (ledger.ordersInDays(dashboardMonthFirstDay, dashboardMonthLastDay) || []).filter((r) => r.status === "completed");
  const [dashboardFirstDay, dashboardLastDay] =
    dashboardMode === "day" ? [effectiveDashboardDay, effectiveDashboardDay]
    : dashboardMode === "range" ? [effectiveDashboardRangeStart, effectiveDashboardRangeEnd]
    : [dashboardMonthFirstDay, dashboardMonthLastDay];
  const dashboardPeriod = ledger.period(dashboardFirstDay, dashboardLastDay);
  const dashboardReceipts = dashboardPeriod ? dashboardPeriod.completed : [];
  const dashboardSummary = summarize(dashboardReceipts);
  const dashboardExpenseTotal = ledger.expensesInDays(dashboardFirstDay, dashboardLastDay).reduce((s, e) => s + e.amount, 0);

  const dashboardPeriodRevenue = dashboardSummary.revenue;
  const dashboardPeriodOrders = dashboardSummary.orders;
  const avgOrderValue = dashboardPeriodOrders > 0 ? dashboardPeriodRevenue / dashboardPeriodOrders : 0;
  const netProfit = dashboardPeriodRevenue - dashboardExpenseTotal;
  const dashboardDiscountTotal = dashboardSummary.discounts.total;

  // Trend chart: a bar per day when viewing a whole month or a custom range, a bar per hour when
  // viewing a single day (a single day has no "days" of its own to chart, so hour-of-day is the
  // useful breakdown instead — also doubles as a simple peak-hours read for staffing).
  const daysInDashboardMonth = (() => {
    const [y, m] = dashboardActiveMonthKey.split("-").map(Number);
    return dashboardActiveMonthKey === monthLocalKey() ? new Date().getDate() : new Date(y, m, 0).getDate();
  })();
  const dailyRevenue = Array.from({ length: daysInDashboardMonth }, (_, i) => {
    const dayStr = `${dashboardActiveMonthKey}-${String(i + 1).padStart(2, "0")}`;
    return { key: i + 1, total: dashboardMonthReceiptsAll.filter((r) => businessDateForTimestamp(r.timestamp, shiftHoursConfig) === dayStr).reduce((s, r) => s + r.total, 0) };
  });
  const hourlyRevenue = Array.from({ length: 24 }, (_, h) => ({
    key: h,
    total: dashboardReceipts.filter((r) => new Date(r.timestamp).getHours() === h).reduce((s, r) => s + r.total, 0),
  }));
  const rangeDailyRevenue = (() => {
    if (dashboardMode !== "range") return [];
    const bars = [];
    let day = effectiveDashboardRangeStart;
    while (day <= effectiveDashboardRangeEnd) {
      bars.push({ key: day, total: dashboardMonthReceiptsAll.filter((r) => businessDateForTimestamp(r.timestamp, shiftHoursConfig) === day).reduce((s, r) => s + r.total, 0) });
      day = addDaysStr(day, 1);
    }
    return bars;
  })();
  const trendBars = dashboardMode === "day" ? hourlyRevenue : dashboardMode === "range" ? rangeDailyRevenue : dailyRevenue;
  const maxTrendValue = Math.max(1, ...trendBars.map((b) => b.total));
  const bestTrendBar = trendBars.reduce((best, b) => (b.total > best.total ? b : best), { key: null, total: 0 });

  // The previous business day's month is always within one of the neighboring storage months
  // already being fetched above, so — unlike before this widened fetch existed — this comparison
  // no longer needs to silently hide itself when the previous day happens to fall in another month.
  const previousDayRevenue = (() => {
    if (dashboardMode !== "day") return null;
    const prevDayStr = addDaysStr(effectiveDashboardDay, -1);
    const prev = ledger.period(prevDayStr, prevDayStr);
    return prev ? prev.revenue : 0;
  })();
  const periodVsPreviousPct = previousDayRevenue > 0 ? Math.round(((dashboardPeriodRevenue - previousDayRevenue) / previousDayRevenue) * 100) : null;

  const dashboardItemTotals = {};
  dashboardReceipts.forEach((r) => r.items.forEach((it) => { dashboardItemTotals[it.name] = (dashboardItemTotals[it.name] || 0) + it.qty; }));
  // Which menu category each sold dish belongs to today (by id, then by name for dishes whose id changed).
  // A dish that has since been deleted from the menu has no category and is grouped under "other".
  const OTHER_CATEGORY = "__other__";
  const dashboardCategoryOf = (() => {
    const byId = {};
    const byName = {};
    const add = (cat, items) => (items || []).forEach((i) => { byId[i.id] = cat; if (byName[i.name] === undefined) byName[i.name] = cat; });
    Object.entries(menu).forEach(([cat, items]) => add(cat, items));
    menuProfiles.forEach((p) => Object.entries(p.extraItems || {}).forEach(([cat, items]) => add(cat, items)));
    return (it) => byId[it.id] ?? byName[it.name] ?? OTHER_CATEGORY;
  })();
  const dashboardItemCategory = {};
  dashboardReceipts.forEach((r) => r.items.forEach((it) => { if (dashboardItemCategory[it.name] === undefined) dashboardItemCategory[it.name] = dashboardCategoryOf(it); }));
  const dashboardCategoryOptions = [
    ...Object.keys(menu),
    ...menuProfiles.flatMap((p) => p.extraCategories || []).filter((c, i, all) => !(c in menu) && all.indexOf(c) === i),
    ...(Object.values(dashboardItemCategory).includes(OTHER_CATEGORY) ? [OTHER_CATEGORY] : []),
  ];
  const activeDashboardCategory = dashboardCategoryOptions.includes(dashboardCategory) ? dashboardCategory : "";
  const topSellers = (() => {
    if (!activeDashboardCategory) return Object.entries(dashboardItemTotals).sort((a, b) => b[1] - a[1]).map(([name, qty]) => ({ name, qty }));
    // A chosen category lists every dish on it, including the ones that sold nothing in this period.
    const names = new Set(
      activeDashboardCategory === OTHER_CATEGORY
        ? []
        : [...(menu[activeDashboardCategory] || []), ...menuProfiles.flatMap((p) => (p.extraItems || {})[activeDashboardCategory] || [])].map((i) => i.name)
    );
    Object.keys(dashboardItemTotals).forEach((name) => { if (dashboardItemCategory[name] === activeDashboardCategory) names.add(name); });
    return [...names].map((name) => ({ name, qty: dashboardItemTotals[name] || 0 })).sort((a, b) => b.qty - a.qty);
  })();
  const topSellersTotalQty = topSellers.reduce((sum, s) => sum + s.qty, 0);
  const maxTopSellerQty = Math.max(1, ...topSellers.map((s) => s.qty));

  const dashboardByMethod = PAYMENT_METHODS.map((m) => ({ ...m, total: dashboardSummary.byMethod[m.id] }));
  const maxMethodTotal = Math.max(1, ...dashboardByMethod.map((m) => m.total));

  // Categorized using data already on each receipt: deliveryMethod is only ever set for orders
  // confirmed from the general online-ordering link; among the rest, a receipt has a table label
  // for dine-in, or none for a plain staff-entered takeaway/phone order.
  const sourceCounts = { dineIn: 0, takeaway: 0, online: 0 };
  dashboardReceipts.forEach((r) => {
    if (r.deliveryMethod) sourceCounts.online++;
    else if (r.table) sourceCounts.dineIn++;
    else sourceCounts.takeaway++;
  });
  const maxSourceCount = Math.max(1, sourceCounts.dineIn, sourceCounts.takeaway, sourceCounts.online);

  const persistSuppliers = async (next) => {
    setSuppliers(next);
    return syncSet("suppliers-config", JSON.stringify(next), true, t("syncLabelExpenses"));
  };
  const fetchFreshSuppliers = async () => {
    try {
      const result = await storage.get("suppliers-config", true);
      return result?.value ? JSON.parse(result.value) : suppliers;
    } catch (e) {
      return suppliers;
    }
  };
  const addSupplierRecord = async () => {
    const name = newSupplierName.trim();
    if (!name) {
      flashNotice(t("notice_enterSupplierName"));
      return;
    }
    persistSuppliers([...(await fetchFreshSuppliers()), { id: newId("sup"), name, category: newSupplierCategory, phone: newSupplierPhone.trim() }]);
    flashNotice(t("notice_supplierAdded", { name }));
    setNewSupplierName("");
    setNewSupplierPhone("");
  };
  const removeSupplierRecord = (supplier) => {
    setConfirmDialog({
      message: t("confirm_removeSupplier", { name: supplier.name }),
      onConfirm: async () => persistSuppliers((await fetchFreshSuppliers()).filter((s) => s.id !== supplier.id)),
    });
  };

  const persistDutyRoster = async (next) => {
    setDutyRoster(next);
    return syncSet("duty-roster", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const fetchFreshDutyRoster = async () => {
    try {
      const result = await storage.get("duty-roster", true);
      return result?.value ? JSON.parse(result.value) : dutyRoster;
    } catch (e) {
      return dutyRoster;
    }
  };
  const addDutyMember = async () => {
    const name = newDutyName.trim();
    if (!name) {
      flashNotice(t("notice_enterTeamMemberName"));
      return;
    }
    persistDutyRoster([...(await fetchFreshDutyRoster()), { id: newId("duty"), name, role: newDutyRole }]);
    flashNotice(t("notice_teamMemberAdded", { name }));
    setNewDutyName("");
  };
  const removeDutyMember = (member) => {
    setConfirmDialog({
      message: t("confirm_removeTeamMember", { name: member.name }),
      onConfirm: async () => {
        persistDutyRoster((await fetchFreshDutyRoster()).filter((m) => m.id !== member.id));
        if (assignedTo?.id === member.id) setAssignedTo(null);
      },
    });
  };

  const persistDeliveryZones = async (next) => {
    setDeliveryZones(next);
    return syncSet("delivery-zones-config", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const fetchFreshDeliveryZones = async () => {
    try {
      const result = await storage.get("delivery-zones-config", true);
      return result?.value ? JSON.parse(result.value) : deliveryZones;
    } catch (e) {
      return deliveryZones;
    }
  };
  const addDeliveryZone = async () => {
    const label = newZoneLabel.trim();
    if (!label) {
      flashNotice(t("notice_enterZoneLabel"));
      return;
    }
    const fee = Number(newZoneFee) || 0;
    persistDeliveryZones([...(await fetchFreshDeliveryZones()), { id: newId("zone"), label, fee }]);
    flashNotice(t("notice_zoneAdded"));
    setNewZoneLabel("");
    setNewZoneFee("");
  };
  const startEditZone = (zone) => {
    setEditingZoneId(zone.id);
    setEditingZoneLabel(zone.label);
    setEditingZoneFee(String(zone.fee));
  };
  const saveEditZone = async () => {
    const label = editingZoneLabel.trim();
    if (!label) {
      flashNotice(t("notice_enterZoneLabel"));
      return;
    }
    const fee = Number(editingZoneFee) || 0;
    persistDeliveryZones((await fetchFreshDeliveryZones()).map((z) => (z.id === editingZoneId ? { ...z, label, fee } : z)));
    setEditingZoneId(null);
  };
  const removeDeliveryZone = (zone) => {
    setConfirmDialog({
      message: t("confirm_removeZone"),
      onConfirm: async () => persistDeliveryZones((await fetchFreshDeliveryZones()).filter((z) => z.id !== zone.id)),
    });
  };

  const openNewExpense = () => {
    setExpenseEditor({
      mode: "new",
      id: null,
      date: todayLocalStr(),
      supplierId: "",
      category: EXPENSE_CATEGORIES[0],
      amount: "",
      paymentMethod: "cash",
      status: "paid",
      dueDate: "",
      note: "",
    });
  };
  const openEditExpense = (monthKey, expense) => {
    setExpenseEditor({
      mode: "edit",
      id: expense.id,
      monthKey,
      date: expense.date,
      supplierId: expense.supplierId || "",
      category: expense.category,
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      dueDate: expense.dueDate || "",
      note: expense.note || "",
      recordedAt: expense.recordedAt || null,
    });
  };
  const closeExpenseEditor = () => setExpenseEditor(null);
  const saveExpenseEditor = () => {
    const amount = Number(expenseEditor.amount);
    if (!amount || amount <= 0) {
      flashNotice(t("notice_enterExpenseAmount"));
      return;
    }
    const supplier = suppliers.find((s) => s.id === expenseEditor.supplierId);
    const monthKey = expenseEditor.date.slice(0, 7);
    const record = {
      id: expenseEditor.id || newId("exp"),
      date: expenseEditor.date,
      supplierId: expenseEditor.supplierId || null,
      supplierName: supplier?.name || "",
      category: expenseEditor.category,
      amount,
      paymentMethod: expenseEditor.paymentMethod,
      status: expenseEditor.status,
      dueDate: expenseEditor.status === "unpaid" ? expenseEditor.dueDate : "",
      note: expenseEditor.note.trim(),
      recordedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
      // When this expense was actually logged (not the business `date` it's dated for) — lets the
      // Shift tab attribute it to a specific shift the same way receipts already are, by comparing
      // against shiftStart. Preserved across edits so editing an expense doesn't reattribute it.
      recordedAt: expenseEditor.recordedAt || new Date().toISOString(),
    };
    if (expenseEditor.mode === "new") {
      appendExpense(monthKey, record);
    } else {
      // If the date was edited into a different month, move the record rather than leaving a
      // stale copy behind in its original month.
      if (monthKey !== expenseEditor.monthKey) {
        deleteExpenseFromMonth(expenseEditor.monthKey, expenseEditor.id);
        appendExpense(monthKey, record);
      } else {
        updateExpenseInMonth(monthKey, expenseEditor.id, () => record);
      }
    }
    flashNotice(t("notice_expenseSaved"));
    setExpenseEditor(null);
  };
  const deleteExpense = (monthKey, expense) => {
    setConfirmDialog({
      message: t("confirm_deleteExpense"),
      onConfirm: () => {
        deleteExpenseFromMonth(monthKey, expense.id);
        flashNotice(t("notice_expenseDeleted"));
      },
    });
  };
  const markExpensePaid = (monthKey, expense) => {
    updateExpenseInMonth(monthKey, expense.id, (e) => ({ ...e, status: "paid", dueDate: "" }));
    flashNotice(t("notice_expenseSaved"));
  };


  // Cancelling or refunding asks HOW the money went back to the customer, defaulting to however
  // the order was paid. That choice is saved on the receipt (returnedAmounts) so the cash
  // reconciliation can take cash out of the drawer only when cash was actually handed back — an
  // InstaPay order refunded in cash empties the drawer even though it never filled it.
  const openReturnDialog = (r, action) => {
    if (r.status !== "completed") return;
    const isSplit = r.paymentMethod === "split" && Array.isArray(r.splitPayments) && r.splitPayments.length > 0;
    setReturnDialog({ receipt: r, action, method: isSplit ? "same" : r.paymentMethod || "cash" });
  };
  const cancelReceipt = (r) => openReturnDialog(r, "cancel");
  const refundReceipt = (r) => openReturnDialog(r, "refund");
  const confirmReturnDialog = () => {
    if (!returnDialog) return;
    const { receipt: r, action, method } = returnDialog;
    const wasPaid = r.paid !== false;
    const returnedAmounts = !wasPaid
      ? []
      : method === "same"
      ? receiptMethodAmounts(r).map((a) => ({ method: a.method, amount: a.amount }))
      : [{ method, amount: r.total }];
    const at = new Date().toISOString();
    const by = currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null;
    setReturnDialog(null);
    if (action === "cancel") {
      r.items.forEach((it) => (it.recipeSnapshot || []).forEach((rec) => updateIngredientStock(rec.ingredientId, rec.qty * it.qty)));
      updateReceiptInStorage(r, (x) => ({ ...x, status: "cancelled", cancelledAt: at, cancelledBy: by, returnedAmounts }));
      flashNotice(t("notice_orderCancelled", { n: r.ticketNo }));
    } else {
      updateReceiptInStorage(r, (x) => ({ ...x, status: "refunded", refundedAt: at, refundedBy: by, returnedAmounts }));
      flashNotice(t("notice_orderRefunded", { n: r.ticketNo }));
    }
  };

  // Sends the status-update WhatsApp message and logs it on the receipt.
  //
  // If WHATSAPP_BACKEND_URL is set, this POSTs to your own backend and the message goes out
  // completely silently — no tab, no manual Send. Your backend is the thing that actually calls
  // Meta's WhatsApp Business Cloud API using a permanent access token. That token can never live
  // here in the browser code (anyone could open dev tools and steal it), which is why this app
  // talks to your backend instead of Meta's API directly.
  //
  // If WHATSAPP_BACKEND_URL is left null, there's no way to auto-send from the browser alone, so
  // we show the message in a small dialog with a real "Open WhatsApp" link (wa.me) plus a copy
  // button — a genuine link tap is far more reliable across browsers/sandboxes than a script
  // calling window.open(), which gets treated as an unwanted pop-up in some contexts.
  //
  // A minimal backend (Node/Express) that this call is designed to work with:
  //
  //   app.post("/send-whatsapp", async (req, res) => {
  //     const { to, message } = req.body;
  //     const r = await fetch(
  //       `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
  //       {
  //         method: "POST",
  //         headers: {
  //           Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({
  //           messaging_product: "whatsapp",
  //           to,
  //           type: "text",
  //           text: { body: message },
  //         }),
  //       }
  //     );
  //     res.status(r.ok ? 200 : 502).json(await r.json());
  //   });
  //
  // You'd get WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN from Meta's WhatsApp Business
  // Platform setup (business.facebook.com), keep them as server-side env vars, deploy the backend
  // anywhere (Render, Railway, a small VPS...), then just set WHATSAPP_BACKEND_URL above to its URL.
  // Note: outside a 24-hour customer-initiated window, Meta requires pre-approved message templates
  // rather than free-form text — worth checking when you set this up.
  const sendWhatsAppUpdate = async (receipt, statusId) => {
    const phoneDigits = normalizePhoneForWhatsApp(receipt.customer?.phone);
    if (!phoneDigits) {
      flashNotice(t("notice_noPhoneOnFile", { n: receipt.ticketNo }));
      return;
    }
    const buildMessage = (WHATSAPP_TEMPLATES[lang] || WHATSAPP_TEMPLATES.en)[statusId];
    if (!buildMessage) return;
    const message = buildMessage(receipt);

    let sentSilently = false;
    if (WHATSAPP_BACKEND_URL) {
      try {
        const res = await fetch(WHATSAPP_BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phoneDigits, message }),
        });
        if (!res.ok) throw new Error(`Backend responded ${res.status}`);
        sentSilently = true;
        flashNotice(t("notice_whatsappSentTo", { name: receipt.customer?.name || phoneDigits }));
      } catch (e) {
        console.error("WhatsApp backend send failed:", e);
        flashNotice(t("notice_whatsappBackendFailed"));
      }
    }

    // No backend configured (the common case — see WHATSAPP_BACKEND_URL above): rather than
    // showing our own modal that staff must read and click through first, jump straight to the
    // wa.me deep link. This still opens WhatsApp with the message pre-filled and still requires
    // one manual tap of Send there — WhatsApp itself never allows a page to send on someone's
    // behalf without that tap, no app can bypass it — but it removes the extra step of our own
    // confirmation screen in between. Called synchronously within the original click handler (no
    // await precedes this when there's no backend), so this still counts as a user gesture and
    // won't be popup-blocked. Only falls back to the old modal if the browser blocks it anyway.
    if (!sentSilently) {
      const waWindow = window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      if (waWindow) {
        flashNotice(t("notice_whatsappOpenedFor", { name: receipt.customer?.name || phoneDigits }));
      } else {
        setWhatsappFallback({ phone: phoneDigits, message, name: receipt.customer?.name || phoneDigits });
      }
    }

    const logEntry = { status: statusId, sentAt: new Date().toISOString(), phone: receipt.customer?.phone, silent: sentSilently };
    updateReceiptInStorage(receipt, (x) => ({ ...x, whatsappLog: [...(x.whatsappLog || x.smsLog || []), logEntry] }));
  };

  const updateFulfillmentStatus = (r, statusId) => {
    const updated = { ...r, fulfillmentStatus: statusId };
    updateReceiptInStorage(r, () => updated);
    flashNotice(t("notice_orderMarked", { n: r.ticketNo, status: t(`status_${statusId}`) }));
    const statusDef = FULFILLMENT_STATUSES.find((s) => s.id === statusId);
    if (statusDef?.whatsapp) sendWhatsAppUpdate(updated, statusId);
  };

  // Reassigns which waiter/delivery person a saved order is attributed to — a manager correction,
  // separate from editItemsHistory since it's not a change to what was ordered.
  const assignReceiptTo = (r, member) => {
    const updated = { ...r, assignedTo: member ? { id: member.id, name: member.name, role: member.role } : null };
    updateReceiptInStorage(r, () => updated);
  };

  // Marks a "pay later" order as actually paid, the moment the cash (or card) is actually
  // collected — which is what the cash reconciliation keys off, not when the order was rung up.
  const markReceiptPaid = (r) => {
    setConfirmDialog({
      message: t("confirm_markOrderPaid", { n: r.ticketNo }),
      onConfirm: () => {
        const updated = { ...r, paid: true, paidAt: new Date().toISOString() };
        updateReceiptInStorage(r, () => updated);
        flashNotice(t("notice_orderMarkedPaid", { n: r.ticketNo }));
      },
    });
  };

  const startEditReceipt = (r) => {
    setEditingReceiptId(r.id);
    setEditDraftItems(r.items.map((it) => ({ ...it })));
    setEditReason("");
    setEditPaymentMethod(r.paymentMethod || null);
    setEditDraftDiscount(r.discount ? { type: r.discount.type, value: String(r.discount.value), reason: r.discount.reason || "" } : { type: "percent", value: "", reason: "" });
  };
  const cancelEditReceipt = () => {
    setEditingReceiptId(null);
    setEditDraftItems([]);
    setEditReason("");
    setEditPaymentMethod(null);
    setEditDraftDiscount({ type: "percent", value: "", reason: "" });
  };
  // What the edited discount boxes mean for this order: the discount to store (null = none), whether the
  // discount itself changed (so it needs a reason and goes in the edit history), or which notice to show.
  const resolveEditDiscount = (r) => {
    const d = editDraftDiscount;
    const v = Number(d.value);
    const old = r.discount || null;
    if (String(d.value).trim() === "" || v === 0) return { discount: null, changed: !!old };
    if (!(v > 0) || (d.type === "percent" && v > 100)) return { error: "notice_enterDiscountValue" };
    const reason = (d.reason || "").trim();
    if (old && old.type === d.type && Number(old.value) === v) {
      // same discount — only the wording of the reason may differ
      return { discount: reason.length >= 3 && reason !== (old.reason || "") ? { ...old, reason } : old, changed: false };
    }
    if (reason.length < 3) return { error: "notice_discountReasonRequired" };
    return { discount: { type: d.type, value: v, reason }, changed: true };
  };
  // The bill for an order after an edit — worked out with THIS order's own service/VAT rates, never today's.
  const editedBillFor = (r, items, disc) => {
    const newSubtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const newDiscAmt = discountAmount(newSubtotal, disc);
    const newNet = newSubtotal - newDiscAmt;
    const newServiceAmt = Math.round(newNet * ((r.serviceRate || 0) / 100) * 100) / 100;
    const newVatAmt = Math.round((newNet + newServiceAmt) * ((r.vatRate || 0) / 100) * 100) / 100;
    return { subtotal: newSubtotal, discountAmount: newDiscAmt, serviceAmount: newServiceAmt, vatAmount: newVatAmt, total: newNet + newServiceAmt + newVatAmt + (r.deliveryFee || 0) };
  };
  const changeEditQty = (index, delta, original) => {
    setEditDraftItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = it.qty + delta;
        if (next < 0) return it;
        if (delta > 0) {
          const increaseBy = next - original;
          // The extra units consume the dish's CURRENT recipe, not the frozen recipeSnapshot taken
          // when this line was first ordered — if the recipe's been edited since (an ingredient
          // removed, say), checking against the old snapshot could block on stock for an ingredient
          // the dish doesn't even use anymore.
          const menuItem = findMenuItemAnywhere(it.id);
          const currentRecipe = menuItem?.recipe || it.recipeSnapshot || [];
          const shortage = currentRecipe.find((rec) => (ingredients[rec.ingredientId]?.stock ?? 0) < rec.qty * increaseBy);
          if (increaseBy > 0 && shortage) {
            flashNotice(t("notEnoughToIncrease", { ingredient: ingredients[shortage.ingredientId]?.name || t("genericStock") }));
            return it;
          }
        }
        return { ...it, qty: next };
      })
    );
  };
  const saveEditReceipt = (r) => {
    // Checked before anything is touched, so a missing reason never leaves stock half-adjusted.
    const discountEdit = hasFeature("discounts") ? resolveEditDiscount(r) : { discount: r.discount || null, changed: false };
    if (discountEdit.error) {
      flashNotice(t(discountEdit.error));
      return;
    }
    // Paired by position, not by menu item id — a receipt can have two lines for the same dish
    // with different notes (e.g. one plain, one "no onions"), and matching by id alone would
    // conflate them.
    const changes = [];
    const finalItems = [];
    r.items.forEach((orig, i) => {
      const edited = editDraftItems[i];
      const newQty = edited ? edited.qty : 0;
      const delta = orig.qty - newQty; // positive = fewer than before, negative = more than before
      let recipeForItem = orig.recipeSnapshot;
      if (delta > 0) {
        // Fewer units than before — restore stock using the recipe those units were actually
        // bought under, i.e. what was actually deducted at the time.
        (orig.recipeSnapshot || []).forEach((rec) => updateIngredientStock(rec.ingredientId, rec.qty * delta));
      } else if (delta < 0) {
        // More units than before — the extra units consume the dish's CURRENT recipe (it may have
        // changed since this order was placed), same as if they were being ordered fresh. The
        // line's stored recipeSnapshot is updated to match, so a later decrease restores correctly.
        const menuItem = findMenuItemAnywhere(orig.id);
        const currentRecipe = menuItem?.recipe || orig.recipeSnapshot || [];
        const increaseBy = -delta;
        currentRecipe.forEach((rec) => updateIngredientStock(rec.ingredientId, -rec.qty * increaseBy));
        recipeForItem = currentRecipe;
      }
      if (delta !== 0) changes.push({ name: orig.name, from: orig.qty, to: newQty });
      if (newQty > 0) finalItems.push({ ...(edited || orig), qty: newQty, recipeSnapshot: recipeForItem });
    });
    const paymentMethodChanged = editPaymentMethod && editPaymentMethod !== r.paymentMethod;
    if (paymentMethodChanged) {
      changes.push({ name: t("paymentMethodEditLabel"), from: t(`payment_${r.paymentMethod}`), to: t(`payment_${editPaymentMethod}`) });
    }
    const cleaned = finalItems;
    // Recomputed using THIS receipt's own stored rates, not today's live settings — editing an
    // old order shouldn't retroactively apply a VAT/service rate change made since then.
    const bill = editedBillFor(r, cleaned, discountEdit.discount);
    const { subtotal: newSubtotal, discountAmount: newDiscAmt, serviceAmount: newServiceAmt, vatAmount: newVatAmt } = bill;
    if (discountEdit.changed) {
      // The discount's own effect on the bill, measured on the new items so a dish change isn't counted twice.
      const before = Math.round(discountAmount(newSubtotal, r.discount) * 100) / 100;
      const after = Math.round(newDiscAmt * 100) / 100;
      const nd = discountEdit.discount;
      changes.push({
        name: t("discountEditLabel"),
        from: before,
        to: after,
        kind: "discount",
        detail: nd ? `${nd.type === "percent" ? `${nd.value}%` : money(Number(nd.value))} — ${nd.reason}` : t("editHistoryDiscountRemoved"),
      });
    }
    const historyEntry = changes.length > 0
      ? {
          timestamp: new Date().toISOString(),
          editedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
          reason: editReason.trim(),
          changes,
        }
      : null;
    const newTotal = bill.total;
    // Saved with the edit so what an edit did to the bill is known exactly, not worked out later from
    // dish prices (Close the day uses this to explain cash gaps).
    if (historyEntry) {
      historyEntry.totalBefore = r.total;
      historyEntry.totalAfter = newTotal;
    }
    // A split-payment breakdown is fixed dollar amounts, not a formula like the discount/VAT
    // rates above — editing quantities changes the total, so rescale each method's share
    // proportionally to keep receiptMethodAmounts(r) still summing to the new total. Not a
    // perfect reconstruction of who'd actually pay what, but keeps reporting internally
    // consistent rather than silently drifting from the receipt's own total.
    const rescaledSplitPayments = r.paymentMethod === "split" && Array.isArray(r.splitPayments) && r.total > 0
      ? r.splitPayments
          .map((sp) => ({ method: sp.method, amount: Math.round(sp.amount * (newTotal / r.total) * 100) / 100 }))
          .filter((sp) => sp.amount > 0)
      : r.splitPayments;
    const updatedReceipt = {
      ...r,
      items: cleaned,
      subtotal: newSubtotal,
      discount: discountEdit.discount,
      discountAmount: newDiscAmt,
      serviceAmount: newServiceAmt,
      vatAmount: newVatAmt,
      total: newTotal,
      // Switching away from a split payment to a single method retires the per-method breakdown —
      // there's no sensible way to keep it once it's no longer actually split.
      paymentMethod: editPaymentMethod || r.paymentMethod,
      splitPayments: paymentMethodChanged ? undefined : rescaledSplitPayments,
      editHistory: historyEntry ? [historyEntry, ...(r.editHistory || [])] : r.editHistory,
    };
    updateReceiptInStorage(r, () => updatedReceipt);
    flashNotice(t("notice_orderUpdated", { n: r.ticketNo }));
    cancelEditReceipt();
  };

  // A shift's numbers are always worked out from the CURRENT receipts inside its clock-in..clock-out
  // window (by the employee who served them), never from the totals saved at clock-out — an open
  // pay-later bill can grow, or an order can be edited, after the person has gone home. Counts
  // exactly what the Dashboard counts: completed orders at their current total. Returns null until
  // every month the shift touches has been loaded.
  const shiftLiveStats = (sh) => ledger.shiftTotals(sh, nowTick);
  // Every month this shift touches (a shift that crosses the end of a month keeps its orders in two stores).
  const monthReceiptsForShift = (shiftStart ? monthKeysInRange(storageMonthOf(shiftStart), thisMonthKey()) : [thisMonthKey()]).flatMap((mk) => receiptsByMonth[mk] || []);
  // Every shift currently open on any device, with orders/revenue computed live from shared
  // receipts — same idea as this device's own shiftCompleted/shiftGross below, generalized to
  // whichever employee+clockIn pair the open-shifts registry lists. Anything left behind by a
  // device that closed without clocking out (crash, browser killed, etc.) fades out of this list
  // after a day, so a manager checking in remotely never sees a permanently "stuck open" shift.
  const openShiftsList = Object.values(openShifts)
    .filter((s) => Date.now() - new Date(s.clockIn).getTime() < 24 * 60 * 60 * 1000)
    .map((s) => {
      const live = shiftLiveStats(s);
      if (live) return { ...s, orders: live.orders, revenue: live.revenue };
      const receipts = monthReceiptsForShift.filter((r) => r.servedBy?.id === s.employeeId && r.timestamp >= s.clockIn && r.status === "completed");
      return { ...s, orders: receipts.length, revenue: receipts.reduce((sum, r) => sum + r.total, 0) };
    })
    .sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn));
  const shiftReceipts = shiftStart ? monthReceiptsForShift.filter((r) => r.timestamp >= shiftStart) : [];
  const shiftCompleted = shiftReceipts.filter((r) => r.status === "completed");
  const shiftCancelled = shiftReceipts.filter((r) => r.status === "cancelled");
  const shiftRefunded = shiftReceipts.filter((r) => r.status === "refunded");
  const shiftRefundsTotal = shiftRefunded.reduce((s, r) => s + r.total, 0);
  // "Gross" is everything rung up this shift, INCLUDING orders since refunded — a refunded order
  // stops being "completed", so counting only completed orders here and then subtracting refunds
  // again took every refund off twice. Gross minus refunds is therefore exactly the completed
  // orders, the same figure the Dashboard reports.
  const shiftGross = shiftCompleted.reduce((s, r) => s + r.total, 0) + shiftRefundsTotal;
  // Expenses only carry a business `date` (day granularity), not a precise time, so an expense
  // logged before this field existed falls back to midnight of its date — good enough to tell
  // whether it landed within this shift's window, just not to the minute like receipts are.
  const shiftExpenses = shiftStart
    ? (expensesByMonth[thisMonthKey()] || []).filter((e) => (e.recordedAt || `${e.date}T00:00:00.000Z`) >= shiftStart)
    : [];
  const shiftExpenseTotal = shiftExpenses.reduce((s, e) => s + e.amount, 0);
  // An order rung up as "pay later" doesn't belong in cash reconciliation until it's actually
  // paid — and conversely, an order rung up on a PREVIOUS shift that gets paid on this one belongs
  // here, not there, since that's when the money actually entered the drawer. So payment totals
  // are scoped by paidAt (falling back to timestamp for ordinary paid-immediately orders and for
  // receipts saved before this field existed), not by when the order itself was created.
  const paymentsCollectedThisShift = shiftStart
    ? monthReceiptsForShift.filter((r) => r.status === "completed" && r.paid !== false && (r.paidAt || r.timestamp) >= shiftStart)
    : [];
  const paymentsCollectedThisShiftAmounts = paymentsCollectedThisShift.flatMap(receiptMethodAmounts);
  const shiftByMethod = PAYMENT_METHODS.map((m) => ({
    ...m,
    total: paymentsCollectedThisShiftAmounts.filter((a) => a.method === m.id).reduce((s, a) => s + a.amount, 0),
    // Counts orders that touched this method at all — a split order can count toward more than
    // one method's count, same as it contributes to more than one method's total.
    count: paymentsCollectedThisShift.filter((r) => receiptMethodAmounts(r).some((a) => a.method === m.id)).length,
  }));
  // A delivery rider physically holds the cash they collect until settleDeliveryCash marks it
  // settled — until then it hasn't reached the drawer, so it doesn't belong in what the drawer
  // is expected to hold. The "by payment method" breakdown above still counts it as cash revenue
  // (it genuinely was paid in cash), only this drawer-facing total excludes it until settled.
  //
  // Money received and money handed back, per method, for the drawer / statement checks:
  //  - Received: every paid order collected this shift — completed ones, plus cancelled/refunded
  //    ones that carry a return time (the money DID come in when they were paid).
  //  - Handed back: those same cancelled/refunded orders, by the method they were actually returned
  //    in (returnedAmounts, defaulting to how they were paid) at the moment they were returned.
  // So a sale paid and returned within one shift nets to zero; one paid in an earlier shift and
  // returned now takes cash out of THIS drawer; and an InstaPay order handed back in cash empties
  // the drawer even though it never filled it. Cancelled/refunded orders from before return times
  // were recorded carry none of this and, as before, count as if they never happened.
  const reconCollected = shiftStart
    ? monthReceiptsForShift.filter((r) => r.paid !== false && (r.status === "completed" || returnTimeOf(r)) && (r.paidAt || r.timestamp) >= shiftStart)
    : [];
  const returnsThisShift = shiftStart
    ? monthReceiptsForShift.filter((r) => returnTimeOf(r) && returnTimeOf(r) >= shiftStart && r.paid !== false)
    : [];
  // The drawer's movements since this shift started — the same calculation Close the day makes for a
  // finished shift (src/ledger.js cashFlows), just with the window still open.
  const shiftFlows = shiftStart
    ? cashFlows(monthReceiptsForShift, Object.values(expensesByMonth).flat(), (iso) => iso >= shiftStart)
    : { cashIn: 0, cashReturned: 0, cashExpenses: 0, paidOut: 0 };
  const shiftCashSalesTotal = shiftFlows.cashIn;
  // Shown as its own line in the drawer reconciliation so the gap against "by payment method"
  // above is explained, instead of just looking like the numbers don't add up.
  const shiftUnsettledDeliveryCash = paymentsCollectedThisShift
    .filter((r) => r.tableId === "delivery" && !r.deliverySettled)
    .flatMap(receiptMethodAmounts)
    .filter((a) => a.method === "cash")
    .reduce((s, a) => s + a.amount, 0);
  const shiftUnpaid = shiftCompleted.filter((r) => r.paid === false);
  const shiftUnpaidTotal = shiftUnpaid.reduce((s, r) => s + r.total, 0);
  // A cash refund is cash actually leaving the drawer back to the customer — unlike a cancellation
  // (which the app treats as the order never having happened financially), so it belongs in the
  // cash reconciliation the same way an expense paid in cash does. But if it's an unsettled
  // delivery order, that cash was never counted as a sale in the drawer to begin with (see
  // shiftCashSalesTotal above) — the rider is still holding it, so refunding it doesn't remove
  // anything from the drawer either. Without this exclusion, refunding one of these swung the
  // drawer negative by subtracting cash that was never added.
  const shiftCashRefundsTotal = shiftFlows.cashReturned;
  const shiftDiscountedOrders = shiftCompleted.filter((r) => (r.discountAmount || 0) > 0);
  const shiftDiscountTotal = shiftDiscountedOrders.reduce((s, r) => s + (r.discountAmount || 0), 0);
  // Cash paid out of the drawer belongs to the shift in which it was recorded. This used to be matched by
  // calendar date, which charged an evening shift with the cash expenses the morning shift had already
  // taken out (and already counted in its own closing count) — the same money was subtracted twice and
  // the drawer showed a false surplus. Now it is matched by the moment the expense was recorded, like
  // the Close the day screen does; an expense saved before that moment existed falls back to midnight
  // of its date.
  const shiftCashExpenses = shiftStart
    ? Object.values(expensesByMonth).flat().filter((e) => e.status === "paid" && e.paymentMethod === "cash" && (e.recordedAt || `${e.date}T00:00:00.000Z`) >= shiftStart)
    : [];
  const shiftCashExpensesTotal = shiftFlows.cashExpenses;
  const shiftRiderPayTotal = shiftFlows.riderPay || 0; // riders' fee share kept (or paid out) when delivery was settled during this shift
  const myOpenShiftEntry = currentEmployee ? openShifts[currentEmployee.id] : null;
  const openingCountedThisShift = !!(myOpenShiftEntry && myOpenShiftEntry.clockIn === shiftStart && myOpenShiftEntry.openingCash !== undefined);
  // For a shift that started with the mandatory count, the counted figure IS the opening cash.
  const openingFloatNum = openingCountedThisShift ? myOpenShiftEntry.openingCash : Number(openingFloat) || 0;
  const expectedCash = openingFloatNum + shiftCashSalesTotal - shiftCashRefundsTotal - shiftCashExpensesTotal - shiftRiderPayTotal;
  const countedCashNum = countedCash === "" ? null : Number(countedCash) || 0;
  const cashVariance = countedCashNum === null ? null : Math.round((countedCashNum - expectedCash) * 100) / 100;

  // Visa / InstaPay / Wallet don't have a physical drawer to count, but a manager can still check
  // what actually landed in the bank or gateway statement against what the shift expects for that
  // method (sales minus refunds) — same idea as the cash count above, just no opening float, since
  // an electronic balance doesn't carry a physical float over from one shift to the next.
  const shiftElectronicMethods = PAYMENT_METHODS.filter((m) => m.id !== "cash").map((m) => {
    const sales = reconCollected.flatMap(receiptMethodAmounts).filter((a) => a.method === m.id).reduce((sum, a) => sum + a.amount, 0);
    const refunds = returnsThisShift.flatMap(returnAmountsOf).filter((a) => a.method === m.id).reduce((s, a) => s + a.amount, 0);
    const expected = Math.round((sales - refunds) * 100) / 100;
    const confirmedRaw = confirmedElectronic[m.id];
    const confirmedNum = confirmedRaw === undefined || confirmedRaw === "" ? null : Number(confirmedRaw) || 0;
    const variance = confirmedNum === null ? null : Math.round((confirmedNum - expected) * 100) / 100;
    return { ...m, sales, refunds, expected, confirmedNum, variance };
  });

  // ---- Close the day: everything about one business day, worked out from the saved orders, shifts,
  // counts and expenses — never from a number typed in on the day. ----
  const cdRound = round2;
  const buildCloseDay = (day) => ledger.closeDay(day, nowTick);
  // Plain-language explanation of one shift's gap, as a list of lines (used on screen and in the report).
  const cdFmtTime = (iso) => new Date(iso).toLocaleString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" });
  const cdEventText = (e) => {
    const lbl = (id) => t(`payment_${id}`);
    if (e.kind === "pay") return t(e.from === "cash" ? "cdEditCashToOther" : "cdEditOtherToCash", { n: e.n, amount: money(e.orderTotal), from: lbl(e.from), to: lbl(e.to), by: e.by || "—", at: cdFmtTime(e.at), paidAt: cdFmtTime(e.paidAt) }) + (e.afterClose ? ` ${t("cdAfterClose")}` : "");
    if (e.kind === "qtyDown") return t("cdItemQtyDown", { n: e.n, list: e.list, by: e.by || "—", at: cdFmtTime(e.at), about: e.approx ? t("cdAbout") : "", amount: money(Math.abs(e.amount)) }) + (e.afterClose ? ` ${t("cdAfterClose")}` : "");
    if (e.kind === "qtyUp") return t("cdItemQtyUp", { n: e.n, list: e.list, by: e.by || "—", at: cdFmtTime(e.at), about: e.approx ? t("cdAbout") : "", amount: money(Math.abs(e.amount)) }) + (e.afterClose ? ` ${t("cdAfterClose")}` : "");
    if (e.kind === "discountDown") return t("cdDiscountDown", { n: e.n, list: e.list, by: e.by || "—", at: cdFmtTime(e.at), about: e.approx ? t("cdAbout") : "", amount: money(Math.abs(e.amount)) }) + (e.afterClose ? ` ${t("cdAfterClose")}` : "");
    if (e.kind === "discountUp") return t("cdDiscountUp", { n: e.n, list: e.list, by: e.by || "—", at: cdFmtTime(e.at), about: e.approx ? t("cdAbout") : "", amount: money(Math.abs(e.amount)) }) + (e.afterClose ? ` ${t("cdAfterClose")}` : "");
    if (e.kind === "legacyVoid") return t("cdItemLegacyVoid", { n: e.n, amount: money(e.amount), status: t(e.status === "cancelled" ? "cancelledBadge" : "refundedBadge").toLowerCase() });
    return t("cdItemLooseExpense", { what: e.what, amount: money(Math.abs(e.amount)) });
  };
  const cdSigned = (n) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}`;
  const cdGapLines = (d) => {
    const lines = [];
    const short = d.gap < 0;
    lines.push({ strong: true, text: t(short ? "cdGapShort" : "cdGapOver", { name: d.name, amount: money(Math.abs(d.gap)) }) });
    if (d.gapAtClosing !== null && Math.abs(d.gapAtClosing - d.gap) >= 0.01) {
      lines.push({ text: t("cdAtClosing", { expected: money(d.savedExpected), gap: cdSigned(d.gapAtClosing), now: money(d.expected) }) });
    }
    if (d.solve && d.solve.items.length > 0) {
      d.solve.items.forEach((e) => lines.push({ bullet: true, text: cdEventText(e) }));
      lines.push({ text: d.solve.type === "exact" ? t("cdExplainedExact", { sum: cdSigned(d.solve.explained) }) : t("cdExplainedPartial", { explained: money(Math.abs(d.solve.explained)), gap: money(Math.abs(d.gap)), rest: money(Math.abs(d.solve.rest)) }) });
    } else if (d.events.length > 0) {
      lines.push({ text: t("cdFound") });
      d.events.slice(0, 4).forEach((e) => lines.push({ bullet: true, text: cdEventText(e) }));
      lines.push({ text: t("cdNoCause") });
    } else {
      lines.push({ text: t("cdNoCause") });
    }
    return lines;
  };
  const cdHandoverLines = (d) => {
    if (d.handover === null || Math.abs(d.handover) < 0.01) return [];
    const lines = [];
    const b = d.between;
    if (b && (b.cashIn > 0 || b.paidOut > 0)) {
      const who = Object.entries(b.who).map(([n, a]) => `${n} ${money(a)}`).join(", ") || "—";
      const residualText = Math.abs(b.residual) < 0.01 ? t("cdHandoverFlowMatch") : t(b.residual < 0 ? "cdHandoverFlowMissing" : "cdHandoverFlowExtra", { diff: money(Math.abs(b.residual)) });
      lines.push({ strong: true, text: t("cdHandoverFlowTitle", { from: d.prevName, to: d.name }) });
      lines.push({ text: t("cdHandoverFlow", { from: d.prevName, previous: money(d.prevCounted), received: money(b.cashIn), who, paidOut: money(b.paidOut), expected: money(b.expectedOpening), to: d.name, opening: money(d.opening), result: residualText }) });
      if (b.cashIn > 0) lines.push({ text: t("cdHandoverNoShift") });
    } else {
      lines.push({ strong: true, text: t("cdHandoverGapTitle", { diff: money(Math.abs(d.handover)), from: d.prevName, to: d.name }) });
      lines.push({ text: t(d.handover < 0 ? "cdHandoverMissing" : "cdHandoverExtra") });
    }
    return lines;
  };

  // ---- Close the day: signing a day off ----
  const cdSnapshot = (cd) => ({
    revenue: cdRound(cd.revenue),
    orders: cd.orders,
    expenseTotal: cdRound(cd.expenseTotal),
    byMethod: cd.byMethod.map((m) => ({ id: m.id, total: cdRound(m.total) })),
    drawers: cd.drawers.filter((d) => !d.loading).map((d) => ({ key: d.key, name: d.name, clockIn: d.clockIn, clockOut: d.clockOut, opening: d.opening, cashIn: cdRound(d.cashIn), paidOut: cdRound(d.paidOut), expected: d.expected, counted: d.counted, gap: d.gap })),
    dayTotals: cd.dayTotals,
  });
  // What is different now compared with when the day was signed off (late edits, late payments...).
  const cdChangesSince = (before, after) => {
    const out = [];
    const diff = (what, x, y) => {
      if (x === null || x === undefined || y === null || y === undefined) return;
      if (Math.abs(x - y) >= 0.01) out.push(t("cdChangeLine", { what, before: money(x), after: money(y) }));
    };
    diff(t("cdRevenue"), before.revenue, after.revenue);
    if (before.orders !== after.orders) out.push(t("cdChangeLine", { what: t("cdOrders"), before: String(before.orders), after: String(after.orders) }));
    diff(t("cdExpenses"), before.expenseTotal, after.expenseTotal);
    (before.drawers || []).forEach((bd) => {
      const ad = (after.drawers || []).find((x) => x.key === bd.key);
      if (ad) diff(`${bd.name}: ${t("cdShouldBe")}`, bd.expected, ad.expected);
    });
    if (before.dayTotals && after.dayTotals) diff(`${t("cdWholeDay")}: ${t("cdGap")}`, before.dayTotals.gap, after.dayTotals.gap);
    return out;
  };
  // The cash taken out of the drawer at the end of a business day. Read fresh and written back whole (like the
  // sign-offs), so two devices never overwrite each other's other days.
  const writeDayCollection = async (day, entry) => {
    let fresh;
    try {
      const result = await storage.get("day-collections", true);
      fresh = result?.value ? JSON.parse(result.value) : {};
    } catch (e) {
      flashNotice(t("notice_outOfStockSaveFailed"));
      return;
    }
    const next = { ...fresh };
    if (entry) next[day] = entry;
    else delete next[day];
    setDayCollections(next);
    setCollectionDraft({ day: null, value: "" });
    await syncSet("day-collections", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const saveDayCollection = (day, valueText) => {
    const amount = Math.round(Number(valueText) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0) return;
    writeDayCollection(day, { amount, by: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null, at: new Date().toISOString() });
  };
  const saveDayClosing = async (cd, note) => {
    if (closingDaySaving) return;
    setClosingDaySaving(true);
    try {
      let fresh;
      try {
        const result = await storage.get("day-closings", true);
        fresh = result?.value ? JSON.parse(result.value) : {};
      } catch (e) {
        flashNotice(t("notice_outOfStockSaveFailed"));
        return;
      }
      const record = {
        id: newId("close"),
        closedAt: new Date().toISOString(),
        closedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
        note,
        snapshot: cdSnapshot(cd),
      };
      const next = { ...fresh, [cd.day]: [...(fresh[cd.day] || []), record] };
      setDayClosings(next);
      await syncSet("day-closings", JSON.stringify(next), true, t("syncLabelSettings"));
      setCloseDayModal(null);
      flashNotice(t("notice_dayClosed"));
    } finally {
      setClosingDaySaving(false);
    }
  };
  const buildCloseDayReportHtml = (cd, closing, anyGap) => {
    const e = (x) => escapeHtml(String(x ?? ""));
    const row = (a, b, style = "") => `<div class="row" style="${style}"><span>${e(a)}</span><span>${e(b)}</span></div>`;
    const dayLabel = new Date(`${cd.day}T00:00:00Z`).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const tf = { hour: "numeric", minute: "2-digit" };
    const loc = isRtl ? "ar-EG" : "en-US";
    const lines = (arr) => arr.map((l) => `<div style="margin-top:4px;${l.strong ? "font-weight:700;" : ""}${l.bullet ? "padding-inline-start:10px;" : ""}">${l.bullet ? "• " : ""}${e(l.text)}</div>`).join("");
    const gapRows = cd.drawers.filter((d) => d.gap !== null && Math.abs(d.gap) >= 0.01).map((d) => `<div style="margin-bottom:8px;">${lines(cdGapLines(d))}</div>`).join("");
    const handoverRows = cd.drawers.map((d) => cdHandoverLines(d)).filter((l) => l.length > 0).map((l) => `<div style="margin-bottom:8px;">${lines(l)}</div>`).join("");
    return `
      <div style="text-align:center;font-weight:700;font-size:16px;">${e(restaurantName)}</div>
      <div style="text-align:center;font-size:13px;">${e(t("cdReportTitle"))} — ${e(dayLabel)}</div>
      ${closing ? `<div style="text-align:center;font-size:11px;margin:4px 0;">${e(t("cdClosedBy", { name: closing.closedBy?.name || "—", time: new Date(closing.closedAt).toLocaleString(loc, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }))}</div>` : ""}
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${e(t("closeDaySalesTitle"))}</div>
        ${row(t("cdRevenue"), money(cd.revenue))}
        ${row(t("cdOrders"), cd.orders)}
        ${cd.byMethod.map((m) => row(t(`payment_${m.id}`), money(m.total))).join("")}
        ${cd.discounts.n > 0 ? row(t("cdDiscounts", { n: cd.discounts.n, amount: money(cd.discounts.total) }), "") : ""}
        ${cd.voided.n > 0 ? row(t("cdVoided", { n: cd.voided.n, amount: money(cd.voided.total) }), "") : ""}
        ${row(t("cdExpenses"), money(cd.expenseTotal))}
        ${row(t("cdNet"), money(cd.revenue - cd.expenseTotal), "font-weight:700;")}
      </div>
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${e(t("closeDayDrawerTitle"))}</div>
        ${cd.drawers.filter((d) => !d.loading).map((d) => `
          <div style="margin-bottom:8px;">
            <div style="font-weight:600;">${e(d.name)} &middot; ${e(new Date(d.clockIn).toLocaleString(loc, tf))} – ${e(d.clockOut ? new Date(d.clockOut).toLocaleString(loc, tf) : t("cdStillOpen"))}</div>
            ${row(t("cdOpened"), d.opening !== null ? money(d.opening) : "—")}
            ${row(t("cdReceived"), money(d.cashIn))}
            ${row(t("cdPaidOut"), money(d.paidOut))}
            ${row(t("cdShouldBe"), d.expected !== null ? money(d.expected) : "—")}
            ${row(t("cdCounted"), d.counted !== null ? money(d.counted) : t("cdNotCounted"))}
            ${row(t("cdGap"), d.gap === null ? "—" : Math.abs(d.gap) < 0.01 ? t("varianceMatch") : cdSigned(d.gap), "font-weight:700;")}
          </div>`).join("")}
        ${cd.drawers.length > 0 ? `
          <div style="border-top:1px solid #000;padding-top:6px;">
            <div style="font-weight:700;">${e(t("cdWholeDay"))}</div>
            ${row(t("cdOpened"), cd.dayTotals.opening !== null ? money(cd.dayTotals.opening) : "—")}
            ${row(t("cdReceived"), money(cd.dayTotals.cashIn))}
            ${row(t("cdPaidOut"), money(cd.dayTotals.paidOut))}
            ${row(t("cdShouldBe"), cd.dayTotals.expectedEnd !== null ? money(cd.dayTotals.expectedEnd) : "—")}
            ${cd.dayTotals.collected > 0 ? row(t("cdCollectedRow"), "-" + money(cd.dayTotals.collected)) : ""}
            ${row(t("cdCounted"), cd.dayTotals.finalCounted !== null ? money(cd.dayTotals.finalCounted) : "—")}
            ${row(t("cdGap"), cd.dayTotals.gap === null ? "—" : Math.abs(cd.dayTotals.gap) < 0.01 ? t("varianceMatch") : cdSigned(cd.dayTotals.gap), "font-weight:700;")}
          </div>` : ""}
      </div>
      ${gapRows || handoverRows ? `<div class="dashed" style="font-size:12px;"><div style="font-weight:600;margin-bottom:6px;">${e(t("cdGapsTitle"))}</div>${gapRows}${handoverRows}</div>` : ""}
      ${closing && closing.note ? `<div class="dashed" style="font-size:12px;">${e(t("cdClosedNote", { note: closing.note }))}</div>` : ""}`;
  };

  // Personal stats for whoever is currently clocked in — same receipts, filtered to just theirs.
  const myShiftCompleted = currentEmployee ? shiftCompleted.filter((r) => r.servedBy?.id === currentEmployee.id) : [];
  const myShiftRevenue = myShiftCompleted.reduce((s, r) => s + r.total, 0);
  const myShiftAvgOrder = myShiftCompleted.length > 0 ? myShiftRevenue / myShiftCompleted.length : 0;
  const myTopSeller = () => {
    const counts = {};
    myShiftCompleted.forEach((r) => r.items.forEach((it) => { counts[it.name] = (counts[it.name] || 0) + it.qty; }));
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { name: entries[0][0], qty: entries[0][1] };
  };
  const formatDuration = (ms) => {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
  };
  const hoursWorkedSoFar = shiftStart ? formatDuration(nowTick - new Date(shiftStart).getTime()) : null;

  const buildShiftReportBodyHtml = () => {
    const methodRows = shiftByMethod
      .map(
        (m) => `<div class="row" style="margin-bottom:4px;"><span>${escapeHtml(t(`payment_${m.id}`))} (${m.count})</span><span>${money(m.total)}</span></div>`
      )
      .join("");
    const cashExpenseRows = shiftCashExpenses
      .map(
        (e) => `<div class="row" style="margin-bottom:3px;"><span>${escapeHtml(e.supplierName || t(`category_${e.category}`))}</span><span>-${money(e.amount)}</span></div>`
      )
      .join("");
    const unpaidRows = shiftUnpaid
      .map(
        (r) => `<div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("ticketHash", { n: r.ticketNo }))}${r.table ? ` &middot; ${escapeHtml(r.table)}` : ""}</span><span>${money(r.total)}</span></div>`
      )
      .join("");
    return `
      <div class="center">
        ${brandHeaderHtml()}
        <div style="font-size:12px;font-weight:600;margin-top:4px;">${escapeHtml(t("shiftReportTitle"))}</div>
        <div style="font-size:11px;">
          ${shiftStart ? new Date(shiftStart).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
          &ndash;
          ${new Date().toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
      <div class="dashed" style="font-size:12px;">
        <div class="row" style="margin-bottom:4px;"><span>${escapeHtml(t("ordersCompleted"))}</span><span>${shiftCompleted.length}</span></div>
        <div class="row" style="margin-bottom:4px;"><span>${escapeHtml(t("ordersCancelled"))}</span><span>${shiftCancelled.length}</span></div>
        <div class="row" style="margin-bottom:4px;"><span>${escapeHtml(t("ordersRefunded"))}</span><span>${shiftRefunded.length}</span></div>
      </div>
      <div class="dashed" style="font-size:12px;">${methodRows}</div>
      ${shiftUnpaid.length > 0 ? `
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(t("unpaidThisShiftLabel"))}</div>
        ${unpaidRows}
        <div class="row" style="font-weight:700;margin-top:4px;"><span>${escapeHtml(tCount("orderCount", shiftUnpaid.length))}</span><span>${money(shiftUnpaidTotal)}</span></div>
      </div>` : ""}
      <div class="dashed">
        <div class="row" style="font-size:12px;"><span>${escapeHtml(t("grossSales"))}</span><span>${money(shiftGross)}</span></div>
        <div class="row" style="font-size:12px;"><span>${escapeHtml(t("refunds"))}</span><span>-${money(shiftRefundsTotal)}</span></div>
        ${shiftDiscountTotal > 0 ? `<div class="row" style="font-size:12px;"><span>${escapeHtml(t("discountedCountNote", { n: shiftDiscountedOrders.length }))}</span><span>-${money(shiftDiscountTotal)}</span></div>` : ""}
        <div class="row" style="font-size:15px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("net"))}</span><span>${money(shiftGross - shiftRefundsTotal)}</span></div>
        ${shiftExpenseTotal > 0 ? `
        <div class="row" style="font-size:12px;margin-top:6px;"><span>${escapeHtml(tCount("expensesThisShiftCount", shiftExpenses.length))}</span><span>-${money(shiftExpenseTotal)}</span></div>
        <div class="row" style="font-size:15px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("netAfterExpensesLabel"))}</span><span>${money(shiftGross - shiftRefundsTotal - shiftExpenseTotal)}</span></div>` : ""}
      </div>
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(t("cashReconciliationTitle"))}</div>
        <div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("openingFloatLabel"))}</span><span>${money(openingFloatNum)}</span></div>
        <div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("cashSalesLabel"))}</span><span>${money(shiftCashSalesTotal)}</span></div>
        ${shiftUnsettledDeliveryCash > 0 ? `<div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("unsettledDeliveryCashLabel"))}</span><span>${money(shiftUnsettledDeliveryCash)}</span></div>` : ""}
        ${shiftCashRefundsTotal > 0 ? `<div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("cashRefundsLabel"))}</span><span>-${money(shiftCashRefundsTotal)}</span></div>` : ""}
        ${shiftRiderPayTotal > 0 ? `<div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("riderPayLabel"))}</span><span>-${money(shiftRiderPayTotal)}</span></div>` : ""}
        ${cashExpenseRows}
        <div class="row" style="font-weight:700;margin-top:4px;"><span>${escapeHtml(t("expectedCashLabel"))}</span><span>${money(expectedCash)}</span></div>
        ${countedCashNum !== null ? `<div class="row" style="margin-top:3px;"><span>${escapeHtml(t("countedCashLabel"))}</span><span>${money(countedCashNum)}</span></div>` : ""}
        ${cashVariance !== null ? `<div class="row" style="font-weight:700;"><span>${escapeHtml(t("varianceLabel"))}</span><span>${cashVariance >= 0 ? "+" : ""}${money(cashVariance)}</span></div>` : ""}
      </div>
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(t("electronicReconciliationTitle"))}</div>
        ${shiftElectronicMethods
          .map((m) => {
            const confirmedVal = confirmedElectronic[m.id];
            return `
            <div style="margin-bottom:6px;">
              <div class="row" style="font-weight:600;"><span>${escapeHtml(t(`payment_${m.id}`))}</span><span>${money(m.expected)}</span></div>
              ${confirmedVal ? `<div class="row"><span>${escapeHtml(t("confirmedOnStatementLabel"))}</span><span>${money(Number(confirmedVal))}</span></div>` : ""}
              ${m.variance !== null ? `<div class="row"><span>${escapeHtml(t("varianceLabel"))}</span><span>${m.variance >= 0 ? "+" : ""}${money(m.variance)}</span></div>` : ""}
            </div>`;
          })
          .join("")}
      </div>
      ${deliveryReconciliation.some((p) => p.orders > 0) ? `
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(t("deliveryReconciliationTitle"))}</div>
        ${deliveryReconciliation
          .filter((p) => p.orders > 0)
          .map(
            (p) => `
            <div style="margin-bottom:8px;">
              <div class="row" style="font-weight:600;"><span>${escapeHtml(p.name)}</span><span>${money(Math.abs(p.net))} ${p.net < 0 ? escapeHtml(t("deliveryReconciliationOwedToAgent")) : escapeHtml(t("deliveryReconciliationOwed"))}</span></div>
              ${p.orderList
                .map(
                  (r) =>
                    `<div class="row" style="font-size:10.5px;color:#555;"><span>#${r.ticketNo}</span><span>${escapeHtml(r.customer?.address || t("noAddressOnFile"))}</span></div>`
                )
                .join("")}
            </div>`
          )
          .join("")}
      </div>` : ""}`;
  };
  const printShiftReport = () => {
    printViaHiddenFrame(t("shiftReportTitle"), buildShiftReportBodyHtml(), isRtl);
  };
  const downloadShiftReport = () => {
    downloadReceiptFile(t("shiftReportTitle"), buildShiftReportBodyHtml(), isRtl);
    flashNotice(t("notice_shiftReportDownloaded"));
  };

  // Builds the public URL a customer's phone should land on after scanning a table's QR code.
  // Only resolves to something reachable once this app is deployed at a real address — within
  // this chat's preview it'll point at the preview URL, which isn't publicly reachable.
  const tableMenuUrl = (id) => {
    try {
      const base = `${window.location.origin}${window.location.pathname}`;
      return `${base}?table=${encodeURIComponent(id)}`;
    } catch (e) {
      return `?table=${encodeURIComponent(id)}`;
    }
  };
  // The general online-ordering link — not tied to any table, meant for social media. A
  // different URL parameter from ?table= so the two experiences route separately: this one lets
  // the customer choose Pickup or Delivery instead of assuming dine-in.
  const storeOrderUrl = () => {
    try {
      const base = `${window.location.origin}${window.location.pathname}`;
      return `${base}?order=1`;
    } catch (e) {
      return `?order=1`;
    }
  };
  const copyStoreLink = async () => {
    const ok = await copyTextToClipboard(storeOrderUrl());
    if (ok) {
      setStoreLinkCopied(true);
      setTimeout(() => setStoreLinkCopied(false), 2000);
    } else {
      flashNotice(t("notice_copyFailed"));
    }
  };
  // Turns an item off (or back on) everywhere: order screen, QR menus, online link, call center.
  // Reads the current shared flags right before writing and refuses to write if that read fails,
  // so a bad connection can never replace the whole list with this device's partial copy.
  const setItemManualOut = async (item, out) => {
    let fresh;
    try {
      const result = await storage.get("item-out-of-stock", true);
      fresh = result?.value ? JSON.parse(result.value) : {};
    } catch (e) {
      flashNotice(t("notice_outOfStockSaveFailed"));
      return;
    }
    const next = { ...fresh };
    if (out) next[item.id] = true;
    else delete next[item.id];
    manualOutWritesRef.current += 1;
    setManualOutOfStock(next);
    try {
      await syncSet("item-out-of-stock", JSON.stringify(next), true, t("syncLabelMenu"));
    } finally {
      manualOutWritesRef.current -= 1;
    }
    flashNotice(out ? t("notice_itemMarkedOut", { name: item.name }) : t("notice_itemMarkedAvailable", { name: item.name }));
  };
  const callCenterUrl = () => {
    try {
      const base = `${window.location.origin}${window.location.pathname}`;
      return `${base}?callcenter=1`;
    } catch (e) {
      return `?callcenter=1`;
    }
  };
  const copyCallCenterLink = async () => {
    const ok = await copyTextToClipboard(callCenterUrl());
    if (ok) {
      setCallCenterLinkCopied(true);
      setTimeout(() => setCallCenterLinkCopied(false), 2000);
    } else {
      flashNotice(t("notice_copyFailed"));
    }
  };
  const buildQrFlyerBodyHtml = (id) => {
    const url = tableMenuUrl(id);
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
    return `
      <div class="center">
        ${brandHeaderHtml()}
        <div style="font-size:13px;margin-top:10px;">${escapeHtml(t("scanQrFlyerTitle"))}</div>
        <div style="font-size:14px;font-weight:700;margin-top:2px;">${escapeHtml(tableLabel(id))}</div>
        <img src="${qrImg}" alt="QR" style="width:220px;height:220px;margin:14px auto;display:block;" />
        <div style="font-size:9px;word-break:break-all;color:#555;">${escapeHtml(url)}</div>
      </div>`;
  };
  const printQrFlyer = (id) => {
    printViaHiddenFrame(tableLabel(id), buildQrFlyerBodyHtml(id), isRtl);
  };
  const downloadQrFlyer = (id) => {
    downloadReceiptFile(tableLabel(id), buildQrFlyerBodyHtml(id), isRtl);
  };

  // --- Staff login / clock in-out ---
  const persistEmployees = async (next) => {
    setEmployees(next);
    syncSet("staff-roster", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const fetchFreshEmployees = async () => {
    try {
      const result = await storage.get("staff-roster", true);
      return result?.value ? JSON.parse(result.value) : employees;
    } catch (e) {
      return employees;
    }
  };
  const persistShiftLog = async (next) => {
    setShiftLog(next);
    syncSet("shift-log", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const appendShiftLogEntry = async (entry) => {
    let fresh;
    try {
      const result = await storage.get("shift-log", true);
      fresh = result?.value ? JSON.parse(result.value) : [];
    } catch (e) {
      fresh = shiftLog;
    }
    // A shift is identified by who clocked in and when. If that exact shift is already in the log
    // (a second tap on Clock out, or the same session still open on another screen), don't add it twice.
    const already = fresh.find((e) => e.employeeId === entry.employeeId && e.clockIn === entry.clockIn);
    if (already) return { duplicate: already };
    return persistShiftLog([entry, ...fresh]);
  };
  // Puts a shift that was left open (never clocked out — a session replaced on another device, a
  // closed browser, a crash) into the shift log instead of letting it vanish when the open-shifts
  // registry entry is replaced or expires. Closed at the moment the same person clocks in again, or
  // 24 hours after it started, whichever is first; marked autoClosed so it's visible as such. A
  // shift that's already in the log is never added twice (see appendShiftLogEntry).
  const closeStaleShift = async (old, closeAtIso) => {
    const maxEnd = new Date(new Date(old.clockIn).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const clockOut = closeAtIso < maxEnd ? closeAtIso : maxEnd;
    if (clockOut <= old.clockIn) return;
    const keys = monthKeysInRange(new Date(old.clockIn).toISOString().slice(0, 7), new Date(clockOut).toISOString().slice(0, 7));
    const months = await Promise.all(keys.map((mk) => fetchFreshMonth(mk)));
    const mine = months.flat().filter((r) => r.status === "completed" && r.servedBy?.id === old.employeeId && r.timestamp >= old.clockIn && r.timestamp <= clockOut);
    await appendShiftLogEntry({
      id: `shift_${Date.now()}_auto`,
      employeeId: old.employeeId,
      employeeName: old.employeeName,
      clockIn: old.clockIn,
      clockOut,
      orders: mine.length,
      revenue: mine.reduce((sum, r) => sum + r.total, 0),
      autoClosed: true,
    });
  };
  // The last counted shift of the CURRENT business day, if any. A day's first shift has none: cash is often
  // collected when a day ends, so it is never compared with the day before's last count.
  const lastCountedToday = () => {
    const today = businessDateForTimestamp(new Date().toISOString(), shiftHoursConfig);
    const dayOf = (e) => businessDateForTimestamp(new Date((new Date(e.clockIn).getTime() + new Date(e.clockOut).getTime()) / 2).toISOString(), shiftHoursConfig);
    return [...shiftLog].filter((e) => typeof e.countedCash === "number" && e.clockOut && dayOf(e) === today).sort((a, b) => b.clockOut.localeCompare(a.clockOut))[0] || null;
  };
  const doClockIn = async (emp, openingCash = 0) => {
    const now = new Date().toISOString();
    const lastCounted = lastCountedToday();
    setCurrentEmployee({ id: emp.id, name: emp.name });
    setViewingOnly(false);
    setShiftStart(now);
    setOpeningFloat(String(openingCash));
    setCountedCash("");
    setConfirmedElectronic({});
    setLoginSelectedId(null);
    setLoginPin("");
    setLoginError(false);
    setLoginAddMode(false);
    setLoginNewName("");
    setLoginNewPin("");
    setPendingManagerLogin(null);
    // Login itself always works offline (it's just checking the PIN against the roster already
    // in memory) — only the "remember this session" writes can fail, and those are non-critical
    // enough to just queue quietly rather than block the person from getting to work.
    syncSet("current-employee", JSON.stringify({ id: emp.id, name: emp.name }), false, t("syncLabelSettings"));
    syncSet("shift-start", now, false, t("syncLabelSettings"));
    syncSet("opening-float", String(openingCash), false, t("syncLabelSettings"));
    storage.delete("viewing-only", false).catch(() => {});
    // Register this shift in the shared open-shifts registry so any device viewing the system
    // (see viewingOnly) sees it live — also prunes any entry left behind by a device that closed
    // without properly clocking out, so a crashed session can't get stuck "open" forever.
    (async () => {
      try {
        const latest = await storage.get("open-shifts", true);
        const current = latest?.value ? JSON.parse(latest.value) : {};
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        // Anything about to be dropped or replaced here was an open shift nobody clocked out of —
        // log it first so it isn't lost.
        for (const [id, stale] of Object.entries(current)) {
          const expired = new Date(stale.clockIn).getTime() <= cutoff;
          const replaced = id === emp.id && stale.clockIn !== now;
          if (expired || replaced) {
            try {
              await closeStaleShift(stale, now);
            } catch (e) {
              // best effort — a failure here must never block signing in
            }
          }
        }
        const pruned = Object.fromEntries(Object.entries(current).filter(([, s]) => new Date(s.clockIn).getTime() > cutoff));
        const next = {
          ...pruned,
          [emp.id]: {
            employeeId: emp.id,
            employeeName: emp.name,
            clockIn: now,
            openingCash,
            previousCount: lastCounted ? lastCounted.countedCash : null,
            previousCountedBy: lastCounted ? lastCounted.employeeName : null,
          },
        };
        setOpenShifts(next);
        await syncSet("open-shifts", JSON.stringify(next), true, t("syncLabelSettings"));
      } catch (e) {
        // non-fatal — worst case this shift just doesn't show up remotely until it's retried
      }
    })();
  };
  // ---- Support session (opened from the hidden sign-in; the 4-digit code is checked on the server) ----
  // Seven quick taps on the restaurant name of the login screen. Nothing on screen reacts to the taps.
  const handleBrandTap = () => {
    const now = Date.now();
    supportTapsRef.current = [...supportTapsRef.current.filter((x) => now - x < 4000), now];
    if (supportTapsRef.current.length >= 7) {
      supportTapsRef.current = [];
      setSupportOpen(true);
    }
  };
  const enterSupportSession = (expiresAtIso) => {
    setCurrentEmployee({ id: "support", name: "Support" });
    setViewingOnly(true);
    setShiftStart(null);
    setSupportExpiresAt(Date.parse(expiresAtIso));
    setSupportOpen(false);
    storage.set("support-session", expiresAtIso).catch(() => {});
  };
  const endSupportSession = () => {
    fetch(`/api/pos/${encodeURIComponent(tenantId)}/support`, { method: "DELETE" }).catch(() => {});
    storage.delete("support-session").catch(() => {});
    setSupportExpiresAt(null);
    setCurrentEmployee(null);
    setViewingOnly(false);
    setShiftStart(null);
  };
  // A reload keeps the session going — but only asks the server if this device remembers having one.
  useEffect(() => {
    if (!currentEmployeeLoaded || currentEmployee) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const remembered = await storage.get("support-session");
        if (!remembered?.value || Date.parse(remembered.value) < Date.now()) {
          if (remembered?.value) storage.delete("support-session").catch(() => {});
          return;
        }
        const res = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/support`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.active) enterSupportSession(data.expiresAt);
        else storage.delete("support-session").catch(() => {});
      } catch (e) {
        // no session to restore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentEmployeeLoaded]);
  useEffect(() => {
    if (!supportExpiresAt) return undefined;
    const id = setInterval(() => {
      if (Date.now() >= supportExpiresAt) endSupportSession();
    }, 15000);
    return () => clearInterval(id);
  }, [supportExpiresAt]);

  // A manager checking the system without actually working a shift — from their phone, say. Signs
  // them in (so role-gated tabs and "who's using this device" still work normally) but skips
  // shift-start entirely, so none of the shift/cash-reconciliation machinery ever engages and
  // nothing about this session shows up in shift stats or the shift log.
  const viewWithoutClockIn = (emp) => {
    setCurrentEmployee({ id: emp.id, name: emp.name });
    setViewingOnly(true);
    setShiftStart(null);
    setLoginSelectedId(null);
    setLoginPin("");
    setLoginError(false);
    setLoginAddMode(false);
    setLoginNewName("");
    setLoginNewPin("");
    setPendingManagerLogin(null);
    syncSet("current-employee", JSON.stringify({ id: emp.id, name: emp.name }), false, t("syncLabelSettings"));
    syncSet("viewing-only", "true", false, t("syncLabelSettings"));
  };
  // Leaves a viewing-only session — no shift to end, so unlike clockOut this needs no confirmation
  // and writes nothing to the shift log.
  const exitViewingMode = () => {
    if (supportExpiresAt) {
      endSupportSession();
      return;
    }
    setCurrentEmployee(null);
    setViewingOnly(false);
    setShiftStart(null);
    storage.delete("current-employee", false).catch(() => {});
    storage.delete("viewing-only", false).catch(() => {});
  };
  const updateOpeningFloat = (value) => {
    setOpeningFloat(value);
    syncSet("opening-float", value, false, t("syncLabelSettings"));
  };
  // Every shift starts with a counted drawer: nobody gets to clock in until they have typed in what
  // is physically there. (A manager choosing "just view" never reaches this — no shift, no drawer.)
  const startOpeningCount = (emp) => {
    setPendingManagerLogin(null);
    setLoginSelectedId(null);
    setLoginPin("");
    setPendingOpeningCount(emp);
    setOpeningCountDraft("");
  };
  const confirmOpeningCount = () => {
    const n = parseFloat(openingCountDraft);
    if (!pendingOpeningCount || openingCountDraft.trim() === "" || !Number.isFinite(n) || n < 0) return;
    const emp = pendingOpeningCount;
    setPendingOpeningCount(null);
    setOpeningCountDraft("");
    doClockIn(emp, Math.round(n * 100) / 100);
  };
  const attemptLogin = () => {
    const emp = employees.find((e) => e.id === loginSelectedId);
    if (!emp) return;
    if (loginPin !== emp.pin) {
      setLoginError(true);
      setLoginPin("");
      return;
    }
    // Only managers get the "just viewing" choice — regular staff are here to work, and orders/
    // shift reconciliation need someone actually on shift to attribute to.
    if ((emp.role || "manager") !== "staff") {
      setPendingManagerLogin(emp);
      setLoginSelectedId(null);
      setLoginPin("");
    } else {
      startOpeningCount(emp);
    }
  };
  const addEmployeeFromLogin = async () => {
    const name = loginNewName.trim();
    if (!name) {
      flashNotice(t("notice_nameRequired"));
      return;
    }
    if (!/^\d{4}$/.test(loginNewPin)) {
      flashNotice(t("notice_pinMustBe4Digits"));
      return;
    }
    if (employees.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      flashNotice(t("notice_employeeExists"));
      return;
    }
    // The very first person ever to set up this POS (empty roster) is presumed to be the
    // owner/manager doing initial setup, so they start with manager access. Anyone who
    // self-registers after that starts as regular staff — a manager can promote them from the
    // Staff tab if that's wrong.
    const isFirstEver = employees.length === 0;
    const emp = { id: `emp_${Date.now()}`, name, pin: loginNewPin, role: isFirstEver ? "manager" : "staff" };
    await persistEmployees([...employees, emp]);
    startOpeningCount(emp);
  };
  const clockOut = () => {
    // While the recap is on screen the shift has already been logged — pressing Clock out again
    // used to log the same shift a second time.
    if (!currentEmployee || shiftRecap) return;
    setClosingCountDraft("");
    setClosingCountOpen(true);
  };
  // Runs once the closing count has been typed in — the only way a shift gets closed. Saves the
  // opening cash, what the app expected, what was counted and the difference with the shift.
  const performClockOut = (counted) => {
    if (!currentEmployee || shiftRecap) return;
    setClosingCountOpen(false);
    const clockOutTime = new Date().toISOString();
    const hoursMs = shiftStart ? new Date(clockOutTime) - new Date(shiftStart) : 0;
    const top = myTopSeller();
    const expected = Math.round(expectedCash * 100) / 100;
    const variance = Math.round((counted - expected) * 100) / 100;
    const openEntry = openShifts[currentEmployee.id];
    const openingCounted = !!(openEntry && openEntry.clockIn === shiftStart && openEntry.openingCash !== undefined);
    const previousCount = openingCounted && typeof openEntry.previousCount === "number" ? openEntry.previousCount : null;
    setCountedCash(String(counted));
    setShiftRecap({
      name: currentEmployee.name,
      orders: myShiftCompleted.length,
      revenue: myShiftRevenue,
      avg: myShiftAvgOrder,
      hoursMs,
      topSeller: top,
      cash: { opening: openingFloatNum, counted, expected, variance, previousCount },
    });
    Promise.resolve(
      appendShiftLogEntry({
        id: `shift_${Date.now()}`,
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        clockIn: shiftStart,
        clockOut: clockOutTime,
        orders: myShiftCompleted.length,
        revenue: myShiftRevenue,
        openingCash: openingFloatNum,
        openingCounted,
        previousCount,
        countedCash: counted,
        expectedCash: expected,
        cashVariance: variance,
      })
    ).then((res) => {
      // The same shift was already closed on another screen: the first count is the one on record, so
      // say so instead of showing a recap that looks saved.
      if (res && res.duplicate) setShiftRecap((prev) => (prev ? { ...prev, alreadyClosed: res.duplicate } : prev));
    });
    // This shift is ending — it's captured in shiftLog above now, so drop it from the "open
    // right now" registry.
    (async () => {
      try {
        const latest = await storage.get("open-shifts", true);
        const current = latest?.value ? JSON.parse(latest.value) : {};
        const { [currentEmployee.id]: _removed, ...rest } = current;
        setOpenShifts(rest);
        await syncSet("open-shifts", JSON.stringify(rest), true, t("syncLabelSettings"));
      } catch (e) {
        // non-fatal — a stale entry here just self-prunes on the next clock-in's cutoff sweep
      }
    })();
  };
  const finishClockOut = async () => {
    setShiftRecap(null);
    setCurrentEmployee(null);
    setShiftStart(null);
    setOpeningFloat("0");
    setCountedCash("");
    setConfirmedElectronic({});
    setUnlockedTabs(new Set());
    try {
      await storage.delete("current-employee", false);
      await storage.delete("shift-start", false);
      await storage.delete("opening-float", false);
    } catch (e) {
      // non-fatal — worst case the next load briefly shows a stale session before this clears
    }
  };
  // Opens the detail view for a shift (manager-only, see the Staff tab render) — either a finished
  // shift-log entry or one of the currently-open shifts (which has no clockOut yet). The shift-log
  // entry itself only stores a handful of aggregate numbers, so the actual per-order breakdown is
  // reconstructed on demand from that shift's own real receipts. Always force-refreshes the month
  // (rather than trusting whatever's cached) so the numbers are current the moment it's opened.
  const openShiftDetail = async (s) => {
    setViewingShiftDetail(s);
    const endIso = s.clockOut || new Date().toISOString();
    await Promise.all(monthKeysInRange(new Date(s.clockIn).toISOString().slice(0, 7), new Date(endIso).toISOString().slice(0, 7)).map((mk) => refreshMonthLoaded(mk)));
  };
  // While the detail modal is open on a shift that's still in progress, keep polling that month's
  // receipts so a manager watching it sees new orders land without having to close and reopen it.
  useEffect(() => {
    if (!viewingShiftDetail || viewingShiftDetail.clockOut) return;
    const monthKey = new Date(viewingShiftDetail.clockIn).toISOString().slice(0, 7);
    const interval = setInterval(() => refreshMonthLoaded(monthKey), 15000);
    return () => clearInterval(interval);
  }, [viewingShiftDetail]);
  useEffect(() => {
    if (view !== "staff") return;
    const keys = new Set();
    recentShiftLog.forEach((sh) => {
      monthKeysInRange(new Date(sh.clockIn).toISOString().slice(0, 7), new Date(sh.clockOut).toISOString().slice(0, 7)).forEach((mk) => keys.add(mk));
    });
    keys.forEach((mk) => ensureMonthLoaded(mk));
  }, [view, shiftLog]);
  useEffect(() => {
    if (view !== "staff") return;
    // The leaderboard adds up the last 30 days of orders.
    const since = businessDateForTimestamp(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), shiftHoursConfig);
    const today = businessDateForTimestamp(new Date().toISOString(), shiftHoursConfig);
    storageMonthKeysFor(monthKeysInRange(since.slice(0, 7), today.slice(0, 7))).forEach((k) => ensureMonthLoaded(k));
  }, [view]);
  useEffect(() => {
    if (view !== "staff" || !isManager) return;
    const mk = (dayCheckDate || businessDateForTimestamp(new Date().toISOString(), shiftHoursConfig)).slice(0, 7);
    [prevMonthKey(mk), mk, nextMonthKey(mk)].forEach((k) => ensureMonthLoaded(k));
  }, [view, dayCheckDate, isManager]);
  useEffect(() => {
    if (view !== "closeday") return;
    const day = closeDayDate || businessDateForTimestamp(new Date().toISOString(), shiftHoursConfig);
    const mk = day.slice(0, 7);
    // Always read fresh from the server (and keep doing so while the tab is open): this screen adds up
    // other terminals' orders, so a copy cached hours ago on this device would give wrong totals.
    const refreshExpenses = async (k) => {
      try {
        const result = await getSharedWithRetry(storage, `expenses:${k}`);
        setExpensesByMonth((prev) => ({ ...prev, [k]: result?.value ? JSON.parse(result.value) : [] }));
      } catch (e) {
        // keep what we have
      }
    };
    const refreshAll = () => [prevMonthKey(mk), mk, nextMonthKey(mk)].forEach((k) => {
      refreshMonthLoaded(k);
      refreshExpenses(k);
    });
    // Fresh once when the screen opens; the shared live-sync timer keeps it current after that.
    refreshAll();
  }, [view, closeDayDate, shiftHoursLoaded]);
  useEffect(() => {
    if (view !== "closeday") return;
    let cancelled = false;
    const loadClosings = async () => {
      try {
        const result = await storage.get("day-closings", true);
        if (!cancelled) setDayClosings(result?.value ? JSON.parse(result.value) : {});
        const cols = await storage.get("day-collections", true);
        if (!cancelled) setDayCollections(cols?.value ? JSON.parse(cols.value) : {});
      } catch (e) {
        // keep what we had
      }
    };
    loadClosings();
    const interval = setInterval(loadClosings, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [view]);
  const addStaffMember = async () => {
    const name = newStaffName.trim();
    if (!name) {
      flashNotice(t("notice_nameRequired"));
      return;
    }
    if (!/^\d{4}$/.test(newStaffPin)) {
      flashNotice(t("notice_pinMustBe4Digits"));
      return;
    }
    if (employees.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      flashNotice(t("notice_employeeExists"));
      return;
    }
    const fresh = await fetchFreshEmployees();
    if (fresh.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      flashNotice(t("notice_employeeExists"));
      return;
    }
    persistEmployees([...fresh, { id: `emp_${Date.now()}`, name, pin: newStaffPin, role: "staff" }]);
    setNewStaffName("");
    setNewStaffPin("");
  };
  const copyWhatsAppMessage = async () => {
    if (!whatsappFallback) return;
    const ok = await copyTextToClipboard(whatsappFallback.message);
    if (ok) {
      setWhatsappCopied(true);
      setTimeout(() => setWhatsappCopied(false), 2000);
    } else {
      flashNotice(t("notice_copyFailed"));
    }
  };
  const removeStaffMember = (id) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;
    setConfirmDialog({
      message: t("confirm_removeEmployee", { name: emp.name }),
      onConfirm: async () => persistEmployees((await fetchFreshEmployees()).filter((e) => e.id !== id)),
    });
  };
  const toggleEmployeeRole = async (emp) => {
    if (!isManager) return; // only managers can grant/revoke manager access
    const empIsManager = (emp.role || "manager") !== "staff";
    if (empIsManager) {
      // Guard against demoting the last manager standing — that would leave nobody able to
      // promote anyone back, locking the whole team out of Expenses.
      const otherManagers = employees.filter((e) => e.id !== emp.id && (e.role || "manager") !== "staff");
      if (otherManagers.length === 0) {
        flashNotice(t("confirm_lastManager", { name: emp.name }));
        return;
      }
      persistEmployees((await fetchFreshEmployees()).map((e) => (e.id === emp.id ? { ...e, role: "staff" } : e)));
    } else {
      persistEmployees((await fetchFreshEmployees()).map((e) => (e.id === emp.id ? { ...e, role: "manager" } : e)));
    }
  };
  const saveEditedPin = async (id) => {
    if (id !== currentEmployee?.id) return; // staff can only ever change their own PIN, not a colleague's
    if (!/^\d{4}$/.test(editingPinValue)) {
      flashNotice(t("notice_pinMustBe4Digits"));
      return;
    }
    persistEmployees((await fetchFreshEmployees()).map((e) => (e.id === id ? { ...e, pin: editingPinValue } : e)));
    setEditingPinId(null);
    setEditingPinValue("");
  };
  const leaderboard = useMemo(() => {
    const nowMs = Date.now();
    const live = ledger.employeeTotals(new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString(), nowMs);
    if (live) return live.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    // The months are still loading: show what was saved at clock-out until they arrive.
    const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
    const totals = {};
    shiftLog.forEach((s) => {
      if (new Date(s.clockOut).getTime() < cutoff) return;
      if (!totals[s.employeeId]) totals[s.employeeId] = { name: s.employeeName, revenue: 0, orders: 0 };
      totals[s.employeeId].revenue += s.revenue;
      totals[s.employeeId].orders += s.orders;
    });
    return Object.values(totals).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [ledger, shiftLog]);
  const recentShiftLog = useMemo(
    () => [...shiftLog].sort((a, b) => new Date(b.clockOut) - new Date(a.clockOut)).slice(0, 20),
    [shiftLog]
  );
  // Per-waiter/delivery-person totals for reconciliation — scoped to shiftCompleted, the same
  // "since I clocked in" window already used for Register totals in the Shift tab, so this reads
  // as one consistent notion of "this shift" rather than introducing a separate date range.
  const teamPerformance = useMemo(() => {
    const totals = {};
    dutyRoster.forEach((p) => { totals[p.id] = { ...p, orders: 0, revenue: 0, tickets: [] }; });
    shiftCompleted.forEach((r) => {
      const a = r.assignedTo;
      if (!a || !totals[a.id]) return;
      totals[a.id].orders += 1;
      totals[a.id].revenue += r.total;
      totals[a.id].tickets.push({ ticketNo: r.ticketNo, total: r.total, timestamp: r.timestamp });
    });
    return Object.values(totals);
  }, [dutyRoster, shiftCompleted]);

  // Delivery cash reconciliation — restaurant-wide (not scoped to whoever's currently clocked
  // in, unlike teamPerformance above), and covers every not-yet-settled delivery order this
  // month rather than just today, so a day a manager skips settling on doesn't quietly drop off
  // — it keeps rolling forward until settleDeliveryCash below marks it settled. Every delivered
  // order counts, not just cash ones: a cash order has the rider collecting the full total (food
  // + fee) and keeping their fee share as pay, so they owe the restaurant cash minus that share;
  // a card/InstaPay order has the rider collecting nothing but still doing the delivery, so the
  // restaurant already holds their fee share electronically and owes it back to them. Netting
  // cash collected against fee share earned across ALL their orders — not just cash ones — makes
  // both directions fall out of one number: positive means they owe the restaurant, negative
  // means the restaurant owes them.
  // What the rider keeps out of a given delivery fee, after the restaurant's cut — either a
  // percentage of the fee, or a flat amount (clamped so it never exceeds the fee itself, which
  // would otherwise leave the rider owing money just for having delivered something cheap).
  const agentFeeShare = (fee) => {
    const restaurantCut = deliveryFeeRetentionMode === "fixed"
      ? Math.min(Math.max(deliveryFeeRetentionFixed, 0), fee)
      : Math.round(fee * (deliveryFeeRetentionPercent / 100) * 100) / 100;
    return Math.round((fee - restaurantCut) * 100) / 100;
  };
  const deliveryReconciliation = useMemo(() => {
    // Every unsettled delivery order on record — not only the ones inside whatever period the Dashboard
    // happens to be showing, which used to change this panel when the Dashboard filter changed.
    const outstanding = Object.values(receiptsByMonth).flat().filter((r) => r.status === "completed" && r.tableId === "delivery" && r.paid !== false && !r.deliverySettled);
    return dutyRoster
      .filter((p) => p.role === "delivery")
      .map((p) => {
        const orders = outstanding.filter((r) => r.assignedTo?.id === p.id);
        const cashTotal = orders.flatMap(receiptMethodAmounts).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
        const feesTotal = orders.reduce((s, r) => s + agentFeeShare(r.deliveryFee || 0), 0);
        return { ...p, orderList: orders, orders: orders.length, cashTotal, feesTotal, net: Math.round((cashTotal - feesTotal) * 100) / 100 };
      });
  }, [dutyRoster, receiptsByMonth, deliveryFeeRetentionMode, deliveryFeeRetentionPercent, deliveryFeeRetentionFixed]);

  // Marks every currently-outstanding delivery order for this rider (exactly the ones counted
  // into their card above) as settled, once the manager has actually collected/paid out the net
  // amount — so they drop out of every future reconciliation instead of double-counting.
  const settleDeliveryCash = (rider) => {
    setConfirmDialog({
      message: t("confirm_settleDelivery", { name: rider.name }),
      onConfirm: async () => {
        const monthKey = thisMonthKey();
        // Re-read the month first: writing back this device's cached copy could erase orders another
        // terminal saved since this one last refreshed.
        const list = await fetchFreshMonth(monthKey);
        // What the rider keeps of each order's delivery fee is saved with it: the drawer then receives what they hand
        // over (cash collected minus their share), or pays out what the restaurant owes them.
        const settledAt = new Date().toISOString();
        const updated = list.map((r) =>
          r.tableId === "delivery" && r.status === "completed" && r.assignedTo?.id === rider.id && r.paid !== false && !r.deliverySettled
            ? { ...r, deliverySettled: true, deliverySettledAt: settledAt, riderFeeShare: agentFeeShare(r.deliveryFee || 0) }
            : r
        );
        await persistMonth(monthKey, updated);
        flashNotice(t("notice_deliverySettled", { name: rider.name }));
      },
    });
  };

  // --- Menu / category editor ---
  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      flashNotice(t("notice_giveCategoryName"));
      return;
    }
    if (categories.includes(name)) {
      flashNotice(t("notice_categoryExists"));
      return;
    }
    setCategories((prev) => [...prev, name]);
    setMenu((prev) => ({ ...prev, [name]: [] }));
    // A price list that already had its own category of this name now simply shares the main one.
    setMenuProfiles((prev) => prev.map((p) => ((p.extraCategories || []).includes(name) ? { ...p, extraCategories: p.extraCategories.filter((c) => c !== name) } : p)));
    setNewCategoryName("");
  };
  const addMainCategory = () => {
    const name = newMainName.trim();
    if (!name) {
      flashNotice(t("notice_giveCategoryName"));
      return;
    }
    if (mainCategories.some((m) => m.name === name)) {
      flashNotice(t("notice_mainCategoryExists"));
      return;
    }
    setMainCategories((prev) => [...prev, { id: newId("main"), name, subs: [] }]);
    setNewMainName("");
  };
  const renameMainCategory = (id, name) => setMainCategories((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  const deleteMainCategory = (main) => {
    setConfirmDialog({
      message: t("confirm_deleteMainCategory", { name: main.name }),
      onConfirm: () => {
        setMainCategories((prev) => prev.filter((m) => m.id !== main.id));
        if (activeMain === main.id) setActiveMain(null);
      },
    });
  };
  // Moves a category one place earlier (-1) or later (+1); the Order screen tabs and the customer menus follow.
  const moveCategory = (cat, dir) => {
    setCategories((prev) => {
      const i = prev.indexOf(cat);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const moveProfileCategory = (profileId, cat, dir) => {
    setMenuProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        const list = [...(p.extraCategories || [])];
        const i = list.indexOf(cat);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return p;
        [list[i], list[j]] = [list[j], list[i]];
        return { ...p, extraCategories: list };
      })
    );
  };
  const deleteCategory = (cat) => {
    setConfirmDialog({
      message: t("confirm_deleteCategory", { name: cat }),
      onConfirm: () => {
        const removedIds = new Set((menu[cat] || []).map((it) => it.id));
        setMainCategories((prev) => removeSubEverywhere(prev, cat));
        setCategories((prev) => prev.filter((c) => c !== cat));
        setMenu((prev) => {
          const next = { ...prev };
          delete next[cat];
          return next;
        });
        // The category's dishes are gone from every price list too: their prices, removals and the extras added under it.
        setMenuProfiles((prev) =>
          prev.map((p) => {
            const extraItems = { ...(p.extraItems || {}) };
            delete extraItems[cat];
            const priceOverrides = Object.fromEntries(Object.entries(p.priceOverrides || {}).filter(([id]) => !removedIds.has(id)));
            return { ...p, extraItems, priceOverrides, hiddenItems: (p.hiddenItems || []).filter((id) => !removedIds.has(id)) };
          })
        );
        if (active === cat) setActive(categories.find((c) => c !== cat) || "");
      },
    });
  };

  const openNewItem = (category, profileId = null) => {
    setItemEditor({ mode: "new", category, id: null, name: "", tag: "", price: "", recipe: [], image: null, badges: [], featured: false, profileId });
    setRecipeDraftIng("");
    setRecipeDraftQty("");
    setRecipeSearch("");
    setRecipeQtyDrafts({});
  };
  const openEditItem = (category, item, profileId = null) => {
    setItemEditor({ mode: "edit", category, id: item.id, name: item.name, tag: item.tag, price: String(item.price), recipe: item.recipe.map((r) => ({ ...r })), image: item.image || null, badges: Array.isArray(item.badges) ? item.badges : [], featured: !!item.featured, profileId });
    setRecipeDraftIng("");
    setRecipeDraftQty("");
    setRecipeSearch("");
    setRecipeQtyDrafts({});
  };
  const closeItemEditor = () => setItemEditor(null);
  const MAX_ITEM_PHOTO_SOURCE_BYTES = 8 * 1024 * 1024; // source file cap, before it gets downscaled for storage
  const handleItemPhotoFile = async (file) => {
    if (!file) return;
    if (!looksLikeImage(file)) {
      flashNotice(t("notice_logoInvalidType"));
      return;
    }
    if (file.size > MAX_ITEM_PHOTO_SOURCE_BYTES) {
      flashNotice(t("notice_menuScanTooLarge"));
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setItemEditor((p) => (p ? { ...p, image: dataUrl } : p));
    } catch (e) {
      flashNotice(t("notice_imageDecodeFailed"));
    }
  };

  const addRecipeLine = () => {
    const draftQty = parseRecipeQty(recipeDraftQty);
    if (!recipeDraftIng || !(draftQty > 0)) {
      flashNotice("Pick an ingredient and a quantity used per serving");
      return;
    }
    const addedId = recipeDraftIng;
    setItemEditor((prev) => {
      const withoutDup = prev.recipe.filter((r) => r.ingredientId !== addedId);
      return { ...prev, recipe: [...withoutDup, { ingredientId: addedId, qty: draftQty }] };
    });
    setRecipeQtyDrafts((d) => {
      const { [addedId]: _gone, ...rest } = d;
      return rest;
    });
    setRecipeDraftIng("");
    setRecipeDraftQty("");
    setRecipeSearch("");
  };
  // Edits the quantity of a recipe line already added. Keeps the raw typed text separately so a
  // half-typed value like "0." survives; only a valid number above zero is applied to the recipe.
  const editRecipeLineQty = (ingredientId, raw) => {
    setRecipeQtyDrafts((d) => ({ ...d, [ingredientId]: raw }));
    const n = parseRecipeQty(raw);
    if (n > 0) setItemEditor((prev) => ({ ...prev, recipe: prev.recipe.map((r) => (r.ingredientId === ingredientId ? { ...r, qty: n } : r)) }));
  };
  const finishRecipeLineQtyEdit = (ingredientId) => {
    setRecipeQtyDrafts((d) => {
      const { [ingredientId]: _gone, ...rest } = d;
      return rest;
    });
  };
  const pickRecipeIngredient = (ing) => {
    setRecipeDraftIng(ing.id);
    setRecipeSearch(`${ing.name} (${ing.unit})`);
    setRecipeListOpen(false);
    setTimeout(() => recipeQtyInputRef.current?.focus(), 0);
  };
  const recipeSearchMatches = () => {
    const q = recipeSearch.trim().toLowerCase();
    const all = Object.values(ingredients).sort((a, b) => a.name.localeCompare(b.name));
    if (!q || recipeDraftIng) return all;
    const hits = all.filter((i) => i.name.toLowerCase().includes(q));
    return [...hits.filter((i) => i.name.toLowerCase().startsWith(q)), ...hits.filter((i) => !i.name.toLowerCase().startsWith(q))];
  };
  // Every item with a recipe that could serve as a starting point (base menu, then price-list-only
  // extras), grouped by category. The item currently being edited is left out.
  const recipeCopySources = () => {
    const groups = [];
    const keep = (items) => (items || []).filter((it) => it.id !== itemEditor?.id && it.recipe && it.recipe.length > 0);
    categories.forEach((cat) => {
      const items = keep(menu[cat]);
      if (items.length) groups.push({ label: cat, items });
    });
    menuProfiles.forEach((pr) => {
      Object.entries(pr.extraItems || {}).forEach(([cat, list]) => {
        const items = keep(list);
        if (items.length) groups.push({ label: `${cat} (${pr.name})`, items });
      });
    });
    return groups;
  };
  // Adds the chosen item's ingredients to this recipe. Lines already in this recipe are left exactly
  // as typed (so copying never overwrites something deliberately set); only missing ones are added.
  const copyRecipeFromItem = (sourceId) => {
    const source = sourceId && findMenuItemAnywhere(sourceId);
    if (!source) return;
    const have = new Set(itemEditor.recipe.map((r) => r.ingredientId));
    const toAdd = source.recipe.filter((r) => ingredients[r.ingredientId] && !have.has(r.ingredientId)).map((r) => ({ ...r }));
    if (toAdd.length === 0) {
      flashNotice(t("notice_recipeCopyNothingNew", { name: source.name }));
      return;
    }
    setItemEditor((prev) => ({ ...prev, recipe: [...prev.recipe, ...toAdd] }));
    flashNotice(t("notice_recipeCopied", { name: source.name }));
  };
  const removeRecipeLine = (ingredientId) => {
    setItemEditor((prev) => ({ ...prev, recipe: prev.recipe.filter((r) => r.ingredientId !== ingredientId) }));
  };

  const saveItemEditor = () => {
    const { mode, category, id, name, tag, price, recipe, image, badges, featured, profileId } = itemEditor;
    if (!name.trim() || !price || Number(price) <= 0) {
      flashNotice("Give the item a name and a valid price");
      return;
    }
    const itemData = { id: mode === "new" ? newId("item") : id, name: name.trim(), tag: tag.trim(), price: Number(price), recipe, image: image || null, badges: badges || [], featured: !!featured };
    if (profileId) {
      setMenuProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== profileId) return p;
          const list = (p.extraItems || {})[category] || [];
          const nextList = mode === "new" ? [...list, itemData] : list.map((it) => (it.id === id ? itemData : it));
          return { ...p, extraItems: { ...p.extraItems, [category]: nextList } };
        })
      );
    } else {
      setMenu((prev) => {
        const list = prev[category] || [];
        const nextList = mode === "new" ? [...list, itemData] : list.map((it) => (it.id === id ? itemData : it));
        return { ...prev, [category]: nextList };
      });
    }
    flashNotice(mode === "new" ? t("notice_itemAdded", { name: itemData.name }) : t("notice_itemUpdated", { name: itemData.name }));
    closeItemEditor();
  };
  const deleteMenuItem = (category, item, profileId = null) => {
    setConfirmDialog({
      message: t("confirm_removeMenuItem", { name: item.name }),
      onConfirm: () => {
        if (profileId) {
          setMenuProfiles((prev) =>
            prev.map((p) => (p.id === profileId ? { ...p, extraItems: { ...p.extraItems, [category]: ((p.extraItems || {})[category] || []).filter((it) => it.id !== item.id) } } : p))
          );
        } else {
          setMenu((prev) => ({ ...prev, [category]: prev[category].filter((it) => it.id !== item.id) }));
          // ...and out of every price list's own prices and removals.
          setMenuProfiles((prev) =>
            prev.map((p) => {
              const priceOverrides = { ...(p.priceOverrides || {}) };
              delete priceOverrides[item.id];
              return { ...p, priceOverrides, hiddenItems: (p.hiddenItems || []).filter((id) => id !== item.id) };
            })
          );
        }
      },
    });
  };
  // ---- A price list's own categories, and removing a main-menu dish from one list ----
  const addProfileCategory = (profileId) => {
    const name = (profileCategoryDraft[profileId] || "").trim();
    if (!name) {
      flashNotice(t("notice_giveCategoryName"));
      return;
    }
    const profile = menuProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    if (categories.includes(name) || (profile.extraCategories || []).includes(name)) {
      flashNotice(t("notice_profileCategoryExists"));
      return;
    }
    setMenuProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, extraCategories: [...(p.extraCategories || []), name], extraItems: { ...(p.extraItems || {}), [name]: [] } } : p)));
    setProfileCategoryDraft((d) => ({ ...d, [profileId]: "" }));
    flashNotice(t("notice_profileCategoryAdded", { name }));
  };
  const deleteProfileCategory = (profileId, cat) => {
    setConfirmDialog({
      message: t("confirm_deleteProfileCategory", { name: cat }),
      onConfirm: () => {
        setMenuProfiles((prev) =>
          prev.map((p) => {
            if (p.id !== profileId) return p;
            const extraItems = { ...(p.extraItems || {}) };
            delete extraItems[cat];
            return { ...p, extraCategories: (p.extraCategories || []).filter((c) => c !== cat), extraItems };
          })
        );
      },
    });
  };
  const removeItemFromProfile = (profileId, item) => {
    setConfirmDialog({
      message: t("confirm_removeFromProfile", { name: item.name }),
      onConfirm: () => setMenuProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, hiddenItems: [...new Set([...(p.hiddenItems || []), item.id])] } : p))),
    });
  };
  const restoreItemInProfile = (profileId, item) => {
    setMenuProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, hiddenItems: (p.hiddenItems || []).filter((id) => id !== item.id) } : p)));
  };
  // Menu profiles CRUD — see the effectiveMenu/findMenuItemAnywhere note above for how a profile
  // relates to the base menu.
  const createMenuProfile = () => {
    const name = newProfileName.trim();
    if (!name) {
      flashNotice(t("notice_giveProfileName"));
      return;
    }
    let profile = { id: newId("profile"), name, priceOverrides: {}, extraItems: {} };
    let copiedFrom = null;
    if (newProfileSource === "main") {
      // Every main-menu dish gets its current price written into the list, so the list keeps those prices even if
      // the main menu's change later (edit any of them in the list to suit).
      profile = { ...profile, priceOverrides: Object.fromEntries(Object.values(menu).flat().map((it) => [it.id, it.price])) };
      copiedFrom = t("profileCopyMainName");
    } else if (newProfileSource) {
      const source = menuProfiles.find((p) => p.id === newProfileSource);
      if (source) {
        // A full copy: prices, dishes removed from it, its own categories and its own dishes (with fresh ids and the
        // same recipes — they are separate dishes from then on).
        profile = {
          ...profile,
          priceOverrides: { ...(source.priceOverrides || {}) },
          hiddenItems: [...(source.hiddenItems || [])],
          extraCategories: [...(source.extraCategories || [])],
          extraItems: Object.fromEntries(
            Object.entries(source.extraItems || {}).map(([cat, items]) => [cat, (items || []).map((it) => ({ ...it, id: newId("item"), recipe: (it.recipe || []).map((r) => ({ ...r })), badges: [...(it.badges || [])] }))])
          ),
        };
        copiedFrom = `"${source.name}"`;
      }
    }
    setMenuProfiles((prev) => [...prev, profile]);
    setNewProfileName("");
    setNewProfileSource("");
    setManagingProfileId(profile.id);
    flashNotice(copiedFrom ? t("notice_profileCreatedCopy", { name, source: copiedFrom }) : t("notice_profileCreated", { name }));
  };
  const renameMenuProfile = (profileId, name) => {
    setMenuProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, name } : p)));
  };
  const deleteMenuProfile = (profile) => {
    setConfirmDialog({
      message: t("confirm_deleteMenuProfile", { name: profile.name }),
      onConfirm: () => {
        setMenuProfiles((prev) => prev.filter((p) => p.id !== profile.id));
        if (activeMenuProfile === profile.id) setActiveMenuProfile(null);
        if (managingProfileId === profile.id) setManagingProfileId(null);
      },
    });
  };
  const setProfilePriceOverride = (profileId, itemId, value) => {
    setMenuProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== profileId) return p;
        const next = { ...p.priceOverrides };
        if (value === "" || value === null || value === undefined) delete next[itemId];
        else next[itemId] = Number(value);
        return { ...p, priceOverrides: next };
      })
    );
  };

  const MAX_MENU_SCAN_BYTES = 30 * 1024 * 1024; // source file cap — the picture is shrunk before it is sent
  const handleMenuScanFile = async (file) => {
    if (!file) return;
    if (!looksLikeImage(file)) {
      flashNotice(t("notice_logoInvalidType"));
      return;
    }
    if (file.size > MAX_MENU_SCAN_BYTES) {
      flashNotice(t("notice_menuScanTooLarge"));
      return;
    }
    let dataUrl;
    try {
      dataUrl = await prepareMenuScanImage(file);
    } catch (e) {
      flashNotice(t("notice_imageDecodeFailed"));
      return;
    }
    setMenuScanImage(dataUrl);
    setMenuScanResults(null);
    setMenuScanError("");
    setMenuScanning(true);
    try {
      const res = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/scan-menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      // A reply that isn't JSON (the host's own "request too large" page, a timeout) must not surface as a parse error.
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || (res.status === 413 ? t("notice_menuScanTooLarge") : t("notice_menuScanFailed")));
      if (!data || !Array.isArray(data.items)) throw new Error(t("notice_menuScanFailed"));
      setMenuScanResults(data.items.map((it) => ({ ...it, include: true })));
      logActivity("menu_scanned", `${data.items.length} item(s) read`);
    } catch (e) {
      setMenuScanError(e instanceof TypeError ? t("notice_menuScanFailed") : e.message || t("notice_menuScanFailed"));
    } finally {
      setMenuScanning(false);
    }
  };
  const updateMenuScanResult = (index, patch) => {
    setMenuScanResults((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const closeMenuScan = () => {
    setMenuScanImage(null);
    setMenuScanResults(null);
    setMenuScanError("");
    setMenuScanning(false);
  };
  // Merges the checked, reviewed items into the live menu — creating any new categories along
  // the way. Scanned items have no recipe (stock tracking for them is opt-in afterward, same as
  // any manually-added item with no recipe set).
  const addScannedItems = () => {
    const toAdd = (menuScanResults || []).filter((it) => it.include && it.name.trim() && Number(it.price) > 0);
    if (toAdd.length === 0) {
      closeMenuScan();
      return;
    }
    setCategories((prevCats) => {
      const newCats = [...prevCats];
      toAdd.forEach((it) => {
        if (!newCats.includes(it.category)) newCats.push(it.category);
      });
      return newCats;
    });
    setMenu((prevMenu) => {
      const next = { ...prevMenu };
      toAdd.forEach((it) => {
        const list = next[it.category] || [];
        next[it.category] = [...list, { id: newId("item"), name: it.name.trim(), tag: it.tag.trim(), price: Number(it.price), recipe: [] }];
      });
      return next;
    });
    flashNotice(t("notice_menuScanAdded", { n: toAdd.length }));
    closeMenuScan();
  };

  // Auto-submits the login PIN pad once 4 digits are entered, rather than requiring a separate
  // "enter" tap — feels like a normal POS PIN pad.
  useEffect(() => {
    if (loginPin.length === 4 && loginSelectedId) {
      attemptLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginPin]);

  // Same auto-submit behavior for the manager-PIN prompt shown when a non-manager taps a gated tab.
  useEffect(() => {
    if (tabPinInput.length === 4 && tabPinPrompt) {
      submitTabPin(tabPinInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabPinInput]);

  // Reads the digit a keydown represents, whether it came from the number row or the numpad.
  // e.key alone isn't reliable for the numpad: with NumLock off, those same physical keys report
  // e.key as "Home"/"End"/"PageUp"/arrows/etc. instead of a digit (that's the actual key's other
  // function), which is exactly why typing a PIN on the numpad would intermittently stop working
  // depending on NumLock state. e.code identifies the physical key ("Numpad0".."Numpad9")
  // regardless of NumLock, so fall back to that when e.key isn't already a plain digit.
  const digitFromKeyEvent = (e) => {
    if (e.key >= "0" && e.key <= "9") return e.key;
    if (/^Numpad[0-9]$/.test(e.code)) return e.code.slice(-1);
    return null;
  };

  // Lets the PIN screen also be typed on a physical keyboard, not just tapped on the on-screen
  // pad — there's no real <input> behind those digit buttons (by design, so nothing shows in
  // autofill/password managers), so keystrokes need to be captured directly. Mirrors the button
  // handlers exactly: digits append (up to 4), Backspace removes the last one. Only listens while
  // this specific screen (an employee selected, PIN not yet entered) is actually showing.
  useEffect(() => {
    if (!loginSelectedId) return;
    const onKeyDown = (e) => {
      const digit = digitFromKeyEvent(e);
      if (digit !== null) {
        setLoginError(false);
        setLoginPin((p) => (p.length < 4 ? p + digit : p));
      } else if (e.key === "Backspace") {
        setLoginPin((p) => p.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loginSelectedId]);

  // Same physical-keyboard support for the manager-PIN prompt shown when a non-manager taps a
  // gated tab — this one never had it at all, only the login screen did.
  useEffect(() => {
    if (!tabPinPrompt) return;
    const onKeyDown = (e) => {
      const digit = digitFromKeyEvent(e);
      if (digit !== null) {
        setTabPinError(false);
        setTabPinInput((p) => (p.length < 4 ? p + digit : p));
      } else if (e.key === "Backspace") {
        setTabPinInput((p) => p.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tabPinPrompt]);

  // Built once per render and dropped into whichever screen is currently showing (login gate or
  // the main app) — a floating help button plus a slide-up chat panel, backed by a real call to
  // Claude with a system prompt describing this specific app.
  const viewportW = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768;
  const helpPanelOpensUp = helpButtonPos.top > viewportH / 2;
  const helpPanelOpensLeftward = helpButtonPos.left > viewportW / 2;
  const helpChatWidget = (
    <>
      <button
        onMouseDown={handleHelpDragStart}
        onTouchStart={handleHelpDragStart}
        onClick={() => {
          // A drag ending under the cursor shouldn't also register as a click that opens the chat.
          if (helpDragRef.current.moved) {
            helpDragRef.current.moved = false;
            return;
          }
          setHelpChatOpen((v) => !v);
        }}
        title={helpChatOpen ? t("helpChatClose") : t("helpChatOpen")}
        style={{
          position: "fixed",
          top: helpButtonPos.top,
          left: helpButtonPos.left,
          zIndex: 95,
          width: HELP_BTN_SIZE,
          height: HELP_BTN_SIZE,
          borderRadius: "50%",
          border: "none",
          background: theme.primary,
          color: "#FBF8F2",
          fontSize: 22,
          cursor: "grab",
          touchAction: "none",
          boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {helpChatOpen ? "×" : "?"}
      </button>
      {helpChatOpen && (
        <div
          style={{
            position: "fixed",
            top: helpPanelOpensUp ? undefined : helpButtonPos.top + HELP_BTN_SIZE + 10,
            bottom: helpPanelOpensUp ? viewportH - helpButtonPos.top + 10 : undefined,
            left: helpPanelOpensLeftward ? undefined : helpButtonPos.left,
            right: helpPanelOpensLeftward ? viewportW - helpButtonPos.left - HELP_BTN_SIZE : undefined,
            zIndex: 95,
            width: 340,
            maxWidth: "calc(100vw - 40px)",
            height: 440,
            maxHeight: "calc(100vh - 120px)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontFamily: isRtl ? "Tajawal, sans-serif" : "Fraunces, serif", fontSize: 14, fontWeight: 600 }}>
            {t("helpChatTitle")}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {helpChatMessages.length === 0 && (
              <>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("helpChatWelcome")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {["helpChatSuggestion1", "helpChatSuggestion2", "helpChatSuggestion3", "helpChatSuggestion4"].map((key) => (
                    <button
                      key={key}
                      onClick={() => sendHelpMessage(t(key))}
                      style={{ textAlign: isRtl ? "right" : "left", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {helpChatMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? (isRtl ? "flex-start" : "flex-end") : (isRtl ? "flex-end" : "flex-start"),
                  maxWidth: "85%",
                  background: m.role === "user" ? theme.primary : "var(--track)",
                  color: m.role === "user" ? "#FBF8F2" : "var(--text-primary)",
                  borderRadius: 10,
                  padding: "8px 11px",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {helpChatSending && <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{t("helpChatThinking")}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--border)" }}>
            <input
              type="text"
              value={helpChatInput}
              onChange={(e) => setHelpChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendHelpMessage(helpChatInput);
              }}
              placeholder={t("helpChatPlaceholder")}
              style={{ flex: 1, background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
            />
            <button
              onClick={() => sendHelpMessage(helpChatInput)}
              disabled={helpChatSending || !helpChatInput.trim()}
              style={{ padding: "0 14px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 12.5, fontWeight: 600, cursor: helpChatSending ? "default" : "pointer", opacity: helpChatSending || !helpChatInput.trim() ? 0.6 : 1 }}
            >
              {t("helpChatSend")}
            </button>
          </div>
        </div>
      )}
    </>
  );

  // --- Login gate ---
  // Both loading flags come from independent effects (personal "who's logged in on this device"
  // vs shared "staff roster"), so wait for both before deciding what to show — otherwise a
  // logged-in employee could flash the login screen for a moment while the roster is still
  // loading in behind them.
  if (!bootCache && !(brandingLoaded && uiThemeLoaded && langLoaded)) return <BootLoader />;
  if (!currentEmployeeLoaded || !employeesLoaded) {
    return (
      <div data-theme={uiTheme} dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: "var(--bg)", minHeight: "100vh", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("loading")}</div>
      </div>
    );
  }

  if (!currentEmployee) {
    const selectedEmp = employees.find((e) => e.id === loginSelectedId);
    return (
      <div data-theme={uiTheme} dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: "var(--bg)", minHeight: "100vh", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <style>{`
          button { transition: filter .12s ease, background .15s ease, border-color .15s ease, transform .08s ease; }
          button:not(:disabled):hover { filter: brightness(1.14); }
          button:not(:disabled):active { transform: scale(0.97); }
          input:focus { outline: none; border-color: ${theme.secondary} !important; box-shadow: 0 0 0 3px ${theme.secondary}33; }
        `}</style>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div onClick={handleBrandTap} style={{ textAlign: "center", marginBottom: 28, userSelect: "none", WebkitUserSelect: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", cursor: "default" }}>
            {logoUrl && <img draggable={false} src={logoUrl} alt={restaurantName} style={{ height: 44, width: "auto", maxWidth: 160, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />}
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600 }}>{restaurantName}</div>
          </div>

          {rosterLoadFailed ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, fontFamily: "Fraunces, serif" }}>{t("offlineBadge")}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>{t("rosterLoadFailedHint")}</div>
              <button onClick={retryRosterLoad} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("retrySync")}</button>
            </div>
          ) : pendingOpeningCount ? (() => {
            const n = parseFloat(openingCountDraft);
            const valid = openingCountDraft.trim() !== "" && Number.isFinite(n) && n >= 0;
            const last = lastCountedToday();
            return (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{t("openingCountTitle")}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{pendingOpeningCount.name} &middot; {t("openingCountSubtitle")}</div>
                {last && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12 }}>{t("openingCountPrevious", { name: last.employeeName, amount: money(last.countedCash) })}</div>}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  autoFocus
                  value={openingCountDraft}
                  onChange={(e) => setOpeningCountDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmOpeningCount(); }}
                  placeholder={t("openingCountPlaceholder")}
                  style={{ width: "100%", boxSizing: "border-box", textAlign: "center", fontSize: 22, fontFamily: "IBM Plex Mono, monospace", padding: "12px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "#FFFFFF", color: "#111111", marginBottom: 14 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button disabled={!valid} onClick={confirmOpeningCount} style={{ padding: "13px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>{t("openingCountStart")}</button>
                  <button onClick={() => setPendingOpeningCount(null)} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>{t("loginBackToNames")}</button>
                </div>
              </div>
            );
          })() : pendingManagerLogin ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{t("loginModeChoiceTitle", { name: pendingManagerLogin.name })}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 22, lineHeight: 1.5 }}>{t("loginModeChoiceSubtitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => startOpeningCount(pendingManagerLogin)} style={{ padding: "13px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("loginClockInOption")}</button>
                <button onClick={() => viewWithoutClockIn(pendingManagerLogin)} style={{ padding: "13px 0", borderRadius: 8, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("loginViewOnlyOption")}</button>
                <button onClick={() => setPendingManagerLogin(null)} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>{t("loginBackToNames")}</button>
              </div>
            </div>
          ) : employees.length === 0 || loginAddMode ? (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, fontFamily: "Fraunces, serif", textAlign: "center" }}>{t("loginWelcome")}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18, textAlign: "center" }}>{employees.length === 0 ? t("loginNoStaffYet") : t("loginSubtitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  value={loginNewName}
                  onChange={(e) => setLoginNewName(e.target.value)}
                  placeholder={t("yourNamePlaceholder")}
                  style={{ background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={loginNewPin}
                  onChange={(e) => setLoginNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder={t("choosePinPlaceholder")}
                  style={{ background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: "IBM Plex Mono, monospace", letterSpacing: 4, textAlign: "center" }}
                />
                <button onClick={addEmployeeFromLogin} style={{ padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("createPinAndStart")}</button>
                {employees.length > 0 && (
                  <button onClick={() => { setLoginAddMode(false); setLoginNewName(""); setLoginNewPin(""); }} style={{ padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{t("loginBackToNames")}</button>
                )}
              </div>
            </div>
          ) : selectedEmp ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{selectedEmp.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20 }}>{t("enterPin")}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: loginError ? 6 : 22 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${theme.secondary}`, background: i < loginPin.length ? theme.secondary : "transparent" }} />
                ))}
              </div>
              {loginError && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 16 }}>{t("pinIncorrect")}</div>}
              {/* Keypad direction is deliberately pinned to ltr regardless of page language — a
                  numeric keypad should always read 1-2-3 left to right, not mirror with RTL. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16, direction: "ltr" }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    onClick={() => { setLoginError(false); setLoginPin((p) => (p.length < 4 ? p + d : p)); }}
                    style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
                  >
                    {d}
                  </button>
                ))}
                <button onClick={() => { setLoginSelectedId(null); setLoginPin(""); setLoginError(false); }} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>{t("loginBackToNames")}</button>
                <button
                  onClick={() => { setLoginError(false); setLoginPin((p) => (p.length < 4 ? p + "0" : p)); }}
                  style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
                >
                  0
                </button>
                <button onClick={() => setLoginPin((p) => p.slice(0, -1))} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>&larr;</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, fontFamily: "Fraunces, serif", textAlign: "center" }}>{t("loginWelcome")}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18, textAlign: "center" }}>{t("loginSubtitle")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => { setLoginSelectedId(emp.id); setLoginPin(""); setLoginError(false); }}
                    style={{ padding: "16px 8px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                      {initials(emp.name)}
                    </div>
                    <span style={{ fontSize: 12 }}>{emp.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setLoginAddMode(true)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>{t("loginAddYourself")}</button>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 28, fontSize: 10, letterSpacing: 0.6, color: "#4A4F5A" }}>G&amp;B</div>
        </div>
        {hasFeature("helpChat") && helpChatWidget}
        {supportOpen && (
          <React.Suspense fallback={null}>
            <SupportLogin tenantId={tenantId} isRtl={isRtl} theme={theme} onSuccess={({ expiresAt }) => enterSupportSession(expiresAt)} onClose={() => setSupportOpen(false)} />
          </React.Suspense>
        )}
      </div>
    );
  }

  return (
    <div data-theme={uiTheme} dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: "var(--bg)", minHeight: "100vh", color: "var(--text-primary)" }}>
      <style>{FONTS}</style>
      <style>{`
        .menu-card { transition: transform .12s ease, border-color .12s ease; }
        .menu-card:not(:disabled):active { transform: scale(0.97); }
        .tab-pill, .view-pill, .pay-pill, .lang-pill { transition: background .15s ease, color .15s ease; }
        .ticket-row { animation: rowIn .25s ease; }
        @keyframes rowIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .save-btn:not(:disabled):active { transform: scale(0.98); }
        .notice { animation: noticeIn .18s ease; }
        @keyframes noticeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes billPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(142,184,214,0.5); } 50% { box-shadow: 0 0 0 5px rgba(142,184,214,0); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .stock-input::-webkit-inner-spin-button { opacity: 1; }
        .field { background: #FFFFFF; border: 1px solid var(--border); border-radius: 7px; padding: 9px 12px; color: #111111; font-size: 13px; font-family: ${isRtl ? "'Tajawal', sans-serif" : "'Inter', sans-serif"}; }
        .field::placeholder { color: #6B6F78; }
        .field:focus { outline: none; border-color: ${theme.primary}; box-shadow: 0 0 0 3px ${theme.primary}33; }
        button { transition: filter .12s ease, background .15s ease, border-color .15s ease, transform .08s ease; }
        button:not(:disabled):hover { filter: brightness(1.14); }
        button:not(:disabled):active { transform: scale(0.98); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "20px 32px", borderBottom: "1px solid #333945", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logoUrl && <img src={logoUrl} alt={restaurantName} style={{ height: isMobile ? 26 : 32, width: "auto", maxWidth: 140, objectFit: "contain", borderRadius: 4 }} />}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "Fraunces, serif", fontSize: isMobile ? 19 : 24, fontWeight: 600, letterSpacing: 0.3 }}>{restaurantName}</span>
            {!isMobile && <span style={{ fontSize: 12, color: theme.secondaryLight, letterSpacing: 1.5, textTransform: "uppercase" }}>{t("appSubtitle")}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 20, flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>
          <div style={{ display: "flex", background: "var(--surface)", borderRadius: 999, padding: 3, border: "1px solid var(--border)", flexWrap: isCompact ? "nowrap" : "wrap", overflowX: isCompact ? "auto" : undefined, maxWidth: isCompact ? "100%" : undefined, WebkitOverflowScrolling: "touch" }}>
            {["order", "menu", "stock", "tables", "delivery", "website", "receipts", "expenses", "dashboard", "customers", "shift", "closeday", "staff", "settings"]
              .filter((key) => {
                if (key === "order" || key === "settings") return true;
                // "delivery" isn't itself a package feature key — the tab shows if either of its
                // two sub-features (the online-ordering link, delivery zones) is enabled, and the
                // tab's own content decides what to actually render based on which one(s) are on.
                if (key === "delivery") return hasFeature("onlineOrderingLink") || hasFeature("deliveryZones");
                // Close the day isn't its own package feature — it comes with Shift tracking.
                if (key === "closeday") return hasFeature("shift");
                // The website designer is a manager's tool and comes with the online-ordering link.
                if (key === "website") return hasFeature("onlineOrderingLink") && isManager;
                return hasFeature(key);
              })
              .map((key) => {
                const locked = hasFeature("tabAccessControl") && pinGatedTabs.includes(key) && !isManager && !unlockedTabs.has(key);
                const active = view === key && (key !== "order" || activeMenuProfile === null);
                return (
                  <React.Fragment key={key}>
                    <button
                      onClick={() => handleTabClick(key)}
                      className="view-pill"
                      title={locked ? t("gatedTabTooltip") : undefined}
                      style={{
                        padding: isMobile ? "7px 11px" : "7px 14px",
                        borderRadius: 999,
                        border: "none",
                        background: active ? theme.primary : "transparent",
                        color: active ? "#FBF8F2" : "var(--text-muted)",
                        fontSize: isMobile ? 12.5 : 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {locked && "🔒 "}{t(`tab_${key}`)}
                    </button>
                    {key === "order" &&
                      menuProfiles.map((p) => {
                        const profileActive = view === "order" && activeMenuProfile === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => openMenuProfileTab(p.id)}
                            className="view-pill"
                            style={{
                              padding: isMobile ? "7px 11px" : "7px 14px",
                              borderRadius: 999,
                              border: "none",
                              background: profileActive ? theme.primary : "transparent",
                              color: profileActive ? "#FBF8F2" : "var(--text-muted)",
                              fontSize: isMobile ? 12.5 : 13,
                              fontWeight: 500,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                  </React.Fragment>
                );
              })}
          </div>
          <div style={{ display: "flex", background: "var(--surface)", borderRadius: 999, padding: 3, border: "1px solid var(--border)" }} title={t("langToggleLabel")}>
            {["en", "ar"].map((code) => (
              <button
                key={code}
                onClick={() => toggleLang(code)}
                className="lang-pill"
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "none",
                  background: lang === code ? theme.primary : "transparent",
                  color: lang === code ? "#FBF8F2" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                {code === "en" ? "EN" : "AR"}
              </button>
            ))}
          </div>
          {!isOnline && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: `1px solid ${COLORS.red}`, background: "rgba(166,83,74,0.15)", color: "#E3A79C", fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E3A79C", display: "inline-block" }} />
              {t("offlineBadge")}
            </div>
          )}
          {menuLoadFailed && (
            <div title={t("menuLoadFailedHint")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: `1px solid ${COLORS.red}`, background: "rgba(166,83,74,0.15)", color: "#E3A79C", fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E3A79C", display: "inline-block" }} />
              {t("menuLoadFailedBadge")}
            </div>
          )}
          {!menuLoadFailed && (menuProfilesLoadFailed || tablesLoadFailed || taxConfigLoadFailed || deliveryShareConfigLoadFailed || uiThemeLoadFailed) && (
            <div title={t("configLoadFailedHint")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: `1px solid ${COLORS.red}`, background: "rgba(166,83,74,0.15)", color: "#E3A79C", fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E3A79C", display: "inline-block" }} />
              {t("configLoadFailedBadge")}
            </div>
          )}
          {syncQueue.length > 0 && (
            <button
              onClick={flushSyncQueue}
              title={syncQueue.map((task) => task.label).join(", ")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              {tCount("syncPendingPill", syncQueue.length)} &middot; {t("retrySync")}
            </button>
          )}
          {activePendingOrders.length > 0 && (
            <button
              onClick={() => setReviewTableId(activePendingOrders[0].tableId)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid #C9A24A", background: "rgba(201,162,74,0.15)", color: "#E3C98A", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E3C98A", display: "inline-block" }} />
              {tCount("pendingOrdersPill", activePendingOrders.length)}
            </button>
          )}
          {checkoutRequests.length > 0 && (
            <button
              onClick={() => handleTabClick("tables")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid #8EB8D6", background: "rgba(142,184,214,0.15)", color: "#8EB8D6", fontSize: 12.5, fontWeight: 600, cursor: "pointer", animation: "billPulse 1.6s ease-in-out infinite" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8EB8D6", display: "inline-block" }} />
              {tCount("billRequestedPill", checkoutRequests.length)}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 24, fontSize: isMobile ? 12 : 13, color: "var(--text-muted)", flexWrap: "wrap" }}>
            <span>{t("orderingForLabel")} <b style={{ color: "var(--text-primary)", fontWeight: 500 }}>{tableLabel(activeTableId)}</b></span>
            {!isMobile && hasFeature("staff") && <span>{t("serverLabel")} <b style={{ color: "var(--text-primary)", fontWeight: 500 }}>{currentEmployee?.name}</b></span>}
            {hasFeature("shift") && (
              viewingOnly
                ? <button onClick={exitViewingMode} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("exitViewMode")}</button>
                : <button onClick={clockOut} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("clockOut")}</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right", padding: isMobile ? "5px 14px" : "5px 32px", fontSize: 10, letterSpacing: 0.6, color: "#5A5F6A" }}>
        G&amp;B
      </div>

      {notice && (
        <div className="notice" style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#2E2320", border: `1px solid ${COLORS.red}`, color: "#F0D8D2", padding: "10px 18px", borderRadius: 8, fontSize: 13, zIndex: 50, maxWidth: "80%", textAlign: "center" }}>
          {notice}
        </div>
      )}

      {view === "order" && (
        <div style={{ display: "flex", alignItems: "flex-start", flexDirection: isCompact ? "column" : "row" }}>
          <div style={{ flex: 1, width: isCompact ? "100%" : undefined, padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px" }}>
            {mainTabs.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {mainTabs.map((mt) => {
                  const on = activeMainTab && activeMainTab.id === mt.id;
                  return (
                    <button
                      key={mt.id}
                      onClick={() => selectMain(mt)}
                      className="tab-pill"
                      style={{ padding: "10px 22px", borderRadius: 10, border: `1px solid ${on ? theme.secondary : "var(--border)"}`, background: on ? "rgba(176,141,87,0.18)" : "transparent", color: on ? theme.secondaryLight : "var(--text-muted)", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
                    >
                      {mt.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {visibleSubs.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActive(cat)}
                  className="tab-pill"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 999,
                    border: `1px solid ${active === cat ? theme.primary : "var(--border)"}`,
                    background: active === cat ? theme.primary : "transparent",
                    color: active === cat ? "#FBF8F2" : "var(--text-muted)",
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {!menuLoaded && <div style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14 }}>{t("loading")}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {(effectiveMenu[active] || []).map((item) => {
                const badge = servingsBadge(item);
                const out = rawMaxServings(item) === 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    disabled={out}
                    className="menu-card"
                    style={{
                      textAlign: "left",
                      background: "var(--surface)",
                      border: `1px solid ${out ? "#4A2E2C" : "var(--border)"}`,
                      borderRadius: 12,
                      padding: 16,
                      cursor: out ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      opacity: out ? 0.55 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <MenuThumb item={item} />
                      <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: theme.secondary }}>{money(item.price)}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>{item.tag}</div>
                      <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 999, background: badge.color, color: badge.fg, fontWeight: 500, letterSpacing: 0.3 }}>{badge.text}</span>
                    </div>
                  </button>
                );
              })}
              {(effectiveMenu[active] || []).length === 0 && (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noItemsInCategory")}</div>
              )}
            </div>
          </div>

          <div style={{ width: isCompact ? "100%" : 360, padding: isCompact ? (isMobile ? "0 14px 16px" : "0 20px 20px") : "28px 28px 28px 0", flexShrink: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 2 }}>
              <button
                onClick={() => switchTable(null)}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === null ? theme.secondary : "var(--border)"}`, background: activeTableId === null ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === null ? theme.secondaryLight : "var(--text-muted)", fontSize: 11.5, fontWeight: activeTableId === null ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap", position: "relative" }}
              >
                {t("takeawayLabel")}
                {tableItemCount(null) > 0 && <span style={{ marginLeft: 5, fontSize: 9.5, background: theme.secondary, color: COLORS.ink, borderRadius: 999, padding: "1px 5px" }}>{tableItemCount(null)}</span>}
              </button>
              {hasFeature("deliveryZones") && (
                <button
                  onClick={() => switchTable("delivery")}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === "delivery" ? theme.secondary : "var(--border)"}`, background: activeTableId === "delivery" ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === "delivery" ? theme.secondaryLight : "var(--text-muted)", fontSize: 11.5, fontWeight: activeTableId === "delivery" ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {t("deliveryLabel")}
                  {tableItemCount("delivery") > 0 && <span style={{ marginLeft: 5, fontSize: 9.5, background: theme.secondary, color: COLORS.ink, borderRadius: 999, padding: "1px 5px" }}>{tableItemCount("delivery")}</span>}
                </button>
              )}
              {hasFeature("tables") ? (
                tableIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => switchTable(id)}
                    style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === id ? theme.secondary : "var(--border)"}`, background: activeTableId === id ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === id ? theme.secondaryLight : "var(--text-muted)", fontSize: 11.5, fontWeight: activeTableId === id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {tableLabel(id)}
                    {tableItemCount(id) > 0 && <span style={{ marginLeft: 5, fontSize: 9.5, background: theme.secondary, color: COLORS.ink, borderRadius: 999, padding: "1px 5px" }}>{tableItemCount(id)}</span>}
                  </button>
                ))
              ) : (
                // No individual table tracking on this package — just one generic "Dine In"
                // bucket alongside Takeaway/Delivery, instead of a numbered-table list.
                <button
                  onClick={() => switchTable("dine-in")}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === "dine-in" ? theme.secondary : "var(--border)"}`, background: activeTableId === "dine-in" ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === "dine-in" ? theme.secondaryLight : "var(--text-muted)", fontSize: 11.5, fontWeight: activeTableId === "dine-in" ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {t("dineInLabel")}
                  {tableItemCount("dine-in") > 0 && <span style={{ marginLeft: 5, fontSize: 9.5, background: theme.secondary, color: COLORS.ink, borderRadius: 999, padding: "1px 5px" }}>{tableItemCount("dine-in")}</span>}
                </button>
              )}
            </div>
            <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: "4px 4px 10px 10px", clipPath: "polygon(0% 3%, 4% 0%, 8% 3%, 12% 0%, 16% 3%, 20% 0%, 24% 3%, 28% 0%, 32% 3%, 36% 0%, 40% 3%, 44% 0%, 48% 3%, 52% 0%, 56% 3%, 60% 0%, 64% 3%, 68% 0%, 72% 3%, 76% 0%, 80% 3%, 84% 0%, 88% 3%, 92% 0%, 96% 3%, 100% 0%, 100% 100%, 0% 100%)", padding: "22px 20px 20px", fontFamily: "IBM Plex Mono, monospace" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{ticketNo ? t("ticketNumber", { n: ticketNo }) : t("newTicketLabel")}</span>
                <span style={{ fontSize: 10.5, letterSpacing: 1, padding: "3px 8px", borderRadius: 999, background: saved ? "#E3EBE3" : "#EFE4CB", color: saved ? COLORS.sage : "#8A6A2E", textTransform: "uppercase", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                  {saved ? t("saved") : t("open")}
                </span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{tableLabel(activeTableId)} &middot; {assignedTo?.role === "waiter" ? assignedTo.name : currentEmployee?.name}</span>
                {cart.length > 0 && <button onClick={clearActiveTable} style={{ fontSize: 10.5, color: COLORS.red, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{t("clearTable")}</button>}
              </div>

              <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, paddingTop: 14, minHeight: 100 }}>
                {cart.length === 0 && <div style={{ fontSize: 12.5, color: "#A6A196", fontFamily: "Inter, sans-serif", padding: "8px 0 20px" }}>{t("tapMenuItemHint")}</div>}
                {cart.map((item) => (
                  <div key={item.lineId} className="ticket-row" style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{item.qty}&times; {item.name}</span>
                      <span>{money(item.price * item.qty)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                      <button onClick={() => changeQty(item.lineId, -1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.charcoal, fontSize: 12, cursor: "pointer", lineHeight: 1 }}>&minus;</button>
                      <button onClick={() => changeQty(item.lineId, 1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.charcoal, fontSize: 12, cursor: "pointer", lineHeight: 1 }}>+</button>
                      {editingNoteLineId !== item.lineId && (
                        <button
                          onClick={() => setEditingNoteLineId(item.lineId)}
                          style={{ fontSize: 11, color: item.note ? theme.primary : "#A6A196", background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: 4, textAlign: "left", fontStyle: item.note ? "italic" : "normal" }}
                        >
                          {item.note || t("addNote")}
                        </button>
                      )}
                    </div>
                    {editingNoteLineId === item.lineId && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input
                          type="text"
                          autoFocus
                          maxLength={140}
                          value={item.note}
                          onChange={(e) => updateCartNote(item.lineId, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingNoteLineId(null);
                          }}
                          placeholder={t("notePlaceholder")}
                          style={{ flex: 1, fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "4px 6px", background: "transparent", fontFamily: "Inter, sans-serif" }}
                        />
                        <button onClick={() => setEditingNoteLineId(null)} style={{ fontSize: 11, background: theme.primary, color: "#FBF8F2", border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}>{t("apply")}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {hasFeature("discounts") && (
                <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, marginTop: 6, paddingTop: 12 }}>
                  {!discount && !discountOpen && (
                    <button onClick={() => setDiscountOpen(true)} style={{ fontSize: 11.5, color: theme.primary, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>{t("addDiscount")}</button>
                  )}
                  {discountOpen && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontFamily: "Inter, sans-serif" }}>
                      <select value={discountDraft.type} onChange={(e) => setDiscountDraft((d) => ({ ...d, type: e.target.value }))} style={{ fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "4px 4px", background: "transparent" }}>
                        <option value="percent">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input type="number" value={discountDraft.value} onChange={(e) => setDiscountDraft((d) => ({ ...d, value: e.target.value }))} placeholder="0" style={{ width: 54, fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "4px 6px", background: "transparent" }} />
                      <input type="text" value={discountDraft.reason || ""} onChange={(e) => setDiscountDraft((d) => ({ ...d, reason: e.target.value }))} placeholder={t("discountReasonPlaceholder")} maxLength={120} style={{ flexBasis: "100%", fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "5px 7px", background: "transparent" }} />
                      <button onClick={applyDiscount} style={{ fontSize: 11, background: theme.primary, color: "#FBF8F2", border: "none", borderRadius: 5, padding: "5px 9px", cursor: "pointer" }}>{t("apply")}</button>
                      <button onClick={() => setDiscountOpen(false)} style={{ fontSize: 11, background: "none", color: COLORS.charcoalSoft, border: "none", cursor: "pointer" }}>{t("cancel")}</button>
                    </div>
                  )}
                  {discount && !discountOpen && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Inter, sans-serif" }}>
                      <span style={{ fontSize: 12 }}>
                        {t("discountLabel", { value: discount.type === "percent" ? `${discount.value}%` : money(Number(discount.value)) })}
                        {discount.reason && <span style={{ display: "block", fontSize: 10.5, color: COLORS.charcoalSoft, marginTop: 2 }}>{t("discountReasonLabel", { reason: discount.reason })}</span>}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setDiscountDraft({ type: discount.type, value: String(discount.value), reason: discount.reason || "" }); setDiscountOpen(true); }} style={{ fontSize: 11, color: COLORS.charcoalSoft, background: "none", border: "none", cursor: "pointer" }}>{t("edit")}</button>
                        <button onClick={removeDiscount} style={{ fontSize: 11, color: COLORS.red, background: "none", border: "none", cursor: "pointer" }}>{t("remove")}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasFeature("splitBill") && (
              <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, marginTop: 6, paddingTop: 12 }}>
                {!splitCount && !splitOpen && (
                  <button onClick={() => setSplitOpen(true)} style={{ fontSize: 11.5, color: theme.primary, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>{t("splitBill")}</button>
                )}
                {splitOpen && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "Inter, sans-serif" }}>
                    <input
                      type="number"
                      min={2}
                      value={splitDraft}
                      onChange={(e) => setSplitDraft(e.target.value)}
                      placeholder={t("numberOfPeoplePlaceholder")}
                      style={{ width: 120, fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "4px 6px", background: "transparent" }}
                    />
                    <button onClick={applySplit} style={{ fontSize: 11, background: theme.primary, color: "#FBF8F2", border: "none", borderRadius: 5, padding: "5px 9px", cursor: "pointer" }}>{t("apply")}</button>
                    <button onClick={() => setSplitOpen(false)} style={{ fontSize: 11, background: "none", color: COLORS.charcoalSoft, border: "none", cursor: "pointer" }}>{t("cancel")}</button>
                  </div>
                )}
                {splitCount && !splitOpen && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Inter, sans-serif" }}>
                    <span style={{ fontSize: 12 }}>{t("splitLabel", { n: splitCount })}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setSplitDraft(String(splitCount)); setSplitOpen(true); }} style={{ fontSize: 11, color: COLORS.charcoalSoft, background: "none", border: "none", cursor: "pointer" }}>{t("edit")}</button>
                      <button onClick={removeSplit} style={{ fontSize: 11, color: COLORS.red, background: "none", border: "none", cursor: "pointer" }}>{t("remove")}</button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {cart.length > 0 && unpaidInvoicesThisMonth.length > 0 && (
                <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, marginTop: 6, paddingTop: 12 }}>
                  <button onClick={() => setAddToInvoiceOpen(true)} style={{ fontSize: 11.5, color: theme.primary, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>{t("addToExistingInvoice")}</button>
                </div>
              )}

              <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, marginTop: 6, paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 4 }}><span>{t("subtotal")}</span><span>{money(subtotal)}</span></div>
                {discount && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 4 }}><span>{t("discount")}</span><span>-{money(discAmt)}</span></div>}
                {effectiveServicePercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 4 }}><span>{t("serviceCharge")} ({effectiveServicePercent}%)</span><span>{money(serviceAmt)}</span></div>}
                {effectiveVatPercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 4 }}><span>{t("vat")} ({effectiveVatPercent}%)</span><span>{money(vatAmt)}</span></div>}
                {deliveryMethod === "delivery" && deliveryFee > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 4 }}>
                    <span>{t("deliveryFeeLineLabel")}{deliveryZoneLabel ? ` (${deliveryZoneLabel})` : ""}</span><span>{money(deliveryFee)}</span>
                  </div>
                )}
                {deliveryMethod && (
                  <div style={{ fontSize: 10.5, color: theme.secondaryLight, marginBottom: 4 }}>
                    {deliveryMethod === "pickup" ? t("pickupBadge") : t("deliveryBadge", { zone: deliveryZoneLabel })}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 500, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8, marginTop: 4 }}><span>{t("total")}</span><span>{money(total)}</span></div>
                {splitCount > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500, color: theme.primary, marginTop: 4 }}>
                    <span>{t("splitLabel", { n: splitCount })}</span><span>{t("eachPays", { amount: money(total / splitCount) })}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginTop: 4 }}>{tCount("itemCount", itemCount)}</div>
              </div>
            </div>

            {hasFeature("teamTracking") && dutyRoster.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("assignedToLabel")}</div>
                <select
                  value={assignedTo?.id || ""}
                  onChange={(e) => {
                    const member = dutyRoster.find((m) => m.id === e.target.value);
                    setAssignedTo(member ? { id: member.id, name: member.name, role: member.role } : null);
                  }}
                  className="field"
                  style={{ width: "100%" }}
                >
                  <option value="">{t("assignedToNone")}</option>
                  {/* Waiters are only relevant to a table/takeaway ticket — a Delivery ticket is
                      run entirely by delivery staff, so don't offer waiters there either. */}
                  {activeTableId !== "delivery" && dutyRoster.filter((m) => m.role === "waiter").length > 0 && (
                    <optgroup label={t("roleWaiter")}>
                      {dutyRoster.filter((m) => m.role === "waiter").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  )}
                  {/* Delivery staff are only relevant to an actual Delivery ticket — not Takeaway, not a table. */}
                  {activeTableId === "delivery" && dutyRoster.filter((m) => m.role === "delivery").length > 0 && (
                    <optgroup label={t("roleDelivery")}>
                      {dutyRoster.filter((m) => m.role === "delivery").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {activeTableId === "delivery" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("chooseDeliveryZone")}</div>
                {deliveryZones.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{t("noZonesYet")}</div>
                ) : (
                  <select
                    value={deliveryZones.find((z) => z.label === deliveryZoneLabel)?.id || ""}
                    onChange={(e) => {
                      const zone = deliveryZones.find((z) => z.id === e.target.value);
                      setDeliveryMethod("delivery");
                      setDeliveryFee(zone ? zone.fee : 0);
                      setDeliveryZoneLabel(zone ? zone.label : "");
                    }}
                    className="field"
                    style={{ width: "100%" }}
                  >
                    <option value="">{t("selectZonePlaceholder")}</option>
                    {deliveryZones.map((z) => (
                      <option key={z.id} value={z.id}>{z.label} — {money(z.fee)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {activeTableId === "delivery" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("customerOptional")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("namePlaceholder")} className="field" />
                  <div style={{ position: "relative" }}>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => { handlePhoneChange(e.target.value); setShowCustomerSuggestions(true); }}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                      placeholder={t("phoneSearchPlaceholder")}
                      className="field"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                    {showCustomerSuggestions && customerPhone && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 20, overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.4)" }}>
                        {customerMatches.length === 0 ? (
                          <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-faint)" }}>{t("noMatchesNewCustomer")}</div>
                        ) : (
                          customerMatches.map((c) => (
                            <button key={c.phone} onMouseDown={() => selectCustomer(c)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #333945", padding: "9px 12px", cursor: "pointer", color: "var(--text-primary)" }}>
                              <div style={{ fontSize: 13 }}>{c.name || t("unnamed")}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono, monospace" }}>{c.phone}{c.address ? ` · ${c.address}` : ""}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <input type="text" value={customerAddress} onChange={(e) => handleAddressChange(e.target.value)} placeholder={t("addressPlaceholder")} className="field" />
                  <input type="text" value={orderEta} onChange={(e) => setOrderEta(e.target.value)} placeholder={t("etaPlaceholder")} className="field" />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
              {PAYMENT_METHODS.map((m) => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)} className="pay-pill" style={{ flex: "1 1 70px", padding: "9px 0", borderRadius: 7, border: `1px solid ${paymentMethod === m.id ? theme.secondary : "var(--border)"}`, background: paymentMethod === m.id ? "#3A2E22" : "transparent", color: paymentMethod === m.id ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                  {t(`payment_${m.id}`)}
                </button>
              ))}
              <button onClick={() => { setPaymentMethod("split"); setPaidNow(true); }} className="pay-pill" style={{ flex: "1 1 70px", padding: "9px 0", borderRadius: 7, border: `1px solid ${paymentMethod === "split" ? theme.secondary : "var(--border)"}`, background: paymentMethod === "split" ? "#3A2E22" : "transparent", color: paymentMethod === "split" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                {t("splitPaymentOption")}
              </button>
            </div>

            {paymentMethod === "split" && (() => {
              const splitEntered = PAYMENT_METHODS.reduce((s, m) => s + (Number(splitAmounts[m.id]) || 0), 0);
              const splitRemaining = Math.round((total - splitEntered) * 100) / 100;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 10 }}>
                  {PAYMENT_METHODS.map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t(`payment_${m.id}`)}</span>
                      <input
                        type="number"
                        value={splitAmounts[m.id] || ""}
                        onChange={(e) => setSplitAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="0.00"
                        className="field"
                        style={{ width: 100, textAlign: "right" }}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: splitRemaining === 0 ? "#9FCB8E" : "#E3A79C" }}>
                    <span>{t("splitRemainingLabel")}</span><span>{money(splitRemaining)}</span>
                  </div>
                </div>
              );
            })()}

            {paymentMethod !== "split" && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => setPaidNow(true)} className="pay-pill" style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${paidNow ? "#3F5B45" : "var(--border)"}`, background: paidNow ? "#22301F" : "transparent", color: paidNow ? "#9FCB8E" : "var(--text-muted)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  {t("paidNowOption")}
                </button>
                <button onClick={() => setPaidNow(false)} className="pay-pill" style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${!paidNow ? "#5B4F3F" : "var(--border)"}`, background: !paidNow ? "#33301F" : "transparent", color: !paidNow ? "#E3C98A" : "var(--text-muted)", fontSize: 12, fontWeight: 500, cursor: "pointer" }} title={t("payLaterHint")}>
                  {t("payLaterOption")}
                </button>
              </div>
            )}

            <button disabled={cart.length === 0} onClick={printKitchenTicketFromCart} title={t("kitchenTicketTooltip")} style={{ width: "100%", marginTop: 10, padding: "9px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: cart.length === 0 ? "#5A5F6A" : "var(--text-muted)", fontSize: 12.5, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.5 : 1 }}>
              {t("kitchenTicketButton")}
            </button>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button disabled={cart.length === 0} onClick={printOrderReceipt} title={t("printReceiptTooltip")} style={{ flex: 1, padding: "13px 0", borderRadius: 8, border: `1px solid ${cart.length === 0 ? "var(--border)" : theme.secondary}`, background: "transparent", color: cart.length === 0 ? "#5A5F6A" : theme.secondaryLight, fontSize: 14, fontWeight: 500, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.5 : 1 }}>
                {t("printReceipt")}
              </button>
              <button disabled={cart.length === 0} onClick={downloadOrderReceipt} title={t("downloadReceiptTooltip")} style={{ padding: "13px 16px", borderRadius: 8, border: `1px solid ${cart.length === 0 ? "var(--border)" : "var(--border)"}`, background: "transparent", color: cart.length === 0 ? "#5A5F6A" : "var(--text-muted)", fontSize: 14, fontWeight: 500, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.5 : 1 }}>
                {t("download")}
              </button>
              <button disabled={cart.length === 0 || savingOrder} onClick={saveOrder} className="save-btn" style={{ flex: 1, padding: "13px 0", borderRadius: 8, border: "none", background: cart.length === 0 || savingOrder ? "#4A2C33" : paidNow ? theme.primary : "#8A6A2E", color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: cart.length === 0 || savingOrder ? "not-allowed" : "pointer", opacity: cart.length === 0 || savingOrder ? 0.6 : 1 }}>
                {savingOrder ? t("saved") : paidNow ? t("saveOrder") : t("saveOrderUnpaid")}
              </button>
            </div>
          </div>
        </div>
      )}

      {addToInvoiceOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }} onClick={() => setAddToInvoiceOpen(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 4 }}>{t("addToExistingInvoiceTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{t("addToExistingInvoiceSubtitle")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {unpaidInvoicesThisMonth.map((r) => (
                <button
                  key={r.id}
                  disabled={mergingIntoInvoice}
                  onClick={() => addCartToUnpaidInvoice(r.id)}
                  style={{ textAlign: isRtl ? "right" : "left", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: mergingIntoInvoice ? "not-allowed" : "pointer", opacity: mergingIntoInvoice ? 0.6 : 1 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{t("ticketHash", { n: r.ticketNo })}{r.table ? ` · ${r.table}` : ""}</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(r.total)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{r.items.map((it) => `${it.qty}× ${it.name}`).join(", ")}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setAddToInvoiceOpen(false)} style={{ marginTop: 16, width: "100%", padding: "11px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: "pointer" }}>{t("cancel")}</button>
          </div>
        </div>
      )}

      {view === "menu" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 900 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("menuEditorTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("menuEditorSubtitle")}</div>
          </div>

          {hasFeature("menuScan") && (
            <div style={{ background: "var(--surface)", border: `1px dashed ${theme.secondary}`, borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{t("scanMenuButton")}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{t("scanMenuHint")}</div>
              </div>
              <label style={{ fontSize: 12.5, padding: "9px 16px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", fontWeight: 500, flexShrink: 0 }}>
                {t("scanMenuButton")}
                <input type="file" accept="image/*" onChange={(e) => handleMenuScanFile(e.target.files?.[0])} style={{ display: "none" }} />
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder={t("newCategoryPlaceholder")} className="field" style={{ flex: 1 }} />
            <button onClick={addCategory} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addCategory")}</button>
          </div>

          <div style={{ marginBottom: 30, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 3 }}>{t("mainCategoriesTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{t("mainCategoriesSubtitle")}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: mainCategories.length ? 14 : 0, flexWrap: "wrap" }}>
              <input type="text" value={newMainName} onChange={(e) => setNewMainName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMainCategory(); }} placeholder={t("newMainPlaceholder")} className="field" style={{ flex: 1, minWidth: 180 }} />
              <button onClick={addMainCategory} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>{t("addMainCategory")}</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mainCategories.map((m, mi) => (
                <div key={m.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input type="text" value={m.name} onChange={(e) => renameMainCategory(m.id, e.target.value)} className="field" style={{ flex: 1, minWidth: 140, fontWeight: 500 }} />
                    <button disabled={mi === 0} onClick={() => setMainCategories((prev) => moveMain(prev, m.id, -1))} title={t("moveCategoryUp")} aria-label={t("moveCategoryUp")} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: mi === 0 ? "default" : "pointer", opacity: mi === 0 ? 0.35 : 1, fontSize: 11, padding: 0 }}>▲</button>
                    <button disabled={mi === mainCategories.length - 1} onClick={() => setMainCategories((prev) => moveMain(prev, m.id, 1))} title={t("moveCategoryDown")} aria-label={t("moveCategoryDown")} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: mi === mainCategories.length - 1 ? "default" : "pointer", opacity: mi === mainCategories.length - 1 ? 0.35 : 1, fontSize: 11, padding: 0 }}>▼</button>
                    <button onClick={() => deleteMainCategory(m)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("delete")}</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                    {m.subs.filter((c) => categories.includes(c)).map((c) => (
                      <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 6px 4px 10px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)" }}>
                        {c}
                        <button onClick={() => setMainCategories((prev) => removeSubFromMain(prev, m.id, c))} aria-label={t("remove")} style={{ background: "none", border: "none", color: "#E3A79C", cursor: "pointer", fontSize: 13, padding: "0 4px" }}>×</button>
                      </span>
                    ))}
                    {categories.some((c) => !m.subs.includes(c)) && (
                      <select value="" onChange={(e) => { if (e.target.value) setMainCategories((prev) => addSubToMain(prev, m.id, e.target.value)); }} className="field" style={{ fontSize: 12, padding: "5px 8px" }}>
                        <option value="">{t("mainAddCategory")}</option>
                        {categories.filter((c) => !m.subs.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 30, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 3 }}>{t("priceListsTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>{t("priceListsSubtitle")}</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createMenuProfile(); }} placeholder={t("newProfileNamePlaceholder")} className="field" style={{ flex: 1, minWidth: 180 }} />
              <button onClick={createMenuProfile} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("createProfile")}</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("profileStartFromLabel")}</span>
              <select value={newProfileSource} onChange={(e) => setNewProfileSource(e.target.value)} className="field" style={{ flex: 1, minWidth: 200 }}>
                <option value="">{t("profileStartEmpty")}</option>
                <option value="main">{t("profileStartMain")}</option>
                {menuProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{t("profileStartCopyOf", { name: p.name })}</option>
                ))}
              </select>
            </div>

            {menuProfiles.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noProfilesYet")}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {menuProfiles.map((p) => (
                <div key={p.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => renameMenuProfile(p.id, e.target.value)}
                      className="field"
                      style={{ flex: 1, minWidth: 140, fontWeight: 500 }}
                    />
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setManagingProfileId(managingProfileId === p.id ? null : p.id)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>
                        {managingProfileId === p.id ? t("closeManage") : t("managePrices")}
                      </button>
                      <button onClick={() => deleteMenuProfile(p)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("delete")}</button>
                    </div>
                  </div>

                  {managingProfileId === p.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                        <input type="text" value={profileCategoryDraft[p.id] || ""} onChange={(e) => setProfileCategoryDraft((d) => ({ ...d, [p.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addProfileCategory(p.id); }} placeholder={t("profileAddCategoryPlaceholder")} className="field" style={{ flex: 1 }} />
                        <button onClick={() => addProfileCategory(p.id)} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>{t("profileAddCategory")}</button>
                      </div>
                      {[...categories, ...(p.extraCategories || []).filter((c) => !categories.includes(c))].map((cat) => {
                        const ownCategory = !categories.includes(cat);
                        return (
                        <div key={cat} style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                              {cat}
                              {ownCategory && <span style={{ marginInlineStart: 8, fontSize: 10, fontWeight: 500, textTransform: "none", letterSpacing: 0, color: theme.secondaryLight, border: `1px solid ${theme.secondary}`, borderRadius: 999, padding: "1px 7px" }}>{t("profileOwnCategoryBadge")}</span>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => openNewItem(cat, p.id)} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>{t("addExtraItem")}</button>
                              {ownCategory && (
                                <>
                                  <button disabled={(p.extraCategories || []).indexOf(cat) === 0} onClick={() => moveProfileCategory(p.id, cat, -1)} title={t("moveCategoryUp")} aria-label={t("moveCategoryUp")} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", opacity: (p.extraCategories || []).indexOf(cat) === 0 ? 0.35 : 1, fontSize: 11, padding: 0 }}>▲</button>
                                  <button disabled={(p.extraCategories || []).indexOf(cat) === (p.extraCategories || []).length - 1} onClick={() => moveProfileCategory(p.id, cat, 1)} title={t("moveCategoryDown")} aria-label={t("moveCategoryDown")} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", opacity: (p.extraCategories || []).indexOf(cat) === (p.extraCategories || []).length - 1 ? 0.35 : 1, fontSize: 11, padding: 0 }}>▼</button>
                                </>
                              )}
                              {ownCategory && <button onClick={() => deleteProfileCategory(p.id, cat)} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("profileDeleteCategory")}</button>}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {(menu[cat] || []).map((item) => {
                              const removed = (p.hiddenItems || []).includes(item.id);
                              return (
                                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, opacity: removed ? 0.55 : 1, flexWrap: "wrap" }}>
                                  <MenuThumb item={item} size={28} />
                                  <span style={{ flex: 1, minWidth: 120 }}>
                                    {item.name}
                                    {removed && <span style={{ marginInlineStart: 8, fontSize: 10.5, color: "#E3A79C" }}>{t("profileItemRemovedBadge")}</span>}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "IBM Plex Mono, monospace" }}>{t("baseLabel")} {money(item.price)}</span>
                                  {removed ? (
                                    <button onClick={() => restoreItemInProfile(p.id, item)} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>{t("profileRestoreItem")}</button>
                                  ) : (
                                    <>
                                      <input
                                        type="number"
                                        value={p.priceOverrides[item.id] !== undefined ? p.priceOverrides[item.id] : ""}
                                        onChange={(e) => setProfilePriceOverride(p.id, item.id, e.target.value)}
                                        placeholder={String(item.price)}
                                        className="field"
                                        style={{ width: 80 }}
                                      />
                                      <button onClick={() => removeItemFromProfile(p.id, item)} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("profileRemoveItem")}</button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                            {((p.extraItems || {})[cat] || []).map((item) => (
                              <div key={item.id} style={{ fontSize: 12.5, background: "var(--surface)", borderRadius: 6, padding: "6px 8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  <MenuThumb item={item} size={28} />
                                  <span style={{ flex: 1, minWidth: 120 }}>{item.name} <span style={{ fontSize: 10.5, color: theme.secondaryLight }}>{t("extraLabel")}</span></span>
                                  <span style={{ fontSize: 11.5, fontFamily: "IBM Plex Mono, monospace", color: theme.secondary }}>{money(item.price)}</span>
                                  <button
                                    onClick={() => setItemManualOut(item, !manualOutOfStock[item.id])}
                                    style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid ${manualOutOfStock[item.id] ? "#4E7A47" : "#7A4A42"}`, background: "transparent", color: manualOutOfStock[item.id] ? "#9FCB8E" : "#E3A79C", cursor: "pointer" }}
                                  >
                                    {manualOutOfStock[item.id] ? t("markAvailable") : t("markOutOfStock")}
                                  </button>
                                  <button onClick={() => openEditItem(cat, item, p.id)} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("edit")}</button>
                                  <button onClick={() => deleteMenuItem(cat, item, p.id)} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("delete")}</button>
                                </div>
                                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5, paddingInlineStart: 38 }}>
                                  {(item.recipe || []).length === 0 ? t("noRecipeSet") : item.recipe.map((r) => `${fmtRecipeQty(r.qty, ingredients[r.ingredientId]?.unit)}${ingredients[r.ingredientId]?.unit || ""} ${ingredients[r.ingredientId]?.name || "?"}`).join(", ")}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "Fraunces, serif" }}>{cat}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button disabled={categories.indexOf(cat) === 0} onClick={() => moveCategory(cat, -1)} title={t("moveCategoryUp")} aria-label={t("moveCategoryUp")} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: categories.indexOf(cat) === 0 ? "default" : "pointer", opacity: categories.indexOf(cat) === 0 ? 0.35 : 1, fontSize: 11, padding: 0 }}>▲</button>
                    <button disabled={categories.indexOf(cat) === categories.length - 1} onClick={() => moveCategory(cat, 1)} title={t("moveCategoryDown")} aria-label={t("moveCategoryDown")} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: categories.indexOf(cat) === categories.length - 1 ? "default" : "pointer", opacity: categories.indexOf(cat) === categories.length - 1 ? 0.35 : 1, fontSize: 11, padding: 0 }}>▼</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openNewItem(cat)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>{t("addItem")}</button>
                  <button onClick={() => deleteCategory(cat)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("deleteCategory")}</button>
                </div>
              </div>

              {mainCategories.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{t("categoryUnderLabel")}</span>
                  {mainCategories.filter((m) => m.subs.includes(cat)).map((m) => (
                    <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "3px 6px 3px 10px", borderRadius: 999, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight }}>
                      {m.name}
                      <button onClick={() => setMainCategories((prev) => removeSubFromMain(prev, m.id, cat))} aria-label={t("remove")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 13, padding: "0 3px" }}>×</button>
                    </span>
                  ))}
                  {mainCategories.some((m) => !m.subs.includes(cat)) && (
                    <select value="" onChange={(e) => { if (e.target.value) setMainCategories((prev) => addSubToMain(prev, e.target.value, cat)); }} className="field" style={{ fontSize: 11.5, padding: "3px 8px" }}>
                      <option value="">{t("categoryAddToMain")}</option>
                      {mainCategories.filter((m) => !m.subs.includes(cat)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(menu[cat] || []).map((item) => (
                  <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <MenuThumb item={item} size={40} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name} <span style={{ color: theme.secondary, fontFamily: "IBM Plex Mono, monospace", fontWeight: 400 }}>{money(item.price)}</span></div>
                          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{item.tag}</div>
                          {manualOutOfStock[item.id] && (
                            <span style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: "#3A2A28", color: "#E3A79C", fontWeight: 500 }}>{t("manuallyOutBadge")}</span>
                          )}
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                            {item.recipe.length === 0 ? t("noRecipeSet") : item.recipe.map((r) => `${fmtRecipeQty(r.qty, ingredients[r.ingredientId]?.unit)}${ingredients[r.ingredientId]?.unit || ""} ${ingredients[r.ingredientId]?.name || "?"}`).join(", ")}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => setItemManualOut(item, !manualOutOfStock[item.id])}
                          style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${manualOutOfStock[item.id] ? "#4E7A47" : "#7A4A42"}`, background: "transparent", color: manualOutOfStock[item.id] ? "#9FCB8E" : "#E3A79C", cursor: "pointer" }}
                        >
                          {manualOutOfStock[item.id] ? t("markAvailable") : t("markOutOfStock")}
                        </button>
                        <button onClick={() => openEditItem(cat, item)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("edit")}</button>
                        <button onClick={() => deleteMenuItem(cat, item)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("delete")}</button>
                      </div>
                    </div>
                  </div>
                ))}
                {(menu[cat] || []).length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noItemsYet")}</div>}
              </div>
            </div>
          ))}

          {itemEditor && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>
                  {itemEditor.mode === "new" ? t("addItemToCategory", { category: itemEditor.category }) : t("editItemTitle", { name: itemEditor.name })}
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                  <MenuThumb item={{ name: itemEditor.name || "?", tag: itemEditor.tag, image: itemEditor.image }} size={56} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <label style={{ fontSize: 11.5, padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight, cursor: "pointer" }}>
                        {itemEditor.image ? t("changePhoto") : t("uploadPhoto")}
                        <input type="file" accept="image/*" onChange={(e) => handleItemPhotoFile(e.target.files?.[0])} style={{ display: "none" }} />
                      </label>
                      {itemEditor.image && (
                        <button onClick={() => setItemEditor((p) => ({ ...p, image: null }))} style={{ fontSize: 11.5, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("removePhoto")}</button>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{itemEditor.image ? t("photoUploadedHint") : t("suggestedPhotoHint")}</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <input type="text" value={itemEditor.name} onChange={(e) => setItemEditor((p) => ({ ...p, name: e.target.value }))} placeholder={t("dishNamePlaceholder")} className="field" />
                  <input type="text" value={itemEditor.tag} onChange={(e) => setItemEditor((p) => ({ ...p, tag: e.target.value }))} placeholder={t("shortDescriptionPlaceholder")} className="field" />
                  <input type="number" value={itemEditor.price} onChange={(e) => setItemEditor((p) => ({ ...p, price: e.target.value }))} placeholder={t("pricePlaceholder")} className="field" />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{siteT("itemWebTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>{siteT("itemBadges")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {ITEM_BADGES.map((b) => {
                      const on = (itemEditor.badges || []).includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setItemEditor((p) => ({ ...p, badges: on ? (p.badges || []).filter((x) => x !== b) : [...(p.badges || []), b] }))}
                          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, border: `1px solid ${on ? theme.secondary : "var(--border)"}`, background: on ? "rgba(176,141,87,0.18)" : "transparent", color: on ? theme.secondaryLight : "var(--text-muted)", cursor: "pointer" }}
                        >
                          {siteT(`badge_${b}`)}
                        </button>
                      );
                    })}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!itemEditor.featured} onChange={(e) => setItemEditor((p) => ({ ...p, featured: e.target.checked }))} />
                    {siteT("itemFeatured")}
                  </label>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("recipeLabel")}</div>
                {recipeCopySources().length > 0 && (
                  <select value="" onChange={(e) => copyRecipeFromItem(e.target.value)} className="field" style={{ width: "100%", marginBottom: 10 }}>
                    <option value="">{t("copyRecipeFrom")}</option>
                    {recipeCopySources().map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((it) => (
                          <option key={it.id} value={it.id}>{it.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {itemEditor.recipe.map((r) => (
                    <div key={r.ingredientId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, background: "var(--bg)", borderRadius: 6, padding: "7px 10px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={recipeQtyDrafts[r.ingredientId] ?? fmtRecipeQty(r.qty, ingredients[r.ingredientId]?.unit)}
                          onChange={(e) => editRecipeLineQty(r.ingredientId, e.target.value)}
                          onBlur={() => finishRecipeLineQtyEdit(r.ingredientId)}
                          className="field"
                          style={{ width: 78, padding: "4px 8px", fontSize: 12.5 }}
                        />
                        <span>{ingredients[r.ingredientId]?.unit} &middot; {ingredients[r.ingredientId]?.name}</span>
                      </span>
                      <button onClick={() => removeRecipeLine(r.ingredientId)} style={{ background: "none", border: "none", color: "#E3A79C", cursor: "pointer", fontSize: 13 }}>&times;</button>
                    </div>
                  ))}
                  {itemEditor.recipe.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{t("noIngredientsAdded")}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={recipeSearch}
                    onChange={(e) => { setRecipeSearch(e.target.value); setRecipeDraftIng(""); setRecipeListOpen(true); }}
                    onFocus={() => setRecipeListOpen(true)}
                    onBlur={() => setRecipeListOpen(false)}
                    placeholder={t("searchIngredient")}
                    className="field"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <input
                    ref={recipeQtyInputRef}
                    type="text"
                    inputMode="decimal"
                    value={recipeDraftQty}
                    onChange={(e) => setRecipeDraftQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addRecipeLine(); }}
                    placeholder={t("qtyPlaceholder")}
                    className="field"
                    style={{ width: 82 }}
                  />
                  <button onClick={addRecipeLine} style={{ padding: "9px 12px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", fontSize: 12 }}>{t("add")}</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>{t("recipeQtyHint")}</div>
                {recipeDraftIng && isCountUnit(ingredients[recipeDraftIng]?.unit) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {QUICK_FRACTIONS.map(([value, glyph]) => (
                      <button key={glyph} onClick={() => setRecipeDraftQty(String(Math.round(value * 10000) / 10000))} style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${Math.abs(parseRecipeQty(recipeDraftQty) - value) < 0.0006 ? theme.secondary : "var(--border)"}`, background: Math.abs(parseRecipeQty(recipeDraftQty) - value) < 0.0006 ? "rgba(176,141,87,0.18)" : "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>{glyph}</button>
                    ))}
                  </div>
                )}
                {recipeListOpen && !recipeDraftIng && (
                  <div style={{ marginTop: 6, maxHeight: 190, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 7, background: "var(--bg)" }}>
                    {recipeSearchMatches().length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "9px 12px" }}>{t("noIngredientMatches")}</div>
                    ) : (
                      recipeSearchMatches().map((ing) => (
                        <div
                          key={ing.id}
                          onMouseDown={(e) => { e.preventDefault(); pickRecipeIngredient(ing); }}
                          style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                        >
                          <span>{ing.name} <span style={{ color: "var(--text-faint)" }}>({ing.unit})</span></span>
                          {itemEditor.recipe.some((r) => r.ingredientId === ing.id) && <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{t("inRecipeMark")}</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button onClick={saveItemEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{t("saveItem")}</button>
                  <button onClick={closeItemEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: "pointer" }}>{t("cancel")}</button>
                </div>
              </div>
            </div>
          )}

          {menuScanImage && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>{t("scanMenuModalTitle")}</div>

                <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                  <img src={menuScanImage} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    {menuScanning && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("scanMenuScanning")}</div>}
                    {menuScanError && <div style={{ fontSize: 13, color: "#E3A79C" }}>{menuScanError}</div>}
                    {menuScanResults && !menuScanning && (
                      <div style={{ fontSize: 13, color: theme.secondaryLight }}>{t("scanMenuReviewTitle", { n: menuScanResults.length })}</div>
                    )}
                  </div>
                </div>

                {menuScanResults && !menuScanning && (
                  <>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12 }}>{t("scanMenuReviewHint")}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                      {menuScanResults.map((it, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", borderRadius: 8, padding: "8px 10px", opacity: it.include ? 1 : 0.5 }}>
                          <input type="checkbox" checked={it.include} onChange={(e) => updateMenuScanResult(i, { include: e.target.checked })} style={{ flexShrink: 0, width: 16, height: 16, cursor: "pointer" }} />
                          <input
                            type="text"
                            value={it.category}
                            onChange={(e) => updateMenuScanResult(i, { category: e.target.value })}
                            className="field"
                            style={{ width: 90, fontSize: 11.5, padding: "6px 8px", flexShrink: 0 }}
                          />
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => updateMenuScanResult(i, { name: e.target.value })}
                            className="field"
                            style={{ flex: 1, minWidth: 90, fontSize: 12.5, padding: "6px 8px" }}
                          />
                          <input
                            type="number"
                            value={it.price}
                            onChange={(e) => updateMenuScanResult(i, { price: e.target.value })}
                            className="field"
                            style={{ width: 66, fontSize: 12.5, padding: "6px 8px", flexShrink: 0 }}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  {menuScanResults && !menuScanning ? (
                    <>
                      <button onClick={addScannedItems} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                        {t("scanMenuAddButton", { n: menuScanResults.filter((it) => it.include).length })}
                      </button>
                      <label style={{ flex: 1, textAlign: "center", padding: "11px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
                        {t("scanMenuTryAgain")}
                        <input type="file" accept="image/*" onChange={(e) => handleMenuScanFile(e.target.files?.[0])} style={{ display: "none" }} />
                      </label>
                    </>
                  ) : (
                    <button onClick={closeMenuScan} disabled={menuScanning} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: menuScanning ? "default" : "pointer", opacity: menuScanning ? 0.6 : 1 }}>
                      {t("cancel")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "stock" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 780 }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("stockTitle")}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("stockSubtitle")}</div>
            </div>
            {isManager && (
              <button onClick={() => setStockImportOpen(true)} style={{ padding: "9px 16px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                {isRtl ? "استيراد من إكسل" : "Import from Excel"}
              </button>
            )}
          </div>
          {stockImportOpen && isManager && <StockImportModal isRtl={isRtl} theme={theme} ingredients={ingredients} onApply={applyStockImport} onClose={() => setStockImportOpen(false)} />}

          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <input type="text" value={newIngName} onChange={(e) => setNewIngName(e.target.value)} placeholder={t("newIngredientPlaceholder")} className="field" style={{ flex: 2, minWidth: 160 }} />
            <select value={newIngUnit} onChange={(e) => setNewIngUnit(e.target.value)} className="field" style={{ flex: 1, minWidth: 100 }}>
              {UNIT_GROUPS.map((group) => (
                <optgroup key={group.label} label={t(`unitGroup_${group.label}`)}>
                  {group.units.map((u) => <option key={u} value={u}>{u}</option>)}
                </optgroup>
              ))}
              <option value="custom">{t("otherUnit")}</option>
            </select>
            {newIngUnit === "custom" && (
              <input type="text" value={newIngUnitCustom} onChange={(e) => setNewIngUnitCustom(e.target.value)} placeholder={t("customUnitPlaceholder")} className="field" style={{ flex: 1, minWidth: 100 }} />
            )}
            <input type="number" step="any" inputMode="decimal" value={newIngStock} onChange={(e) => setNewIngStock(e.target.value)} placeholder={t("startingStockPlaceholder")} className="field" style={{ flex: 1, minWidth: 110 }} />
            <button onClick={addIngredient} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("add")}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: -12, marginBottom: 20 }}>
            {t("unitHint")}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.values(ingredients).sort((a, b) => a.name.localeCompare(b.name)).map((ing) => {
              const out = ing.stock === 0;
              const low = ing.stock > 0 && ing.stock <= 2;
              const tagColor = out ? { bg: "#3A2A28", fg: "#E3A79C", text: t("outOfStock") } : low ? { bg: "#3A331F", fg: "#E3C98A", text: t("low") } : { bg: "#22301F", fg: "#9FCB8E", text: t("inStock") };
              return (
                <div key={ing.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                      {initials(ing.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{ing.name}</div>
                      <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: tagColor.bg, color: tagColor.fg, fontWeight: 500 }}>{tagColor.text} &middot; {fmtStock(ing.stock, ing.unit)} {ing.unit}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isManager && (
                      <button onClick={() => updateIngredientStock(ing.id, -1)} title={t("stockDecreaseTooltip")} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 14 }}>&minus;</button>
                    )}
                    {isManager ? (
                      <input className="stock-input" type="number" step="any" inputMode="decimal" value={ing.stock} onChange={(e) => setIngredientStockValue(ing.id, e.target.value)} onBlur={(e) => commitIngredientStockValue(ing.id, e.target.value)} style={{ width: 64, textAlign: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontFamily: "IBM Plex Mono, monospace", fontSize: 13, padding: "5px 0" }} />
                    ) : (
                      <span style={{ width: 64, textAlign: "center", color: "var(--text-primary)", fontFamily: "IBM Plex Mono, monospace", fontSize: 13, padding: "5px 0" }}>{fmtStock(ing.stock, ing.unit)}</span>
                    )}
                    <button onClick={() => updateIngredientStock(ing.id, 1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 14 }}>+</button>
                    <input
                      type="number"
                      value={restockAmounts[ing.id] ?? ""}
                      onChange={(e) => setRestockAmounts((prev) => ({ ...prev, [ing.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") applyBulkRestock(ing.id); }}
                      placeholder={t("restockAmountPlaceholder")}
                      title={t("restockAmountTooltip")}
                      style={{ width: 56, textAlign: "center", background: "transparent", border: `1px solid ${theme.secondary}`, borderRadius: 6, color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace", fontSize: 12, padding: "5px 2px" }}
                    />
                    <button onClick={() => applyBulkRestock(ing.id)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", fontSize: 11.5, fontWeight: 500 }}>{t("restockBulk")}</button>
                    {isManager && (
                      <button onClick={() => deleteIngredient(ing.id)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer", fontSize: 11.5 }}>{t("delete")}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "receipts" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 820 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("receiptsTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("receiptsSubtitle")}</div>
          </div>

          {!monthsLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loadingHistory")}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setReceiptsFilterMode("month")}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${receiptsFilterMode === "month" ? theme.secondary : "var(--border)"}`, background: receiptsFilterMode === "month" ? "rgba(176,141,87,0.18)" : "transparent", color: receiptsFilterMode === "month" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("dashboardModeMonth")}
                  </button>
                  <button
                    onClick={() => setReceiptsFilterMode("day")}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${receiptsFilterMode === "day" ? theme.secondary : "var(--border)"}`, background: receiptsFilterMode === "day" ? "rgba(176,141,87,0.18)" : "transparent", color: receiptsFilterMode === "day" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("dashboardModeDay")}
                  </button>
                  <button
                    onClick={() => setReceiptsFilterMode("range")}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${receiptsFilterMode === "range" ? theme.secondary : "var(--border)"}`, background: receiptsFilterMode === "range" ? "rgba(176,141,87,0.18)" : "transparent", color: receiptsFilterMode === "range" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("dashboardModeRange")}
                  </button>
                </div>
                {receiptsFilterMode === "month" ? (
                  <select value={currentMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="field">
                    {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </select>
                ) : receiptsFilterMode === "day" ? (
                  <DayPickerButton value={effectiveReceiptsDay} maxDate={todayLocalStr()} isRtl={isRtl} theme={theme} onChange={setReceiptsFilterDay} />
                ) : (
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => {
                        setReceiptsRangePickingEnd(false);
                        setReceiptsRangePickerOpen((v) => !v);
                      }}
                      className="field"
                      style={{ colorScheme: "dark", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
                    >
                      📅 {formatShortDate(effectiveReceiptsRangeStart, isRtl)} – {formatShortDate(effectiveReceiptsRangeEnd, isRtl)}
                    </button>
                    {receiptsRangePickerOpen && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setReceiptsRangePickerOpen(false)}>
                          <DateRangeCalendar
                            startDate={effectiveReceiptsRangeStart}
                            endDate={effectiveReceiptsRangeEnd}
                            maxDate={todayLocalStr()}
                            isRtl={isRtl}
                            theme={theme}
                            onPickDay={handleReceiptsRangeDayClick}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-muted)" }}>
                  <span>{tCount("orderCount", filteredReceipts.filter((r) => r.status === "completed").length)}</span>
                  <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{money(receiptsListRevenue)}</span>
                </div>
              </div>
              {receiptsListUnpaid.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -8, marginBottom: 18, fontSize: 12.5, color: "#F0D9A0" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#F0D9A0", display: "inline-block" }} />
                  {t("unpaidSummary", { n: receiptsListUnpaid.length, amount: money(receiptsListUnpaidTotal) })}
                </div>
              )}

              {!receiptsDataLoaded ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{receiptsFilterMode === "month" ? t("loadingMonth", { month: monthLabel(currentMonth) }) : t("loading")}</div>
              ) : filteredReceipts.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{receiptsFilterMode === "month" ? t("noSavedOrdersForMonth", { month: monthLabel(currentMonth) }) : t("noSavedOrdersForPeriod")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredReceipts.map((r) => {
                    const cancelled = r.status === "cancelled";
                    const refunded = r.status === "refunded";
                    const voided = cancelled || refunded;
                    const unpaid = !voided && r.paid === false;
                    const editing = editingReceiptId === r.id;
                    return (
                      <div key={r.id} style={{ background: "var(--surface)", border: `1px solid ${voided ? "#4A2E2C" : unpaid ? "#5B4F3F" : "var(--border)"}`, borderRadius: 10, padding: "14px 18px", opacity: voided ? 0.7 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}>
                            {t("ticketHash", { n: r.ticketNo })} &middot; {new Date(r.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            {r.table && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2A2E3A", color: "#9CB0E3" }}>{r.table}</span>}
                            {/* A waiter assigned from the duty roster is who actually served the table — show them
                                here instead of whichever login rang it up, so this doesn't duplicate the separate
                                "Waiter: X" badge below. Delivery stays as its own badge since it's not "who served it". */}
                            {(r.assignedTo?.role === "waiter" ? r.assignedTo.name : r.servedBy?.name) && (
                              <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2A3A2E", color: "#9CE3B0" }}>
                                {t("servedByLabel", { name: r.assignedTo?.role === "waiter" ? r.assignedTo.name : r.servedBy.name })}
                              </span>
                            )}
                            {r.assignedTo?.name && r.assignedTo.role !== "waiter" && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3" }}>{t("assignedToBadge", { role: t("roleDelivery"), name: r.assignedTo.name })}</span>}
                            {r.paymentMethod && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--track)", color: "var(--text-muted)" }}>{t(`payment_${r.paymentMethod}`)}</span>}
                            {cancelled && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#33301F", color: "#E3C98A" }}>{t("cancelledBadge")}</span>}
                            {refunded && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#3A2A28", color: "#E3A79C" }}>{t("refundedBadge")}</span>}
                            {unpaid && <span title={t("unpaidOrderTooltip")} style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#5B4F3F", color: "#F0D9A0", fontWeight: 700 }}>{t("unpaidBadge")}</span>}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: voided ? "var(--text-faint)" : theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace", textDecoration: voided ? "line-through" : "none" }}>{money(r.total)}</span>
                        </div>
                        {r.splitCount > 1 && (
                          <div style={{ fontSize: 11, color: theme.secondaryLight, marginBottom: 6 }}>{t("splitLabel", { n: r.splitCount })} &middot; {t("eachPays", { amount: money(r.total / r.splitCount) })}</div>
                        )}
                        {r.discount?.reason && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("discountReasonLabel", { reason: r.discount.reason })}</div>
                        )}
                        {voided && Array.isArray(r.returnedAmounts) && r.returnedAmounts.length > 0 && (
                          <div style={{ fontSize: 11, color: "#E3C98A", marginBottom: 6 }}>{t("returnedViaLabel", { methods: r.returnedAmounts.map((a) => `${t(`payment_${a.method}`)} ${money(a.amount)}`).join(" + ") })}</div>
                        )}
                        {r.paymentMethod === "split" && Array.isArray(r.splitPayments) && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                            {r.splitPayments.map((sp, i) => (
                              <span key={sp.method}>
                                {t(`payment_${sp.method}`)} {money(sp.amount)}{i < r.splitPayments.length - 1 ? " + " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.customer && (r.customer.name || r.customer.phone) && (
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
                            {r.customer.name}{r.customer.name && r.customer.phone ? " · " : ""}{r.customer.phone}{r.customer.address ? ` · ${r.customer.address}` : ""}
                          </div>
                        )}

                        {!voided && r.customer?.phone && hasFeature("whatsappUpdates") && (
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{t("statusColon")}</span>
                            {FULFILLMENT_STATUSES.map((s) => {
                              const isCurrent = (r.fulfillmentStatus || "placed") === s.id;
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => updateFulfillmentStatus(r, s.id)}
                                  disabled={isCurrent}
                                  title={s.whatsapp ? t("whatsappStatusTooltip") : undefined}
                                  style={{
                                    fontSize: 11,
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    border: `1px solid ${isCurrent ? theme.secondary : "var(--border)"}`,
                                    background: isCurrent ? "rgba(176,141,87,0.18)" : "transparent",
                                    color: isCurrent ? theme.secondaryLight : "var(--text-muted)",
                                    cursor: isCurrent ? "default" : "pointer",
                                    fontWeight: isCurrent ? 600 : 400,
                                  }}
                                >
                                  {t(`status_${s.id}`)}{s.whatsapp ? " 💬" : ""}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {(r.whatsappLog || r.smsLog) && (r.whatsappLog || r.smsLog).length > 0 && (
                          <div style={{ fontSize: 10.5, color: "#7C8A6E", marginBottom: 10 }}>
                            {(r.whatsappLog || r.smsLog).map((log, i) => (
                              <div key={i}>
                                {t("whatsappLogLine", {
                                  sentOrOpened: log.silent ? t("whatsappSent") : t("whatsappChatOpened"),
                                  status: t(`status_${log.status}`),
                                  time: new Date(log.sentAt).toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" }),
                                })}
                              </div>
                            ))}
                          </div>
                        )}

                        {!editing ? (
                          <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: voided ? 0 : 10 }}>
                            {r.items.map((it, idx) => (
                              <span key={idx}>
                                {it.qty}&times; {it.name}
                                {it.note && <em style={{ color: "#7C8A6E" }}> ({it.note})</em>}
                                {idx < r.items.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ marginBottom: 10 }}>
                            {editDraftItems.map((it, index) => (
                              <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
                                <span>{it.name}{it.note && <em style={{ color: "#7C8A6E", fontSize: 11 }}> ({it.note})</em>}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <button onClick={() => changeEditQty(index, -1, r.items[index]?.qty)} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>−</button>
                                  <span style={{ fontFamily: "IBM Plex Mono, monospace", minWidth: 14, textAlign: "center" }}>{it.qty}</span>
                                  <button onClick={() => changeEditQty(index, 1, r.items[index]?.qty)} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>+</button>
                                </div>
                              </div>
                            ))}
                            {hasFeature("discounts") && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 5 }}>{t("editDiscountTitle")}</div>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                  <select value={editDraftDiscount.type} onChange={(e) => setEditDraftDiscount((d) => ({ ...d, type: e.target.value }))} className="field" style={{ fontSize: 12, padding: "5px 6px" }}>
                                    <option value="percent">%</option>
                                    <option value="fixed">EGP</option>
                                  </select>
                                  <input type="number" min="0" value={editDraftDiscount.value} onChange={(e) => setEditDraftDiscount((d) => ({ ...d, value: e.target.value }))} placeholder={t("editDiscountValuePlaceholder")} className="field" style={{ width: 110, fontSize: 12, padding: "5px 8px" }} />
                                  {String(editDraftDiscount.value).trim() !== "" && (
                                    <button onClick={() => setEditDraftDiscount((d) => ({ ...d, value: "", reason: "" }))} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("editDiscountRemove")}</button>
                                  )}
                                </div>
                                {String(editDraftDiscount.value).trim() !== "" && (
                                  <input type="text" value={editDraftDiscount.reason || ""} onChange={(e) => setEditDraftDiscount((d) => ({ ...d, reason: e.target.value }))} placeholder={t("discountReasonPlaceholder")} maxLength={120} className="field" style={{ width: "100%", fontSize: 12, marginTop: 6 }} />
                                )}
                                <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 4 }}>{t("editDiscountHint")}</div>
                                {(() => {
                                  const v = Number(editDraftDiscount.value);
                                  const preview = editedBillFor(r, editDraftItems, v > 0 ? { type: editDraftDiscount.type, value: v } : null);
                                  return Math.abs(preview.total - r.total) >= 0.005 ? (
                                    <div style={{ fontSize: 11.5, color: theme.secondaryLight, marginTop: 6, fontFamily: "IBM Plex Mono, monospace" }}>{t("editNewTotal", { new: money(preview.total), old: money(r.total) })}</div>
                                  ) : null;
                                })()}
                              </div>
                            )}
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 5 }}>{t("paymentMethodEditLabel")}</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {PAYMENT_METHODS.map((m) => {
                                  const isCurrent = editPaymentMethod === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      onClick={() => setEditPaymentMethod(m.id)}
                                      style={{
                                        fontSize: 11.5,
                                        padding: "5px 10px",
                                        borderRadius: 999,
                                        border: `1px solid ${isCurrent ? theme.secondary : "var(--border)"}`,
                                        background: isCurrent ? "rgba(176,141,87,0.18)" : "transparent",
                                        color: isCurrent ? theme.secondaryLight : "var(--text-muted)",
                                        cursor: "pointer",
                                        fontWeight: isCurrent ? 600 : 400,
                                      }}
                                    >
                                      {t(`payment_${m.id}`)}
                                    </button>
                                  );
                                })}
                              </div>
                              {r.paymentMethod === "split" && (
                                <div style={{ fontSize: 10.5, color: "#E3C98A", marginTop: 5 }}>{t("paymentMethodEditSplitNote")}</div>
                              )}
                            </div>
                            <textarea
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder={t("editReasonPlaceholder")}
                              className="field"
                              rows={2}
                              style={{ width: "100%", resize: "vertical", fontSize: 12, marginTop: 4 }}
                            />
                            <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>{t("editReasonLabel")}</div>
                          </div>
                        )}

                        {!editing && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: voided ? 0 : 8 }}>
                            <button onClick={() => printSavedReceipt(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("printReceipt")}</button>
                            <button onClick={() => printKitchenTicket(kitchenTicketFromReceipt(r))} title={t("kitchenTicketTooltip")} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("kitchenTicketButton")}</button>
                          </div>
                        )}

                        {!voided && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {editing ? (
                              <>
                                <button onClick={() => saveEditReceipt(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "none", background: theme.primary, color: "#FBF8F2", cursor: "pointer", fontWeight: 500 }}>{t("saveChanges")}</button>
                                <button onClick={cancelEditReceipt} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("cancelEdit")}</button>
                              </>
                            ) : (
                              <>
                                {unpaid && (
                                  <button onClick={() => markReceiptPaid(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "none", background: "#8A6A2E", color: "#FBF8F2", cursor: "pointer", fontWeight: 600 }}>{t("markOrderPaid")}</button>
                                )}
                                <button onClick={() => startEditReceipt(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("edit")}</button>
                                <button onClick={() => cancelReceipt(r)} title={t("cancelOrderTooltip")} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #C9A24A", background: "transparent", color: "#E3C98A", cursor: "pointer" }}>{t("cancelOrder")}</button>
                                <button onClick={() => refundReceipt(r)} title={t("refundOrderTooltip")} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("refundOrder")}</button>
                              </>
                            )}
                          </div>
                        )}

                        {!voided && isManager && hasFeature("teamTracking") && dutyRoster.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{t("reassignLabel")}</span>
                            <select
                              value={r.assignedTo?.id || ""}
                              onChange={(e) => assignReceiptTo(r, dutyRoster.find((m) => m.id === e.target.value) || null)}
                              className="field"
                              style={{ fontSize: 11.5, padding: "4px 6px" }}
                            >
                              <option value="">{t("assignedToNone")}</option>
                              {r.tableId !== "delivery" && dutyRoster.filter((m) => m.role === "waiter").length > 0 && (
                                <optgroup label={t("roleWaiter")}>
                                  {dutyRoster.filter((m) => m.role === "waiter").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </optgroup>
                              )}
                              {dutyRoster.filter((m) => m.role === "delivery").length > 0 && (
                                <optgroup label={t("roleDelivery")}>
                                  {dutyRoster.filter((m) => m.role === "delivery").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </optgroup>
                              )}
                            </select>
                          </div>
                        )}

                        {isManager && r.editHistory && r.editHistory.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={() => setExpandedHistoryId(expandedHistoryId === r.id ? null : r.id)}
                              style={{ fontSize: 11, color: theme.secondaryLight, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "IBM Plex Mono, monospace" }}
                            >
                              {expandedHistoryId === r.id ? t("hideEditHistory") : t("viewEditHistory", { n: r.editHistory.length })}
                            </button>
                            {expandedHistoryId === r.id && (
                              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                                {r.editHistory.map((h, i) => (
                                  <div key={i} style={{ fontSize: 11, background: "#20242C", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                                    <div style={{ color: "var(--text-muted)", marginBottom: 3 }}>
                                      {t("editHistoryEntry", {
                                        name: h.editedBy?.name || t("editHistoryUnknownEditor"),
                                        time: new Date(h.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
                                      })}
                                    </div>
                                    <div style={{ color: "#7C8A6E", fontStyle: "italic", marginBottom: h.changes?.length ? 4 : 0 }}>
                                      {h.reason || t("editHistoryNoReason")}
                                    </div>
                                    {(h.changes || []).map((c, ci) => (
                                      <div key={ci} style={{ color: "var(--text-faint)", fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5 }}>
                                        {t("editHistoryChange", { item: c.name, from: c.from, to: c.to })}{c.detail ? ` (${c.detail})` : ""}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "expenses" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 900 }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("expensesTitle")}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("expensesSubtitle")}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSupplierManager(true)} style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>{t("manageSuppliers")}</button>
              <button onClick={openNewExpense} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addExpense")}</button>
            </div>
          </div>

          <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["month", "dashboardModeMonth"], ["day", "dashboardModeDay"], ["range", "dashboardModeRange"]].map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setExpenseFilterMode(mode)}
                      style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${expenseFilterMode === mode ? theme.secondary : "var(--border)"}`, background: expenseFilterMode === mode ? "rgba(176,141,87,0.18)" : "transparent", color: expenseFilterMode === mode ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                {expenseFilterMode === "month" ? (
                  <select value={currentExpenseMonth} onChange={(e) => setSelectedExpenseMonth(e.target.value)} className="field">
                    {availableExpenseMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </select>
                ) : expenseFilterMode === "day" ? (
                  <DayPickerButton value={effectiveExpenseDay} maxDate={todayLocalStr()} isRtl={isRtl} theme={theme} onChange={setExpenseFilterDay} />
                ) : (
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => {
                        setExpenseRangePickingEnd(false);
                        setExpenseRangePickerOpen((v) => !v);
                      }}
                      className="field"
                      style={{ colorScheme: "dark", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
                    >
                      📅 {formatShortDate(effectiveExpenseRangeStart, isRtl)} – {formatShortDate(effectiveExpenseRangeEnd, isRtl)}
                    </button>
                    {expenseRangePickerOpen && (
                      <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setExpenseRangePickerOpen(false)}>
                        <DateRangeCalendar
                          startDate={effectiveExpenseRangeStart}
                          endDate={effectiveExpenseRangeEnd}
                          maxDate={todayLocalStr()}
                          isRtl={isRtl}
                          theme={theme}
                          onPickDay={handleExpenseRangeDayClick}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t(expenseFilterMode === "month" ? "totalExpensesLabel" : "totalExpensesPeriodLabel")}</div>
                  <div style={{ fontSize: 22, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(expenseTotalThisMonth)}</div>
                </div>
                <div style={{ background: "var(--surface)", border: `1px solid ${outstandingTotal > 0 ? "#C9A24A" : "var(--border)"}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("outstandingPayables")}</div>
                  <div style={{ fontSize: 22, fontFamily: "IBM Plex Mono, monospace", color: outstandingTotal > 0 ? "#E3C98A" : theme.secondaryLight }}>{money(outstandingTotal)}</div>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{t("byCategory")}</div>
                  {expenseByCategory.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>—</div>
                  ) : (
                    expenseByCategory.map((c) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                        <span style={{ color: "var(--text-muted)" }}>{t(`category_${c.id}`)}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(c.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {loadingExpenseMonth || !expensePeriodLoaded ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loadingExpenses")}</div>
              ) : monthExpenses.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{expenseFilterMode === "month" ? t("noExpensesForMonth", { month: monthLabel(currentExpenseMonth) }) : t("noExpensesForPeriod")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {monthExpenses.map((e) => (
                    <div key={e.id} style={{ background: "var(--surface)", border: `1px solid ${e.status === "unpaid" ? "#C9A24A" : "var(--border)"}`, borderRadius: 10, padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                            {e.supplierName || t("noSupplierOption")}
                            <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--track)", color: "var(--text-muted)" }}>{t(`category_${e.category}`)}</span>
                            {e.status === "unpaid" && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#33301F", color: "#E3C98A" }}>{t("statusUnpaid")}</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>
                            {new Date(e.date).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {e.paymentMethod && ` · ${t(`payment_${e.paymentMethod}`)}`}
                            {e.recordedBy?.name && ` · ${t("recordedByLabel", { name: e.recordedBy.name })}`}
                          </div>
                          {e.note && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3, fontStyle: "italic" }}>{e.note}</div>}
                        </div>
                        <div style={{ fontSize: 15, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight, flexShrink: 0 }}>{money(e.amount)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {e.status === "unpaid" && (
                          <button onClick={() => markExpensePaid(e.date.slice(0, 7), e)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>{t("markAsPaid")}</button>
                        )}
                        <button onClick={() => openEditExpense(e.date.slice(0, 7), e)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("edit")}</button>
                        <button onClick={() => deleteExpense(e.date.slice(0, 7), e)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("deleteExpense")}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
        </div>
      )}

      {showSupplierManager && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }} onClick={() => setShowSupplierManager(false)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>{t("manageSuppliers")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder={t("supplierName")} className="field" />
              <select value={newSupplierCategory} onChange={(e) => setNewSupplierCategory(e.target.value)} className="field">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category_${c}`)}</option>)}
              </select>
              <input type="tel" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder={t("supplierPhone")} className="field" />
              <button onClick={addSupplierRecord} style={{ padding: "9px 0", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addSupplier")}</button>
            </div>
            {!suppliersLoaded ? (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("loading")}</div>
            ) : suppliers.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noSuppliersYet")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {suppliers.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", borderRadius: 8, padding: "8px 12px" }}>
                    <div>
                      <div style={{ fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{t(`category_${s.category}`)}{s.phone ? ` · ${s.phone}` : ""}</div>
                    </div>
                    <button onClick={() => removeSupplierRecord(s)} style={{ fontSize: 11, color: "#E3A79C", background: "none", border: "none", cursor: "pointer" }}>{t("removeSupplier")}</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowSupplierManager(false)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer", marginTop: 16 }}>{t("close")}</button>
          </div>
        </div>
      )}

      {expenseEditor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }} onClick={closeExpenseEditor}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>
              {expenseEditor.mode === "new" ? t("addExpense") : t("editExpense")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("expenseAmount")}</div>
                <input type="number" value={expenseEditor.amount} onChange={(e) => setExpenseEditor((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("expenseDate")}</div>
                <input type="date" value={expenseEditor.date} onChange={(e) => setExpenseEditor((p) => ({ ...p, date: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("expenseCategory")}</div>
                <select value={expenseEditor.category} onChange={(e) => setExpenseEditor((p) => ({ ...p, category: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category_${c}`)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("expenseSupplier")}</div>
                <select value={expenseEditor.supplierId} onChange={(e) => setExpenseEditor((p) => ({ ...p, supplierId: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }}>
                  <option value="">{t("noSupplierOption")}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("paymentStatus")}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["paid", "unpaid"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setExpenseEditor((p) => ({ ...p, status: s }))}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${expenseEditor.status === s ? theme.secondary : "var(--border)"}`, background: expenseEditor.status === s ? "rgba(176,141,87,0.18)" : "transparent", color: expenseEditor.status === s ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}
                    >
                      {s === "paid" ? t("statusPaid") : t("statusUnpaid")}
                    </button>
                  ))}
                </div>
              </div>
              {expenseEditor.status === "paid" && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("paymentStatus")} — {t("statusPaid")}</div>
                  <select value={expenseEditor.paymentMethod} onChange={(e) => setExpenseEditor((p) => ({ ...p, paymentMethod: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }}>
                    {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{t(`payment_${m.id}`)}</option>)}
                  </select>
                </div>
              )}
              {expenseEditor.status === "unpaid" && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("dueDate")}</div>
                  <input type="date" value={expenseEditor.dueDate} onChange={(e) => setExpenseEditor((p) => ({ ...p, dueDate: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{t("expenseNote")}</div>
                <input type="text" value={expenseEditor.note} onChange={(e) => setExpenseEditor((p) => ({ ...p, note: e.target.value }))} placeholder={t("expenseNotePlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveExpenseEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{t("saveChanges")}</button>
              <button onClick={closeExpenseEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: "pointer" }}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {view === "dashboard" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 1000 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("dashboardTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("dashboardSubtitle")}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setDashboardMode("month")}
                style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${dashboardMode === "month" ? theme.secondary : "var(--border)"}`, background: dashboardMode === "month" ? "rgba(176,141,87,0.18)" : "transparent", color: dashboardMode === "month" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
              >
                {t("dashboardModeMonth")}
              </button>
              <button
                onClick={() => setDashboardMode("day")}
                style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${dashboardMode === "day" ? theme.secondary : "var(--border)"}`, background: dashboardMode === "day" ? "rgba(176,141,87,0.18)" : "transparent", color: dashboardMode === "day" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
              >
                {t("dashboardModeDay")}
              </button>
              <button
                onClick={() => setDashboardMode("range")}
                style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${dashboardMode === "range" ? theme.secondary : "var(--border)"}`, background: dashboardMode === "range" ? "rgba(176,141,87,0.18)" : "transparent", color: dashboardMode === "range" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
              >
                {t("dashboardModeRange")}
              </button>
            </div>
            {dashboardMode === "month" ? (
              <MonthSelects value={effectiveDashboardMonth} maxMonth={monthLocalKey()} isRtl={isRtl} onChange={setDashboardMonth} />
            ) : dashboardMode === "day" ? (
              <DayPickerButton value={effectiveDashboardDay} maxDate={todayLocalStr()} isRtl={isRtl} theme={theme} onChange={setDashboardDay} />
            ) : (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setDashboardRangePickingEnd(false);
                    setDashboardRangePickerOpen((v) => !v);
                  }}
                  className="field"
                  style={{ colorScheme: "dark", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
                >
                  📅 {formatShortDate(effectiveDashboardRangeStart, isRtl)} – {formatShortDate(effectiveDashboardRangeEnd, isRtl)}
                </button>
                {dashboardRangePickerOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setDashboardRangePickerOpen(false)}>
                      <DateRangeCalendar
                        startDate={effectiveDashboardRangeStart}
                        endDate={effectiveDashboardRangeEnd}
                        maxDate={todayLocalStr()}
                        isRtl={isRtl}
                        theme={theme}
                        onPickDay={handleDashboardRangeDayClick}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {!dashboardMonthDataLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : (
          <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              {
                label: t("periodRevenueLabel"),
                value: money(dashboardPeriodRevenue),
                hint: periodVsPreviousPct === null ? null : t("vsPreviousDayChange", { pct: periodVsPreviousPct > 0 ? `+${periodVsPreviousPct}` : periodVsPreviousPct }),
                hintColor: periodVsPreviousPct >= 0 ? "#9FCB8E" : "#E3A79C",
              },
              { label: t("periodOrdersLabel"), value: String(dashboardPeriodOrders) },
              { label: t("avgOrderValueLabel"), value: money(avgOrderValue) },
              { label: t("expensesLabel"), value: money(dashboardExpenseTotal), accent: dashboardExpenseTotal > 0 ? "#E3A79C" : undefined },
              {
                label: t("netProfitLabel"),
                value: money(netProfit),
                accent: netProfit >= 0 ? "#9FCB8E" : "#E3A79C",
                hint: t("netProfitHintDetailed", { revenue: money(dashboardPeriodRevenue), expenses: money(dashboardExpenseTotal) }),
              },
              { label: t("discountsGivenLabel"), value: money(dashboardDiscountTotal) },
            ].map((card, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{card.label}</div>
                <div style={{ fontSize: 19, fontFamily: "IBM Plex Mono, monospace", color: card.accent || theme.secondaryLight }}>{card.value}</div>
                {card.hint && <div style={{ fontSize: 9.5, color: card.hintColor || "#6B6F78", marginTop: 4 }}>{card.hint}</div>}
              </div>
            ))}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t(dashboardMode === "day" ? "revenueTrendTitleDay" : dashboardMode === "range" ? "revenueTrendTitleRange" : "revenueTrendTitleMonth")}</div>
              {bestTrendBar.key !== null && bestTrendBar.total > 0 && (
                <div style={{ fontSize: 11.5, color: theme.secondaryLight }}>
                  {dashboardMode === "day"
                    ? t("bestHourLabel", { time: formatHour(bestTrendBar.key), amount: money(bestTrendBar.total) })
                    : dashboardMode === "range"
                    ? t("bestDateLabel", { date: formatShortDate(bestTrendBar.key, isRtl), amount: money(bestTrendBar.total) })
                    : t("bestDayLabel", { day: bestTrendBar.key, amount: money(bestTrendBar.total) })}
                </div>
              )}
            </div>
            {trendBars.every((b) => b.total === 0) ? (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noSalesYetDashboard")}</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: trendBars.length > 20 ? 2 : 4, height: 110 }}>
                  {trendBars.map((b) => (
                    <div key={b.key} title={dashboardMode === "day" ? `${formatHour(b.key)}: ${money(b.total)}` : dashboardMode === "range" ? `${formatShortDate(b.key, isRtl)}: ${money(b.total)}` : `${t("expenseDate")} ${b.key}: ${money(b.total)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ background: b.key === bestTrendBar.key && b.total > 0 ? theme.primary : b.total > 0 ? theme.secondary : "var(--track)", borderRadius: "3px 3px 0 0", height: `${Math.max(2, (b.total / maxTrendValue) * 100)}%`, transition: "height .2s ease" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: trendBars.length > 20 ? 2 : 4, marginTop: 6 }}>
                  {trendBars.map((b, i) => {
                    const interval = dashboardMode === "day" ? 6 : trendBars.length <= 10 ? 1 : trendBars.length <= 20 ? 2 : 5;
                    const showLabel = dashboardMode === "day"
                      ? b.key === 0 || b.key === trendBars.length - 1 || b.key % interval === 0
                      : dashboardMode === "range"
                      ? i === 0 || i === trendBars.length - 1 || i % interval === 0
                      : b.key === 1 || b.key === trendBars.length || b.key % interval === 0;
                    return (
                      <div key={b.key} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#6B6F78", fontFamily: "IBM Plex Mono, monospace" }}>
                        {showLabel ? (dashboardMode === "range" ? formatShortDate(b.key, isRtl) : b.key) : ""}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("topSellersTitle")}</div>
                {dashboardCategoryOptions.length > 0 && (
                  <select value={activeDashboardCategory} onChange={(e) => setDashboardCategory(e.target.value)} aria-label={t("dashCategoryFilter")} className="field" style={{ fontSize: 12.5, padding: "6px 10px", maxWidth: "100%" }}>
                    <option value="">{t("dashAllCategories")}</option>
                    {dashboardCategoryOptions.map((c) => <option key={c} value={c}>{c === OTHER_CATEGORY ? t("dashCategoryOther") : c}</option>)}
                  </select>
                )}
              </div>
              {activeDashboardCategory && (
                <div style={{ fontSize: 12.5, color: theme.secondaryLight, marginBottom: 10 }}>
                  {activeDashboardCategory === OTHER_CATEGORY ? t("dashCategoryOther") : activeDashboardCategory} · {t("unitsSold", { n: topSellersTotalQty })}
                </div>
              )}
              {topSellers.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noSalesYetDashboard")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto", paddingRight: 6 }}>
                  {topSellers.map((s, i) => (
                    <div key={s.name} style={{ opacity: s.qty === 0 ? 0.55 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span>{i + 1}. {s.name}</span>
                        <span style={{ color: "var(--text-faint)" }}>{t("unitsSold", { n: s.qty })}</span>
                      </div>
                      <div style={{ background: "var(--track)", borderRadius: 999, height: 6, overflow: "hidden" }}>
                        <div style={{ background: theme.primary, width: `${(s.qty / maxTopSellerQty) * 100}%`, height: "100%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("paymentMixTitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dashboardByMethod.map((m) => (
                  <div key={m.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span>{t(`payment_${m.id}`)}</span>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(m.total)}</span>
                    </div>
                    <div style={{ background: "var(--track)", borderRadius: 999, height: 6, overflow: "hidden" }}>
                      <div style={{ background: theme.secondary, width: `${(m.total / maxMethodTotal) * 100}%`, height: "100%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("orderSourceTitle")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: t("sourceDineIn"), count: sourceCounts.dineIn },
                { label: t("sourceTakeaway"), count: sourceCounts.takeaway },
                { label: t("sourceOnline"), count: sourceCounts.online },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{s.label}</span>
                    <span style={{ color: "var(--text-faint)" }}>{tCount("orderCount", s.count)}</span>
                  </div>
                  <div style={{ background: "var(--track)", borderRadius: 999, height: 6, overflow: "hidden" }}>
                    <div style={{ background: theme.primary, width: `${(s.count / maxSourceCount) * 100}%`, height: "100%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {view === "customers" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 780 }}>
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("customersTitle")}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("customersSubtitle")}</div>
            </div>
            {isManager && customersLoaded && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setCustomersImportOpen(true)} style={{ padding: "9px 16px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>{t("customersImportBtn")}</button>
                <button disabled={Object.keys(customers).length === 0} onClick={exportCustomers} style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 500, cursor: Object.keys(customers).length === 0 ? "default" : "pointer", opacity: Object.keys(customers).length === 0 ? 0.5 : 1, whiteSpace: "nowrap" }}>{t("customersExportBtn")}</button>
              </div>
            )}
          </div>
          {customersImportOpen && isManager && <CustomersImportModal isRtl={isRtl} theme={theme} customers={customers} onApply={applyCustomersImport} onClose={() => setCustomersImportOpen(false)} />}
          {!customersLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : Object.keys(customers).length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noCustomersSaved")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.values(customers).sort((a, b) => (b.lastOrder || "").localeCompare(a.lastOrder || "")).map((c) => (
                <div key={c.phone} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{c.name || t("unnamedCustomer")}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "IBM Plex Mono, monospace" }}>{c.phone}</div>
                    {c.address && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>{c.address}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{tCount("orderCount", c.orderCount)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>{t("lastOrderDate", { date: c.lastOrder ? new Date(c.lastOrder).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" }) : "—" })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "closeday" && (() => {
        const day = closeDayDate || businessDateForTimestamp(new Date().toISOString(), shiftHoursConfig);
        const cd = buildCloseDay(day);
        const m2 = (n) => money(Math.abs(n));
        const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 18 };
        const h = { fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 10 };
        const num = { fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5, textAlign: "right" };
        const lbl = (id) => t(`payment_${id}`);
        const timeFmt = { hour: "numeric", minute: "2-digit" };
        const dtFmt = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
        const loc = isRtl ? "ar-EG" : "en-US";
        const gapColor = (g) => (g === null ? "var(--text-faint)" : Math.abs(g) < 0.01 ? "#9FCB8E" : "#E3A79C");
        const gapText = (g) => (g === null ? "—" : Math.abs(g) < 0.01 ? t("varianceMatch") : `${g > 0 ? "+" : "-"}${m2(g)}`);
        const gapShifts = cd ? cd.drawers.filter((d) => d.gap !== null && Math.abs(d.gap) >= 0.01 && !d.impliedCollection) : [];
        const handoverShifts = cd ? cd.drawers.filter((d) => d.handover !== null && Math.abs(d.handover) >= 0.01) : [];
        const stillOpen = cd ? cd.drawers.filter((d) => !d.clockOut) : [];
        const alsoCheck = cd
          ? [
              ...(cd.outside.length > 0 ? [t("cdOutsideShift", { n: cd.outside.length, amount: money(cd.outside.reduce((s, r) => s + r.total, 0)), names: [...new Set(cd.outside.map((r) => r.servedBy?.name || "—"))].join(", ") })] : []),
              ...(cd.unpaid.length > 0 ? [t("cdUnpaid", { n: cd.unpaid.length, amount: money(cd.unpaid.reduce((s, r) => s + r.total, 0)) })] : []),
              ...stillOpen.map((d) => t("cdOpenShift", { name: d.name })),
              ...cd.drawers.filter((d) => d.auto).map((d) => t("cdAutoClosed", { name: d.name })),
              ...cd.drawers.filter((d) => !d.loading && d.counted === null && d.clockOut).map((d) => t("cdNoCount", { name: d.name })),
            ]
          : [];
        const anyGap = !!cd && (gapShifts.length > 0 || handoverShifts.some((d) => !d.between || Math.abs(d.between.residual) >= 0.01) || (cd.dayTotals.gap !== null && Math.abs(cd.dayTotals.gap + (cd.dayTotals.impliedCollection || 0)) >= 0.01));
        const closings = dayClosings[day] || [];
        const latest = closings[closings.length - 1] || null;
        const snap = cd ? cdSnapshot(cd) : null;
        const changes = latest && snap ? cdChangesSince(latest.snapshot, snap) : [];
        const Lines = ({ lines }) => (
          <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ fontWeight: l.strong ? 600 : 400, color: l.strong ? "var(--text-primary)" : "var(--text-muted)", marginTop: i ? 4 : 0, paddingInlineStart: l.bullet ? 14 : 0, position: "relative" }}>
                {l.bullet && <span style={{ position: "absolute", insetInlineStart: 2 }}>•</span>}
                {l.text}
              </div>
            ))}
          </div>
        );
        const cellTop = { borderTop: "1px solid var(--border)", paddingTop: 8 };
        return (
          <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 900 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{t("closeDayTitle")}</div>
              <DayPickerButton value={day} maxDate={todayLocalStr()} isRtl={isRtl} theme={theme} onChange={setCloseDayDate} />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>{t("closeDayHint")}</div>

            {latest && (
              <div style={{ ...card, borderColor: changes.length > 0 ? "#C9A24A" : "#4E7A47", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: changes.length > 0 ? "#E3C98A" : "#9FCB8E" }}>
                  ✔ {t("cdClosedBy", { name: latest.closedBy?.name || "—", time: new Date(latest.closedAt).toLocaleString(loc, dtFmt) })}
                </div>
                {latest.note && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>{t("cdClosedNote", { note: latest.note })}</div>}
                {changes.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "#E3C98A", lineHeight: 1.55 }}>
                    <div style={{ fontWeight: 600 }}>{t("cdChangedSince")}</div>
                    {changes.map((c, i) => <div key={i}>• {c}</div>)}
                  </div>
                )}
              </div>
            )}

            {!cd ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
            ) : (
              <>
                <div style={card}>
                  <div style={h}>{t("closeDaySalesTitle")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      [t("cdRevenue"), money(cd.revenue)],
                      [t("cdOrders"), String(cd.orders)],
                      [t("cdExpenses"), money(cd.expenseTotal)],
                      [t("cdNet"), money(cd.revenue - cd.expenseTotal)],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 17, fontFamily: "IBM Plex Mono, monospace" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 12.5, color: "var(--text-muted)" }}>
                    {cd.byMethod.map((m) => <span key={m.id}>{lbl(m.id)} <b style={{ color: "var(--text-primary)", fontFamily: "IBM Plex Mono, monospace" }}>{money(m.total)}</b></span>)}
                    {cd.discounts.n > 0 && <span>{t("cdDiscounts", { n: cd.discounts.n, amount: money(cd.discounts.total) })}</span>}
                    {cd.voided.n > 0 && <span>{t("cdVoided", { n: cd.voided.n, amount: money(cd.voided.total) })}</span>}
                  </div>
                </div>

                <div style={card}>
                  <div style={h}>{t("closeDayDrawerTitle")}</div>
                  {cd.drawers.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("cdNoShifts")}</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.3fr) repeat(6, minmax(66px, 1fr))", gap: "7px 8px", alignItems: "center", minWidth: 640 }}>
                        <div />
                        {["cdOpened", "cdReceived", "cdPaidOut", "cdShouldBe", "cdCounted", "cdGap"].map((k) => (
                          <div key={k} title={k === "cdPaidOut" ? t("cdPaidOutHint") : undefined} style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "right", textTransform: "uppercase", letterSpacing: 0.3 }}>{t(k)}</div>
                        ))}
                        {cd.drawers.map((d, idx) => (
                          <React.Fragment key={d.key}>
                            {idx > 0 && d.between && (d.between.cashIn > 0 || d.between.paidOut > 0) && (
                              <>
                                <div>
                                  <div style={{ fontSize: 12.5, color: "#E3C98A" }}>{t("cdOutsideRow")}</div>
                                  <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{new Date(d.prevOut).toLocaleString(loc, timeFmt)} &ndash; {new Date(d.clockIn).toLocaleString(loc, timeFmt)}</div>
                                </div>
                                <div />
                                <div style={{ ...num, color: "#E3C98A" }}>{money(d.between.cashIn)}</div>
                                <div style={{ ...num, color: "#E3C98A" }}>{money(d.between.paidOut)}</div>
                                <div /><div /><div />
                              </>
                            )}
                            <div>
                              <div style={{ fontSize: 13 }}>{d.name}{d.auto && <span title={t("shiftAutoClosedHint")} style={{ marginInlineStart: 6, fontSize: 10, color: "#E3C98A", border: "1px solid #E3C98A", borderRadius: 20, padding: "1px 6px" }}>{t("shiftAutoClosedBadge")}</span>}</div>
                              <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{new Date(d.clockIn).toLocaleString(loc, dtFmt)} &ndash; {d.clockOut ? new Date(d.clockOut).toLocaleString(loc, timeFmt) : t("cdStillOpen")}</div>
                            </div>
                            {d.loading ? (
                              <div style={{ gridColumn: "span 6", fontSize: 12, color: "var(--text-faint)" }}>{t("loading")}</div>
                            ) : (
                              <>
                                <div style={num}>{d.opening !== null ? money(d.opening) : "—"}</div>
                                <div style={num}>{money(d.cashIn)}</div>
                                <div style={num}>{money(d.paidOut)}</div>
                                <div style={num}>
                                  {d.expected !== null ? money(d.expected) : "—"}
                                  {d.collected > 0 && <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{t("cdCollectedSub", { amount: money(d.collected) })}</div>}
                                </div>
                                <div style={num}>{d.counted !== null ? money(d.counted) : <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{d.clockOut ? t("cdNotCounted") : t("cdStillOpen")}</span>}</div>
                                {d.impliedCollection ? (
                                  <div style={{ ...num, fontWeight: 600, color: "#8EB8D6", fontSize: 11.5 }}>{t("cdImpliedShort", { amount: money(d.impliedCollection) })}</div>
                                ) : (
                                  <div style={{ ...num, fontWeight: 700, color: gapColor(d.gap) }}>{gapText(d.gap)}</div>
                                )}
                              </>
                            )}
                          </React.Fragment>
                        ))}
                        {cd.drawers.length > 0 && !cd.drawers.some((d) => d.loading) && (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 700, ...cellTop }}>{t("cdWholeDay")}</div>
                            <div style={{ ...num, fontWeight: 700, ...cellTop }}>{cd.dayTotals.opening !== null ? money(cd.dayTotals.opening) : "—"}</div>
                            <div style={{ ...num, fontWeight: 700, ...cellTop }}>{money(cd.dayTotals.cashIn)}</div>
                            <div style={{ ...num, fontWeight: 700, ...cellTop }}>{money(cd.dayTotals.paidOut)}</div>
                            <div style={{ ...num, fontWeight: 700, ...cellTop }}>
                              {cd.dayTotals.expectedEnd !== null ? money(cd.dayTotals.expectedEnd) : "—"}
                              {cd.dayTotals.collected > 0 && <div style={{ fontSize: 10, fontWeight: 400, color: "var(--text-faint)" }}>{t("cdCollectedSub", { amount: money(cd.dayTotals.collected) })}</div>}
                            </div>
                            <div style={{ ...num, fontWeight: 700, ...cellTop }}>{cd.dayTotals.finalCounted !== null ? money(cd.dayTotals.finalCounted) : "—"}</div>
                            {cd.dayTotals.impliedCollection && Math.abs(cd.dayTotals.gap + cd.dayTotals.impliedCollection) < 0.01 ? (
                              <div style={{ ...num, fontWeight: 600, ...cellTop, color: "#8EB8D6", fontSize: 11.5 }}>{t("cdImpliedShort", { amount: money(cd.dayTotals.impliedCollection) })}</div>
                            ) : (
                              <div style={{ ...num, fontWeight: 700, ...cellTop, color: gapColor(cd.dayTotals.gap) }}>{gapText(cd.dayTotals.gap)}</div>
                            )}
                          </>
                        )}
                      </div>
                      {cd.dayTotals.gap !== null && Math.abs(cd.dayTotals.gap + (cd.dayTotals.impliedCollection || 0)) >= 0.01 && (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
                          {t("cdDayGapExplain", { shiftGaps: cdSigned(cd.dayTotals.shiftGaps), residuals: cdSigned(cd.dayTotals.residuals) })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {cd.drawers.length > 0 && !cd.drawers.some((d) => d.loading) && (() => {
                  const last = cd.drawers[cd.drawers.length - 1];
                  const rec = cd.collection;
                  const shown = collectionDraft.day === day ? collectionDraft.value : rec ? String(rec.amount) : "";
                  const valid = shown.trim() !== "" && Number.isFinite(Number(shown)) && Number(shown) >= 0;
                  return (
                    <div style={card}>
                      <div style={h}>{t("cdCollectedTitle")}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 10 }}>{t("cdCollectedHint")}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <input type="number" inputMode="decimal" min="0" step="any" value={shown} onChange={(e) => setCollectionDraft({ day, value: e.target.value })} placeholder={t("cdCollectedPlaceholder")} className="field" style={{ width: 170 }} />
                        <button disabled={!valid} onClick={() => saveDayCollection(day, shown)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>{t("cdCollectedSave")}</button>
                        {rec && <button onClick={() => writeDayCollection(day, null)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{t("cdCollectedClear")}</button>}
                      </div>
                      {rec && (
                        <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>
                          {t("cdCollectedRecorded", { amount: money(rec.amount), name: rec.by?.name || "—", time: rec.at ? new Date(rec.at).toLocaleString(loc, dtFmt) : "—" })}
                        </div>
                      )}
                      {rec && last.expected !== null && last.counted !== null && (
                        <div style={{ fontSize: 12.5, marginTop: 8, color: Math.abs(last.gap) < 0.01 ? "#9FCB8E" : "#E3A79C" }}>
                          {t("cdCollectedCheck", { name: last.name, expected: money(last.expected), collected: money(last.collected), left: money(last.expected - last.collected), counted: money(last.counted) })} {Math.abs(last.gap) < 0.01 ? t("varianceMatch") : gapText(last.gap)}
                        </div>
                      )}
                      {last.impliedCollection && (
                        <div style={{ fontSize: 12.5, marginTop: 8, color: "#8EB8D6", lineHeight: 1.5 }}>{t("cdCollectedImplied", { name: last.name, amount: money(last.impliedCollection) })}</div>
                      )}
                    </div>
                  );
                })()}

                <div style={card}>
                  <div style={h}>{t("cdGapsTitle")}</div>
                  {gapShifts.length === 0 && !handoverShifts.some((d) => cdHandoverLines(d).length > 0) ? (
                    cd.drawers.length > 0 && cd.drawers.every((d) => d.counted === null)
                      ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("cdNothingCounted")}</div>
                      : <div style={{ fontSize: 13, color: "#9FCB8E" }}>{t("cdNoGaps")}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {gapShifts.map((d) => <Lines key={d.key} lines={cdGapLines(d)} />)}
                      {handoverShifts.map((d) => <Lines key={`h_${d.key}`} lines={cdHandoverLines(d)} />)}
                    </div>
                  )}
                </div>

                <div style={card}>
                  <div style={h}>{t("cdAlsoCheck")}</div>
                  {alsoCheck.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#9FCB8E" }}>{t("cdAllGood")}</div>
                  ) : (
                    <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-muted)" }}>
                      {alsoCheck.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    disabled={stillOpen.length > 0 || cd.drawers.some((d) => d.loading)}
                    onClick={() => setCloseDayModal({ day, note: "", anyGap })}
                    style={{ padding: "11px 20px", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13.5, fontWeight: 600, cursor: stillOpen.length > 0 ? "not-allowed" : "pointer", opacity: stillOpen.length > 0 ? 0.5 : 1 }}
                  >
                    {latest ? t("cdCloseAgain") : t("closeDayBtn")}
                  </button>
                  <button onClick={() => printViaHiddenFrame(t("cdReportTitle"), buildCloseDayReportHtml(cd, latest, anyGap), isRtl)} style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{t("cdPrint")}</button>
                  <button onClick={() => { downloadReceiptFile(t("cdReportTitle"), buildCloseDayReportHtml(cd, latest, anyGap), isRtl); flashNotice(t("notice_shiftReportDownloaded")); }} style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{t("cdDownload")}</button>
                  {stillOpen.length > 0 && <span style={{ fontSize: 12, color: "#E3C98A" }}>{t("cdCloseBlockedOpen")}</span>}
                </div>
              </>
            )}

            {closeDayModal && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setCloseDayModal(null)}>
                <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{t("cdCloseModalTitle", { date: new Date(`${closeDayModal.day}T00:00:00Z`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) })}</div>
                  <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 12, lineHeight: 1.5 }}>{t("cdCloseModalHint")}</div>
                  {closeDayModal.anyGap && <div style={{ fontSize: 12.5, color: "#A6534A", marginBottom: 8, fontWeight: 600 }}>{t("cdCloseNoteRequired")}</div>}
                  <textarea
                    value={closeDayModal.note}
                    onChange={(e) => setCloseDayModal((m) => ({ ...m, note: e.target.value }))}
                    placeholder={closeDayModal.anyGap ? t("cdCloseNotePlaceholderGap") : t("cdCloseNoteOptional")}
                    rows={3}
                    maxLength={400}
                    style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #C9C2B2", padding: 10, fontSize: 13, fontFamily: "inherit", background: "#FFFFFF", color: "#111111", marginBottom: 14, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setCloseDayModal(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #C9C2B2", background: "transparent", color: COLORS.charcoal, fontSize: 13, cursor: "pointer" }}>{t("cancel")}</button>
                    <button
                      disabled={closingDaySaving || (closeDayModal.anyGap && closeDayModal.note.trim().length < 3)}
                      onClick={() => saveDayClosing(cd, closeDayModal.note.trim())}
                      style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: closingDaySaving || (closeDayModal.anyGap && closeDayModal.note.trim().length < 3) ? 0.5 : 1 }}
                    >
                      {t("cdCloseConfirm")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {view === "shift" && viewingOnly && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 620 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("viewingModeTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("viewingModeSubtitle")}</div>
          </div>
          <button onClick={exitViewingMode} style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("exitViewMode")}</button>
        </div>
      )}
      {view === "shift" && !viewingOnly && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 620 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("yourShift")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{shiftLoaded && shiftStart ? t("clockedInSince", { time: new Date(shiftStart).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }) : t("loading")}</div>
          </div>
          {shiftLoaded && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "var(--surface)", border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("hoursWorked")}</div>
                  <div style={{ fontSize: 20, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{hoursWorkedSoFar || "—"}</div>
                </div>
                <div style={{ background: "var(--surface)", border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("yourOrders")}</div>
                  <div style={{ fontSize: 20, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{myShiftCompleted.length}</div>
                </div>
                <div style={{ background: "var(--surface)", border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("yourRevenue")}</div>
                  <div style={{ fontSize: 20, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(myShiftRevenue)}</div>
                </div>
              </div>
              <button onClick={clockOut} style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 28 }}>{t("clockOut")}</button>

              <div style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("registerTotals")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("ordersCompleted")}</div>
                  <div style={{ fontSize: 24, fontFamily: "IBM Plex Mono, monospace" }}>{shiftCompleted.length}</div>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("netSales")}</div>
                  <div style={{ fontSize: 24, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(shiftGross - shiftRefundsTotal)}</div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{t("byPaymentMethod")}</div>
                {shiftByMethod.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{t(`payment_${m.id}`)} &middot; {tCount("orderCount", m.count)}</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(m.total)}</span>
                  </div>
                ))}
                {shiftRefunded.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)", color: "#E3A79C" }}>
                    <span>{t("refundedCount", { n: shiftRefunded.length })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftRefundsTotal)}</span>
                  </div>
                )}
                {shiftCancelled.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: shiftRefunded.length > 0 ? 6 : 8, color: "#E3C98A" }}>
                    <span>{t("cancelledCountNote", { n: shiftCancelled.length })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>—</span>
                  </div>
                )}
                {shiftDiscountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                    <span>{t("discountedCountNote", { n: shiftDiscountedOrders.length })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftDiscountTotal)}</span>
                  </div>
                )}
                {shiftExpenseTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)", color: "#E3A79C" }}>
                    <span title={shiftExpenses.map((e) => `${e.category} ${money(e.amount)}`).join(", ")}>{tCount("expensesThisShiftCount", shiftExpenses.length)}</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftExpenseTotal)}</span>
                  </div>
                )}
                {shiftExpenseTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <span>{t("netAfterExpensesLabel")}</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(shiftGross - shiftRefundsTotal - shiftExpenseTotal)}</span>
                  </div>
                )}
              </div>

              <div style={{ background: shiftUnpaid.length > 0 ? "#2A2717" : "var(--surface)", border: `1px solid ${shiftUnpaid.length > 0 ? "#5B4F3F" : "var(--border)"}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{t("unpaidThisShiftLabel")}</div>
                {shiftUnpaid.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noUnpaidThisShift")}</div>
                ) : (
                  <>
                    {shiftUnpaid.map((r) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#F0D9A0" }}>
                        <span>{t("ticketHash", { n: r.ticketNo })}{r.table ? ` · ${r.table}` : ""}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(r.total)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: "1px dashed #5B4F3F", color: "#F0D9A0" }}>
                      <span>{tCount("orderCount", shiftUnpaid.length)}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(shiftUnpaidTotal)}</span>
                    </div>
                  </>
                )}
              </div>

              {(
                <div style={{ background: "var(--surface)", border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t("cashReconciliationTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>{t("cashReconciliationSubtitle")}</div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 8 }}>
                    <span title={t("openingFloatHint")}>{t("openingFloatLabel")}</span>
                    <input
                      type="number"
                      value={openingFloat}
                      onChange={(e) => updateOpeningFloat(e.target.value)}
                      disabled={openingCountedThisShift}
                      title={openingCountedThisShift ? t("openingFloatHint") : undefined}
                      className="field"
                      style={{ width: 100, textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{t("cashSalesLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(shiftCashSalesTotal)}</span>
                  </div>
                  {shiftUnsettledDeliveryCash > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "#F0D9A0" }}>
                      <span title={t("unsettledDeliveryCashHint")}>{t("unsettledDeliveryCashLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(shiftUnsettledDeliveryCash)}</span>
                    </div>
                  )}
                  {shiftCashRefundsTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#E3A79C" }}>
                      <span>{t("cashRefundsLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftCashRefundsTotal)}</span>
                    </div>
                  )}
                  {shiftRiderPayTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#E3A79C" }}>
                      <span>{t("riderPayLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftRiderPayTotal)}</span>
                    </div>
                  )}

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("cashExpensesLabel")}</div>
                    {shiftCashExpenses.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{t("noCashExpensesThisShift")}</div>
                    ) : (
                      <>
                        {shiftCashExpenses.map((e) => (
                          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#E3A79C", marginBottom: 4 }}>
                            <span>{e.supplierName || t(`category_${e.category}`)}</span>
                            <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(e.amount)}</span>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4, fontWeight: 600, color: "#E3A79C" }}>
                          <span>{t("cashExpensesLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftCashExpensesTotal)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.secondary}` }}>
                    <span>{t("expectedCashLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(expectedCash)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginTop: 12 }}>
                    <span>{t("countedCashLabel")}</span>
                    <input
                      type="number"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder={t("countedCashPlaceholder")}
                      className="field"
                      style={{ width: 140, textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}
                    />
                  </div>
                  {cashVariance !== null && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>
                      <span>{t("varianceLabel")}</span>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace", color: cashVariance === 0 ? "#9FCB8E" : cashVariance > 0 ? "#E3C98A" : "#E3A79C" }}>
                        {cashVariance === 0 ? t("varianceMatch") : `${cashVariance > 0 ? "+" : ""}${money(cashVariance)} (${cashVariance > 0 ? t("varianceOver") : t("varianceShort")})`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {(
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t("electronicReconciliationTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>{t("electronicReconciliationSubtitle")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {shiftElectronicMethods.map((m) => (
                      <div key={m.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t(`payment_${m.id}`)}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                          <span>{t("salesLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(m.sales)}</span>
                        </div>
                        {m.refunds > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, color: "#E3A79C" }}>
                            <span>{t("refundsLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(m.refunds)}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginTop: 4, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                          <span>{t("expectedSettlementLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(m.expected)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginTop: 10 }}>
                          <span>{t("confirmedOnStatementLabel")}</span>
                          <input
                            type="number"
                            value={confirmedElectronic[m.id] || ""}
                            onChange={(e) => setConfirmedElectronic((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder={t("confirmedElectronicPlaceholder")}
                            className="field"
                            style={{ width: 140, textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}
                          />
                        </div>
                        {m.variance !== null && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                            <span>{t("varianceLabel")}</span>
                            <span style={{ fontFamily: "IBM Plex Mono, monospace", color: m.variance === 0 ? "#9FCB8E" : m.variance > 0 ? "#E3C98A" : "#E3A79C" }}>
                              {m.variance === 0 ? t("varianceMatch") : `${m.variance > 0 ? "+" : ""}${money(m.variance)} (${m.variance > 0 ? t("varianceOver") : t("varianceShort")})`}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasFeature("teamTracking") && deliveryReconciliation.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t("deliveryReconciliationTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>
                    {t("deliveryReconciliationSubtitle", { cut: deliveryFeeRetentionMode === "fixed" ? money(deliveryFeeRetentionFixed) : `${deliveryFeeRetentionPercent}%` })}
                  </div>
                  {deliveryReconciliation.every((p) => p.orders === 0) ? (
                    <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noDeliveryReconciliationYet")}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {deliveryReconciliation.filter((p) => p.orders > 0).sort((a, b) => b.net - a.net).map((p) => (
                        <div key={p.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 13.5 }}>{p.name}</div>
                            <span>{tCount("orderCount", p.orders)}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--text-muted)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("deliveryReconciliationCash")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(p.cashTotal)}</span></div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("deliveryReconciliationFees")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(p.feesTotal)}</span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, color: p.net < 0 ? "#E3A79C" : theme.secondaryLight, marginTop: 3, paddingTop: 5, borderTop: "1px dashed var(--border)" }}>
                              <span>{p.net < 0 ? t("deliveryReconciliationOwedToAgent") : t("deliveryReconciliationOwed")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(Math.abs(p.net))}</span>
                            </div>
                          </div>
                          {p.orderList.some((r) => r.customer?.address) && (
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                              <div style={{ fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>{t("deliveryAddressesLabel")}</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {p.orderList.map((r) => (
                                  <div key={r.id} style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 6 }}>
                                    <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>#{r.ticketNo}</span>
                                    <span>{r.customer?.address || t("noAddressOnFile")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => settleDeliveryCash(p)}
                            style={{ marginTop: 10, fontSize: 11.5, padding: "6px 12px", borderRadius: 6, border: "none", background: "#8A6A2E", color: "#FBF8F2", cursor: "pointer", fontWeight: 600 }}
                          >
                            {t("settleDeliveryCash")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hasFeature("teamTracking") && isManager && teamPerformance.some((p) => p.orders > 0) && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{t("teamPerformanceTitle")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {teamPerformance.filter((p) => p.orders > 0).sort((a, b) => b.revenue - a.revenue).map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          {p.name}
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3", fontWeight: 600 }}>
                            {p.role === "delivery" ? t("roleDelivery") : t("roleWaiter")}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
                          <span>{tCount("orderCount", p.orders)}</span>
                          <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{money(p.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={printShiftReport} title={t("printReceiptTooltip")} style={{ flex: 1, padding: "13px 0", borderRadius: 8, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{t("printShiftReport")}</button>
                <button onClick={downloadShiftReport} title={t("downloadReportTooltip")} style={{ padding: "13px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{t("download")}</button>
              </div>
            </>
          )}
        </div>
      )}

      {view === "tables" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 900 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("tablesTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("tablesSubtitle")}</div>
          </div>

          {!tablesLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{t("numberOfTablesLabel")}</div>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={tableCount}
                  onChange={(e) => setTableCount(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                  className="field"
                  style={{ width: 80 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
                {tableIds.map((id) => {
                  const checkoutReq = checkoutRequestForTable(id);
                  const occupied = tableItemCount(id) > 0 || !!checkoutReq;
                  const isActive = activeTableId === id;
                  const pendingHere = pendingOrdersForTable(id);
                  return (
                    <div key={id} style={{ background: "var(--surface)", border: `1px solid ${pendingHere.length > 0 ? "#C9A24A" : checkoutReq ? "#8EB8D6" : isActive ? theme.secondary : "var(--border)"}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <input
                          type="text"
                          value={tableNames[id] || ""}
                          onChange={(e) => updateTableName(id, e.target.value)}
                          placeholder={t("tableNumbered", { n: id })}
                          style={{ background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 5, color: "#111111", fontSize: 14, fontWeight: 500, padding: "3px 6px", width: "70%", fontFamily: "Fraunces, serif" }}
                        />
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: occupied ? "#3A2A28" : "#22301F", color: occupied ? "#E3A79C" : "#9FCB8E", fontWeight: 500, flexShrink: 0 }}>
                          {occupied ? t("tableOccupied") : t("tableAvailable")}
                        </span>
                      </div>
                      {pendingHere.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#E3C98A", marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E3C98A", display: "inline-block" }} />
                          {t("newOrderBadge")}
                        </div>
                      )}
                      {checkoutReq && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#8EB8D6", marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8EB8D6", display: "inline-block" }} />
                          {t("billRequestedBadge", { method: t(`payment_${checkoutReq.paymentMethod}`) })}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {pendingHere.length > 0 ? (
                          <button
                            onClick={() => setReviewTableId(id)}
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #C9A24A", background: "rgba(201,162,74,0.15)", color: "#E3C98A", cursor: "pointer", fontWeight: 600 }}
                          >
                            {t("reviewOrder")}
                          </button>
                        ) : (
                          <button
                            onClick={() => { switchTable(id); setView("order"); }}
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}
                          >
                            {t("openTicket")}
                          </button>
                        )}
                        {occupied && (
                          <button
                            onClick={() => openPayTableModal(id)}
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #8EB8D6", background: "rgba(142,184,214,0.15)", color: "#8EB8D6", cursor: "pointer", fontWeight: 600 }}
                          >
                            {t("markAsPaid")}
                          </button>
                        )}
                        {hasFeature("tableQrOrdering") && (
                          <button
                            onClick={() => setQrTableId(id)}
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
                          >
                            {t("qrCode")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {view === "delivery" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 780 }}>
          {hasFeature("onlineOrderingLink") && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("storeLinkTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("storeLinkSubtitle")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 12, fontFamily: "IBM Plex Mono, monospace", color: "var(--text-muted)", wordBreak: "break-all" }}>{storeOrderUrl()}</div>
              <button onClick={copyStoreLink} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                {storeLinkCopied ? t("linkCopied") : t("copyLink")}
              </button>
            </div>
            <div style={{ fontSize: 11, color: COLORS.red, marginTop: 8 }}>{t("storeLinkNote")}</div>
          </div>
          )}

          {hasFeature("onlineOrderingLink") && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("callCenterLinkTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("callCenterLinkSubtitle")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 12, fontFamily: "IBM Plex Mono, monospace", color: "var(--text-muted)", wordBreak: "break-all" }}>{callCenterUrl()}</div>
              <button onClick={copyCallCenterLink} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                {callCenterLinkCopied ? t("linkCopied") : t("copyLink")}
              </button>
            </div>
            <div style={{ fontSize: 11, color: COLORS.red, marginTop: 8 }}>{t("callCenterLinkNote")}</div>
          </div>
          )}

          {hasFeature("deliveryZones") && (
          <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("deliveryZonesTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("deliveryZonesSubtitle")}</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <input type="text" value={newZoneLabel} onChange={(e) => setNewZoneLabel(e.target.value)} placeholder={t("zoneLabelPlaceholder")} className="field" style={{ flex: 2, minWidth: 160 }} />
            <input type="number" min={0} step="0.01" value={newZoneFee} onChange={(e) => setNewZoneFee(e.target.value)} placeholder={t("zoneFee")} className="field" style={{ flex: 1, minWidth: 100 }} />
            <button onClick={addDeliveryZone} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addZone")}</button>
          </div>

          {!deliveryZonesLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : deliveryZones.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noZonesYet")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deliveryZones.map((zone) => (
                <div key={zone.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap", gap: 8 }}>
                  {editingZoneId === zone.id ? (
                    <>
                      <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 200 }}>
                        <input type="text" value={editingZoneLabel} onChange={(e) => setEditingZoneLabel(e.target.value)} className="field" style={{ flex: 2 }} />
                        <input type="number" min={0} step="0.01" value={editingZoneFee} onChange={(e) => setEditingZoneFee(e.target.value)} className="field" style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={saveEditZone} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", background: theme.primary, color: "#FBF8F2", cursor: "pointer" }}>{t("apply")}</button>
                        <button onClick={() => setEditingZoneId(null)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("cancel")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5 }}>
                        {zone.label} <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>{money(zone.fee)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEditZone(zone)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("editZone")}</button>
                        <button onClick={() => removeDeliveryZone(zone)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("removeZone")}</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("deliveryAgentShareTitle")}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10 }}>{t("deliveryAgentShareSubtitle")}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button
                onClick={() => setDeliveryFeeRetentionMode("percentage")}
                style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${deliveryFeeRetentionMode === "percentage" ? theme.secondary : "var(--border)"}`, background: deliveryFeeRetentionMode === "percentage" ? "rgba(176,141,87,0.18)" : "transparent", color: deliveryFeeRetentionMode === "percentage" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
              >
                {t("retentionModePercentage")}
              </button>
              <button
                onClick={() => setDeliveryFeeRetentionMode("fixed")}
                style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${deliveryFeeRetentionMode === "fixed" ? theme.secondary : "var(--border)"}`, background: deliveryFeeRetentionMode === "fixed" ? "rgba(176,141,87,0.18)" : "transparent", color: deliveryFeeRetentionMode === "fixed" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
              >
                {t("retentionModeFixed")}
              </button>
            </div>
            {deliveryFeeRetentionMode === "percentage" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={deliveryFeeRetentionPercent}
                  onChange={(e) => setDeliveryFeeRetentionPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="field"
                  style={{ width: 90 }}
                />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={deliveryFeeRetentionFixed}
                  onChange={(e) => setDeliveryFeeRetentionFixed(Math.max(0, Number(e.target.value) || 0))}
                  className="field"
                  style={{ width: 110 }}
                />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("perDeliveryLabel")}</span>
              </div>
            )}
          </div>
          </>
          )}

          {hasFeature("teamTracking") && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("riderReportTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{t("riderReportSubtitle")}</div>
            {riderReportRiders.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("riderReportNoRiders")}</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {riderReportRiders.map((p) => {
                    const on = riderReportRider && riderReportRider.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setRiderReportId(p.id)}
                        style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${on ? theme.secondary : "var(--border)"}`, background: on ? "rgba(176,141,87,0.18)" : "transparent", color: on ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: on ? 600 : 400, cursor: "pointer" }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    <div style={{ marginBottom: 3 }}>{t("riderReportFrom")}</div>
                    <input type="date" value={riderReportFirstDay} max={todayLocalStr()} onChange={(e) => setRiderReportFrom(e.target.value || null)} className="field" />
                  </label>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    <div style={{ marginBottom: 3 }}>{t("riderReportTo")}</div>
                    <input type="date" value={riderReportLastDay} max={todayLocalStr()} onChange={(e) => setRiderReportTo(e.target.value || null)} className="field" />
                  </label>
                  <button
                    onClick={printRiderReport}
                    disabled={riderReportRows.length === 0}
                    style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: riderReportRows.length === 0 ? "default" : "pointer", opacity: riderReportRows.length === 0 ? 0.45 : 1 }}
                  >
                    {t("riderReportPrint")}
                  </button>
                </div>

                {riderReportPool === null ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
                ) : riderReportRows.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("riderReportEmpty", { name: riderReportRider.name })}</div>
                ) : (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    {riderReportRows.map(({ r, fee, amount }, i) => (
                      <div key={r.id || `${r.timestamp}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 2 }}>
                            {t("ticketNumber", { n: r.ticketNo })} · {new Date(r.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", riderReportFirstDay === riderReportLastDay ? { hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{r.customer?.name || t("riderReportNoName")}{r.customer?.phone ? <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12 }}> · {r.customer.phone}</span> : null}</div>
                          {r.customer?.address && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{r.customer.address}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, fontFamily: "IBM Plex Mono, monospace" }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{money(amount)}</div>
                          <div style={{ fontSize: 11.5, color: theme.secondaryLight, marginTop: 2 }}>+ {money(fee)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, fontSize: 13, background: "rgba(176,141,87,0.07)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("riderReportOrders")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{riderReportRows.length}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("riderReportOrdersTotal")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(riderReportOrdersTotal)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("riderReportFeesTotal")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(riderReportFeesTotal)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14.5, marginTop: 4 }}><span>{t("riderReportGrandTotal")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(riderReportOrdersTotal + riderReportFeesTotal)}</span></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </div>
      )}

      {qrTableId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 20 }} onClick={() => setQrTableId(null)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 26, width: "100%", maxWidth: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{t("qrModalTitle")}</div>
            <div style={{ fontSize: 13, color: COLORS.charcoalSoft, marginBottom: 14 }}>{tableLabel(qrTableId)}</div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(tableMenuUrl(qrTableId))}`}
              alt="QR"
              style={{ width: 200, height: 200, margin: "0 auto 12px", display: "block" }}
            />
            <div style={{ fontSize: 10, color: "#8A8580", wordBreak: "break-all", marginBottom: 10, fontFamily: "IBM Plex Mono, monospace" }}>{tableMenuUrl(qrTableId)}</div>
            <div style={{ fontSize: 11, color: COLORS.red, marginBottom: 16 }}>{t("qrLinkNote")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => printQrFlyer(qrTableId)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${theme.primary}`, background: "transparent", color: theme.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("printQr")}</button>
              <button onClick={() => downloadQrFlyer(qrTableId)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #C9C2B2", background: "transparent", color: COLORS.charcoal, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("download")}</button>
              <button onClick={() => setQrTableId(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      {reviewTableId !== undefined && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 75, padding: 20 }} onClick={() => setReviewTableId(undefined)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{t("pendingOrderFrom", { table: tableLabel(reviewTableId) })}</div>
            {pendingOrdersForTable(reviewTableId).length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.charcoalSoft, margin: "16px 0" }}>{t("noPendingOrders")}</div>
            ) : (
              pendingOrdersForTable(reviewTableId).map((order) => (
                <div key={order.id} style={{ borderTop: "1px dashed #D8D0BE", marginTop: 14, paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 8 }}>
                    {t("pendingOrderSubmitted", { time: new Date(order.submittedAt).toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" }) })}
                  </div>
                  {(order.source === "callcenter" || order.customer) && (
                    <div style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
                      {order.source === "callcenter" && <div style={{ color: theme.secondary, fontWeight: 600 }}>{t("pendingOrderCallCenter", { agent: order.agent?.name || "" })}</div>}
                      {order.customer && <div>{[order.customer.name, order.customer.phone, order.customer.address].filter(Boolean).join(" · ")}</div>}
                    </div>
                  )}
                  {order.items.map((it, idx) => (
                    <div key={idx} style={{ marginBottom: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span>{it.qty}&times; {it.name}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(it.price * it.qty)}</span>
                      </div>
                      {it.note && <div style={{ fontSize: 11, color: theme.secondary, fontStyle: "italic" }}>{it.note}</div>}
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginTop: 6, paddingTop: 6, borderTop: "1px solid #E4DECE" }}>
                    <span>{t("total")}</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(order.items.reduce((s, it) => s + it.price * it.qty, 0))}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => confirmPendingOrder(order)} style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t("confirmOrder")}</button>
                    <button onClick={() => rejectPendingOrder(order)} style={{ padding: "9px 14px", borderRadius: 7, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>{t("rejectOrder")}</button>
                  </div>
                </div>
              ))
            )}
            <button onClick={() => setReviewTableId(undefined)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: COLORS.charcoalSoft, fontSize: 12.5, cursor: "pointer", marginTop: 16 }}>{t("close")}</button>
          </div>
        </div>
      )}

      {payTableModal && (() => {
        const modalSubtotal = payTableModal.items.reduce((s, it) => s + it.price * it.qty, 0);
        const modalService = Math.round(modalSubtotal * (effectiveServicePercent / 100) * 100) / 100;
        const modalVat = Math.round((modalSubtotal + modalService) * (effectiveVatPercent / 100) * 100) / 100;
        const modalTotal = modalSubtotal + modalService + modalVat;
        const modalSplitEntered = PAYMENT_METHODS.reduce((s, m) => s + (Number(payTableModal.splitAmounts?.[m.id]) || 0), 0);
        const modalSplitRemaining = Math.round((modalTotal - modalSplitEntered) * 100) / 100;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setPayTableModal(null)}>
            <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 14 }}>
                {t("confirmPaymentTitle", { table: tableLabel(payTableModal.tableId) })}
              </div>
              {payTableModal.items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{it.qty}&times; {it.name}</span>
                  <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(it.price * it.qty)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed #D8D0BE", marginTop: 10, paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("subtotal")}</span><span>{money(modalSubtotal)}</span></div>
                {effectiveServicePercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("serviceCharge")} ({effectiveServicePercent}%)</span><span>{money(modalService)}</span></div>}
                {effectiveVatPercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("vat")} ({effectiveVatPercent}%)</span><span>{money(modalVat)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                  <span>{t("confirmPaymentBody")}</span><span>{money(modalTotal)}</span>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("paymentMethodLabel")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayTableModal((p) => ({ ...p, paymentMethod: m.id }))}
                      style={{ flex: "1 1 70px", padding: "9px 0", borderRadius: 7, border: `1px solid ${payTableModal.paymentMethod === m.id ? theme.secondary : "#DCD5C4"}`, background: payTableModal.paymentMethod === m.id ? "rgba(176,141,87,0.18)" : "transparent", color: payTableModal.paymentMethod === m.id ? "#8A6A2E" : COLORS.charcoal, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                    >
                      {t(`payment_${m.id}`)}
                    </button>
                  ))}
                  <button
                    onClick={() => setPayTableModal((p) => ({ ...p, paymentMethod: "split" }))}
                    style={{ flex: "1 1 70px", padding: "9px 0", borderRadius: 7, border: `1px solid ${payTableModal.paymentMethod === "split" ? theme.secondary : "#DCD5C4"}`, background: payTableModal.paymentMethod === "split" ? "rgba(176,141,87,0.18)" : "transparent", color: payTableModal.paymentMethod === "split" ? "#8A6A2E" : COLORS.charcoal, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("splitPaymentOption")}
                  </button>
                </div>
                {payTableModal.paymentMethod === "split" && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {PAYMENT_METHODS.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12.5 }}>{t(`payment_${m.id}`)}</span>
                        <input
                          type="number"
                          value={payTableModal.splitAmounts?.[m.id] || ""}
                          onChange={(e) => setPayTableModal((p) => ({ ...p, splitAmounts: { ...p.splitAmounts, [m.id]: e.target.value } }))}
                          placeholder="0.00"
                          className="field"
                          style={{ width: 100, textAlign: "right" }}
                        />
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginTop: 2, color: modalSplitRemaining === 0 ? "#3F7A4F" : COLORS.red }}>
                      <span>{t("splitRemainingLabel")}</span><span>{money(modalSplitRemaining)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button onClick={() => setPayTableModal(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #C9C2B2", background: "transparent", color: COLORS.charcoal, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("cancel")}</button>
                <button disabled={confirmingTablePayment} onClick={confirmTablePayment} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: confirmingTablePayment ? "not-allowed" : "pointer", opacity: confirmingTablePayment ? 0.6 : 1 }}>{t("confirmPaymentButton")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {view === "staff" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 780 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("staffTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("staffSubtitle")}</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder={t("yourNamePlaceholder")} className="field" style={{ flex: 1, minWidth: 140 }} />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={newStaffPin}
              onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={t("choosePinPlaceholder")}
              className="field"
              style={{ width: 160, fontFamily: "IBM Plex Mono, monospace" }}
            />
            <button onClick={addStaffMember} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addEmployee")}</button>
          </div>

          {!employeesLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {employees.map((emp) => (
                <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: `1px solid ${currentEmployee?.id === emp.id ? theme.secondary : "var(--border)"}`, borderRadius: 10, padding: "12px 16px", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                      {initials(emp.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        {emp.name}
                        <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: (emp.role || "manager") !== "staff" ? "rgba(176,141,87,0.18)" : "var(--track)", color: (emp.role || "manager") !== "staff" ? theme.secondaryLight : "var(--text-muted)", fontWeight: 600 }}>
                          {(emp.role || "manager") !== "staff" ? t("roleManager") : t("roleStaff")}
                        </span>
                      </div>
                      {currentEmployee?.id === emp.id && <div style={{ fontSize: 10.5, color: theme.secondaryLight }}>{t("currentlyClockedIn")}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {isManager && (
                      <button onClick={() => toggleEmployeeRole(emp)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                        {(emp.role || "manager") !== "staff" ? t("makeStaff") : t("makeManager")}
                      </button>
                    )}
                    {currentEmployee?.id === emp.id ? (
                      editingPinId === emp.id ? (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={editingPinValue}
                            onChange={(e) => setEditingPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="field"
                            style={{ width: 90, fontFamily: "IBM Plex Mono, monospace" }}
                          />
                          <button onClick={() => saveEditedPin(emp.id)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", background: theme.primary, color: "#FBF8F2", cursor: "pointer" }}>{t("apply")}</button>
                        </>
                      ) : (
                        <button onClick={() => { setEditingPinId(emp.id); setEditingPinValue(emp.pin); }} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("editPin")}</button>
                      )
                    ) : (
                      <span style={{ fontSize: 11.5, color: "#5A5F6A", fontFamily: "IBM Plex Mono, monospace" }}>••••</span>
                    )}
                    <button onClick={() => removeStaffMember(emp.id)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("removeEmployee")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("leaderboardTitle")}</div>
          {!shiftLogLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 28 }}>{t("loading")}</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 28 }}>{t("noLeaderboardData")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
              {leaderboard.map((entry, i) => (
                <div key={entry.name + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "IBM Plex Mono, monospace", width: 16 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5 }}>{entry.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
                    <span>{tCount("orderCount", entry.orders)}</span>
                    <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{money(entry.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasFeature("teamTracking") && isManager && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("teamRosterTitle")}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>{t("teamRosterSubtitle")}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <input type="text" value={newDutyName} onChange={(e) => setNewDutyName(e.target.value)} placeholder={t("newTeamMemberPlaceholder")} className="field" style={{ flex: 1, minWidth: 140 }} />
                  <select value={newDutyRole} onChange={(e) => setNewDutyRole(e.target.value)} className="field" style={{ width: 140 }}>
                    <option value="waiter">{t("roleWaiter")}</option>
                    <option value="delivery">{t("roleDelivery")}</option>
                  </select>
                  <button onClick={addDutyMember} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addTeamMember")}</button>
                </div>

                {!dutyRosterLoaded ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
                ) : dutyRoster.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noTeamMembersYet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dutyRoster.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2A2E3A", color: "#B0A8E3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                            {initials(m.name)}
                          </div>
                          <div style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                            {m.name}
                            <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3", fontWeight: 600 }}>
                              {m.role === "delivery" ? t("roleDelivery") : t("roleWaiter")}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeDutyMember(m)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("removeTeamMember")}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t("teamPerformanceTitle")}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>{t("teamPerformanceSubtitle")}</div>
                {teamPerformance.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noTeamMembersYet")}</div>
                ) : teamPerformance.every((p) => p.orders === 0) ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noTeamPerformanceYet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {teamPerformance.filter((p) => p.orders > 0).sort((a, b) => b.revenue - a.revenue).map((p) => (
                      <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                            {p.name}
                            <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3", fontWeight: 600 }}>
                              {p.role === "delivery" ? t("roleDelivery") : t("roleWaiter")}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
                            <span>{tCount("orderCount", p.orders)}</span>
                            <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{money(p.revenue)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedDutyId(expandedDutyId === p.id ? null : p.id)}
                          style={{ fontSize: 11, color: theme.secondaryLight, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 8, fontFamily: "IBM Plex Mono, monospace" }}
                        >
                          {expandedDutyId === p.id ? t("hideAssignedOrders") : t("viewAssignedOrders", { n: p.tickets.length })}
                        </button>
                        {expandedDutyId === p.id && (
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {p.tickets.map((tk, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-muted)", fontFamily: "IBM Plex Mono, monospace" }}>
                                <span>{t("ticketHash", { n: tk.ticketNo })} &middot; {new Date(tk.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })}</span>
                                <span>{money(tk.total)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {isManager && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("openShiftsTitle")}</div>
              {!openShiftsLoaded ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
              ) : openShiftsList.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noOpenShifts")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {openShiftsList.map((s) => (
                    <button
                      key={s.employeeId}
                      onClick={() => openShiftDetail(s)}
                      title={t("viewShiftDetailTooltip")}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: `1px solid ${theme.secondary}`, borderRadius: 8, padding: "10px 14px", flexWrap: "wrap", gap: 6, width: "100%", textAlign: isRtl ? "right" : "left", font: "inherit", color: "inherit", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#9FCB8E", display: "inline-block", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13 }}>{s.employeeName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{t("openShiftSince", { time: new Date(s.clockIn).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {t("shiftHistoryLine", { orders: s.orders, revenue: money(s.revenue), hours: formatDuration(nowTick - new Date(s.clockIn).getTime()) })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isManager && (() => {
            const day = dayCheckDate || businessDateForTimestamp(new Date().toISOString(), shiftHoursConfig);
            const dayPeriod = ledger.period(day, day);
            const loadedAll = !!dayPeriod;
            const dayReceipts = dayPeriod ? dayPeriod.completed : [];
            const shiftsForCheck = ledger.allShifts();
            const rowsByKey = new Map();
            const orphan = { key: "none", name: null, clockIn: "9999", orders: 0, cash: 0, other: 0, total: 0, names: new Set() };
            dayReceipts.forEach((r) => {
              const sh = shiftsForCheck.find((x) => x.employeeId === r.servedBy?.id && r.timestamp >= x.clockIn && (!x.clockOut || r.timestamp <= x.clockOut));
              const target = sh ? rowsByKey.get(sh.key) || rowsByKey.set(sh.key, { ...sh, orders: 0, cash: 0, other: 0, total: 0 }).get(sh.key) : orphan;
              const amts = receiptMethodAmounts(r);
              const cash = amts.filter((a) => a.method === "cash").reduce((sum, a) => sum + a.amount, 0);
              target.orders += 1;
              target.cash += cash;
              target.other += r.total - cash;
              target.total += r.total;
              if (!sh) target.names.add(r.servedBy?.name || "—");
            });
            const rows = [...rowsByKey.values()].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
            const sumOf = (f) => [...rows, orphan].reduce((sum, r) => sum + r[f], 0);
            const timeFmt = { hour: "numeric", minute: "2-digit" };
            const dateTimeFmt = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
            const cell = { fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5, textAlign: "right" };
            return (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600 }}>{t("dayCheckTitle")}</div>
                  <DayPickerButton value={day} maxDate={todayLocalStr()} isRtl={isRtl} theme={theme} onChange={setDayCheckDate} />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>{t("dayCheckHint")}</div>
                {!loadedAll ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
                ) : dayReceipts.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("dayCheckEmpty")}</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1fr) 56px 84px 96px 92px", gap: "6px 10px", alignItems: "center", minWidth: 480 }}>
                      <div />
                      {["dayCheckOrders", "dayCheckCash", "dayCheckOther", "dayCheckTotal"].map((k) => (
                        <div key={k} style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "right", textTransform: "uppercase", letterSpacing: 0.3 }}>{t(k)}</div>
                      ))}
                      {rows.map((r) => (
                        <React.Fragment key={r.key}>
                          <div>
                            <div style={{ fontSize: 13 }}>
                              {r.name}
                              {r.auto && <span title={t("shiftAutoClosedHint")} style={{ marginInlineStart: 6, fontSize: 10, color: "#E3C98A", border: "1px solid #E3C98A", borderRadius: 20, padding: "1px 6px" }}>{t("shiftAutoClosedBadge")}</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                              {new Date(r.clockIn).toLocaleString(isRtl ? "ar-EG" : "en-US", dateTimeFmt)} &ndash; {r.clockOut ? new Date(r.clockOut).toLocaleString(isRtl ? "ar-EG" : "en-US", timeFmt) : t("openShiftOngoingLabel")}
                            </div>
                          </div>
                          <div style={cell}>{r.orders}</div>
                          <div style={cell}>{money(r.cash)}</div>
                          <div style={cell}>{money(r.other)}</div>
                          <div style={cell}>{money(r.total)}</div>
                        </React.Fragment>
                      ))}
                      {orphan.orders > 0 && (
                        <React.Fragment>
                          <div title={t("dayCheckNoShiftHint")}>
                            <div style={{ fontSize: 13, color: "#E3C98A" }}>{t("dayCheckNoShift")}</div>
                            <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{[...orphan.names].join(", ")}</div>
                          </div>
                          <div style={{ ...cell, color: "#E3C98A" }}>{orphan.orders}</div>
                          <div style={{ ...cell, color: "#E3C98A" }}>{money(orphan.cash)}</div>
                          <div style={{ ...cell, color: "#E3C98A" }}>{money(orphan.other)}</div>
                          <div style={{ ...cell, color: "#E3C98A" }}>{money(orphan.total)}</div>
                        </React.Fragment>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8 }}>{t("dayCheckTotal")}</div>
                      <div style={{ ...cell, fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8 }}>{sumOf("orders")}</div>
                      <div style={{ ...cell, fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8 }}>{money(sumOf("cash"))}</div>
                      <div style={{ ...cell, fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8 }}>{money(sumOf("other"))}</div>
                      <div style={{ ...cell, fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8, color: theme.secondaryLight }}>{money(sumOf("total"))}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>{t("dayCheckMatches")}</div>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("shiftHistoryTitle")}</div>
          {!shiftLogLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : recentShiftLog.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("noShiftHistory")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentShiftLog.map((s) => {
                const live = shiftLiveStats(s);
                const shownOrders = live ? live.orders : s.orders;
                const shownRevenue = live ? live.revenue : s.revenue;
                const split = live ? PAYMENT_METHODS.filter((m) => live.byMethod[m.id] > 0).map((m) => `${t(`payment_${m.id}`)} ${money(live.byMethod[m.id])}`).join(" · ") : "";
                return (
                <button
                  key={s.id}
                  onClick={() => isManager && openShiftDetail(s)}
                  disabled={!isManager}
                  title={isManager ? t("viewShiftDetailTooltip") : undefined}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", flexWrap: "wrap", gap: 6, width: "100%", textAlign: isRtl ? "right" : "left", font: "inherit", color: "inherit", cursor: isManager ? "pointer" : "default" }}
                >
                  <div>
                    <div style={{ fontSize: 13 }}>
                      {s.employeeName}
                      {s.autoClosed && <span title={t("shiftAutoClosedHint")} style={{ marginInlineStart: 6, fontSize: 10, color: "#E3C98A", border: "1px solid #E3C98A", borderRadius: 20, padding: "1px 6px" }}>{t("shiftAutoClosedBadge")}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{new Date(s.clockIn).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} &ndash; {new Date(s.clockOut).toLocaleString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: isRtl ? "left" : "right" }}>
                    <div>{t("shiftHistoryLine", { orders: shownOrders, revenue: money(shownRevenue), hours: formatDuration(new Date(s.clockOut) - new Date(s.clockIn)) })}</div>
                    {split && <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2 }}>{split}</div>}
                    {typeof s.countedCash === "number" && (
                      <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2 }}>
                        {t("shiftCashLine", { opening: money(s.openingCash || 0), counted: money(s.countedCash), expected: money(s.expectedCash || 0) })}
                        {" · "}
                        <span style={{ color: s.cashVariance === 0 ? "#9FCB8E" : "#E3A79C", fontWeight: 600 }}>{s.cashVariance === 0 ? t("varianceMatch") : `${s.cashVariance > 0 ? "+" : ""}${money(s.cashVariance)}`}</span>
                      </div>
                    )}
                    {typeof s.previousCount === "number" && s.previousCount !== s.openingCash && (
                      <div style={{ fontSize: 10.5, color: "#E3C98A", marginTop: 2 }}>{t("handoverMismatch", { opening: money(s.openingCash || 0), previous: money(s.previousCount) })}</div>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewingShiftDetail && (() => {
        const s = viewingShiftDetail;
        const isOngoing = !s.clockOut;
        // For an ongoing shift there's no fixed end yet, so don't cap the upper bound at all —
        // capping it at nowTick (which only ticks once a minute) was excluding orders placed within
        // the last few tens of seconds. A finished shift still uses its real clockOut as the cutoff.
        const endTime = s.clockOut || new Date(nowTick).toISOString();
        const liveDetail = shiftLiveStats(s);
        const loaded = liveDetail !== null;
        const detailReceipts = liveDetail ? liveDetail.all : [];
        const completed = detailReceipts.filter((r) => r.status === "completed");
        const cancelled = detailReceipts.filter((r) => r.status === "cancelled");
        const refunded = detailReceipts.filter((r) => r.status === "refunded");
        const gross = completed.reduce((sum, r) => sum + r.total, 0);
        const refundsTotal = refunded.reduce((sum, r) => sum + r.total, 0);
        const discountTotal = completed.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
        const discountedCount = completed.filter((r) => (r.discountAmount || 0) > 0).length;
        const methodAmounts = completed.flatMap(receiptMethodAmounts);
        const byMethod = PAYMENT_METHODS.map((m) => ({ ...m, total: methodAmounts.filter((a) => a.method === m.id).reduce((sum, a) => sum + a.amount, 0) })).filter((m) => m.total > 0);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }} onClick={() => setViewingShiftDetail(null)}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif" }}>{s.employeeName}</div>
                {isOngoing && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#9FCB8E", border: "1px solid #9FCB8E", borderRadius: 20, padding: "2px 8px" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9FCB8E", display: "inline-block" }} />
                    {t("shiftStillOpenBadge")}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
                {new Date(s.clockIn).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} &ndash; {isOngoing ? t("openShiftOngoingLabel") : new Date(s.clockOut).toLocaleString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })} &middot; {formatDuration(new Date(endTime) - new Date(s.clockIn))}
              </div>
              {!loaded ? (
                <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>{t("ordersCompleted")}</div>
                      <div style={{ fontSize: 17, fontFamily: "IBM Plex Mono, monospace" }}>{completed.length}</div>
                    </div>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>{t("netSales")}</div>
                      <div style={{ fontSize: 17, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(gross)}</div>
                    </div>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>{t("avgOrderValue")}</div>
                      <div style={{ fontSize: 17, fontFamily: "IBM Plex Mono, monospace" }}>{money(completed.length > 0 ? gross / completed.length : 0)}</div>
                    </div>
                  </div>

                  {byMethod.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("byPaymentMethod")}</div>
                      {byMethod.map((m) => (
                        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                          <span>{t(`payment_${m.id}`)}</span>
                          <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(m.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(refunded.length > 0 || cancelled.length > 0 || discountTotal > 0) && (
                    <div style={{ marginBottom: 18, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
                      {refunded.length > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#E3A79C" }}>
                          <span>{t("refundedCount", { n: refunded.length })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(refundsTotal)}</span>
                        </div>
                      )}
                      {cancelled.length > 0 && (
                        <div style={{ color: "#E3C98A" }}>{t("cancelledCountNote", { n: cancelled.length })}</div>
                      )}
                      {discountTotal > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{t("discountedCountNote", { n: discountedCount })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(discountTotal)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("shiftDetailTicketsTitle")}</div>
                  {completed.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noSalesThisShift")}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {completed.map((r) => (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
                          <span>{t("ticketHash", { n: r.ticketNo })} &middot; {new Date(r.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })}</span>
                          <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(r.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button onClick={() => setViewingShiftDetail(null)} style={{ marginTop: 20, width: "100%", padding: "11px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13.5, cursor: "pointer" }}>{t("cancel")}</button>
            </div>
          </div>
        );
      })()}

      {shiftRecap && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 20 }}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 28, width: "100%", maxWidth: 380, textAlign: "center" }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{t("shiftRecapTitle", { name: shiftRecap.name })}</div>
            <div style={{ fontSize: 13, color: COLORS.charcoalSoft, marginBottom: 18 }}>{t("shiftRecapHours", { hours: formatDuration(shiftRecap.hoursMs) })}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#F1ECE0", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10.5, color: COLORS.charcoalSoft, marginBottom: 4 }}>{t("yourOrders")}</div>
                <div style={{ fontSize: 22, fontFamily: "IBM Plex Mono, monospace" }}>{shiftRecap.orders}</div>
              </div>
              <div style={{ background: "#F1ECE0", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10.5, color: COLORS.charcoalSoft, marginBottom: 4 }}>{t("yourRevenue")}</div>
                <div style={{ fontSize: 22, fontFamily: "IBM Plex Mono, monospace" }}>{money(shiftRecap.revenue)}</div>
              </div>
            </div>
            {shiftRecap.alreadyClosed && (
              <div style={{ background: "#F6E3DF", color: "#8A3A30", borderRadius: 8, padding: "9px 12px", fontSize: 12, lineHeight: 1.5, marginBottom: 10, textAlign: "left" }}>
                {t("shiftAlreadyClosedElsewhere", { counted: money(shiftRecap.alreadyClosed.countedCash ?? 0) })}
              </div>
            )}
            {shiftRecap.cash && (
              <div style={{ textAlign: "left", fontSize: 12.5, padding: "10px 2px", borderTop: "1px dashed #D8D0BE", marginBottom: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("recapCashTitle")}</div>
                {[["openingFloatLabel", shiftRecap.cash.opening], ["expectedCashLabel", shiftRecap.cash.expected], ["countedCashLabel", shiftRecap.cash.counted]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ color: COLORS.charcoalSoft }}>{t(k)}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(v)}</span></div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: shiftRecap.cash.variance === 0 ? "#4E7A47" : "#A6534A" }}>
                  <span>{t("varianceLabel")}</span>
                  <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{shiftRecap.cash.variance === 0 ? t("varianceMatch") : `${shiftRecap.cash.variance > 0 ? "+" : ""}${money(shiftRecap.cash.variance)} (${shiftRecap.cash.variance > 0 ? t("varianceOver") : t("varianceShort")})`}</span>
                </div>
                {shiftRecap.cash.previousCount !== null && shiftRecap.cash.previousCount !== shiftRecap.cash.opening && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#A6534A" }}>{t("handoverMismatch", { opening: money(shiftRecap.cash.opening), previous: money(shiftRecap.cash.previousCount) })}</div>
                )}
              </div>
            )}
            {shiftRecap.orders > 0 ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 2px", borderTop: "1px dashed #D8D0BE" }}>
                  <span style={{ color: COLORS.charcoalSoft }}>{t("avgOrderValue")}</span><span>{money(shiftRecap.avg)}</span>
                </div>
                {shiftRecap.topSeller && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 2px", borderTop: "1px dashed #D8D0BE", marginBottom: 18 }}>
                    <span style={{ color: COLORS.charcoalSoft }}>{t("topSellerThisShift")}</span><span>{shiftRecap.topSeller.name} &times;{shiftRecap.topSeller.qty}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 18 }}>{t("noSalesThisShift")}</div>
            )}
            <button onClick={finishClockOut} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("done")}</button>
          </div>
        </div>
      )}

      {showRenewalNotice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 95, padding: 20 }} onClick={dismissRenewalNotice}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 28, width: "100%", maxWidth: 380, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F3DAD6", color: COLORS.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, margin: "0 auto 14px" }}>!</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t("renewalNoticeTitle")}</div>
            <div style={{ fontSize: 13.5, color: COLORS.charcoalSoft, lineHeight: 1.5, marginBottom: 22 }}>
              {t(`renewalNoticeBody_${tenantStatus.days_remaining}`, { date: tenantStatus.paid_until })}
            </div>
            <button onClick={dismissRenewalNotice} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("renewalNoticeDismiss")}</button>
          </div>
        </div>
      )}

      {returnDialog && (() => {
        const r = returnDialog.receipt;
        const wasPaid = r.paid !== false;
        const isSplit = r.paymentMethod === "split" && Array.isArray(r.splitPayments) && r.splitPayments.length > 0;
        const options = [
          ...(isSplit ? [{ id: "same", label: `${t("returnMethodSplit")}: ${r.splitPayments.map((sp) => `${t(`payment_${sp.method}`)} ${money(sp.amount)}`).join(" + ")}` }] : []),
          ...PAYMENT_METHODS.map((m) => ({ id: m.id, label: t(`payment_${m.id}`) })),
        ];
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setReturnDialog(null)}>
            <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, textAlign: "center" }}>
                {t(returnDialog.action === "cancel" ? "confirm_cancelOrder" : "confirm_refundOrder", { n: r.ticketNo })}
              </div>
              {wasPaid ? (
                <>
                  <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("returnMethodTitle")} &middot; {money(r.total)}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                    {options.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setReturnDialog((d) => ({ ...d, method: o.id }))}
                        style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${returnDialog.method === o.id ? theme.primary : "#C9C2B2"}`, background: returnDialog.method === o.id ? "rgba(176,141,87,0.18)" : "transparent", color: COLORS.charcoal, fontSize: 13, fontWeight: returnDialog.method === o.id ? 600 : 400, cursor: "pointer", textAlign: isRtl ? "right" : "left" }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 18, textAlign: "center" }}>{t("returnNothingToReturn")}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setReturnDialog(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #C9C2B2", background: "transparent", color: COLORS.charcoal, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("cancel")}</button>
                <button onClick={confirmReturnDialog} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("confirmAction")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {closingCountOpen && (() => {
        const n = parseFloat(closingCountDraft);
        const valid = closingCountDraft.trim() !== "" && Number.isFinite(n) && n >= 0;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }}>
            <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 360, textAlign: "center" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{t("closingCountTitle")}</div>
              <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 16, lineHeight: 1.5 }}>{t("closingCountSubtitle")}</div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                autoFocus
                value={closingCountDraft}
                onChange={(e) => setClosingCountDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && valid) performClockOut(Math.round(n * 100) / 100); }}
                placeholder={t("openingCountPlaceholder")}
                style={{ width: "100%", boxSizing: "border-box", textAlign: "center", fontSize: 20, fontFamily: "IBM Plex Mono, monospace", padding: "12px 10px", borderRadius: 8, border: "1px solid #C9C2B2", background: "#FFFFFF", color: "#111111", marginBottom: 16 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setClosingCountOpen(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #C9C2B2", background: "transparent", color: COLORS.charcoal, fontSize: 13, cursor: "pointer" }}>{t("cancel")}</button>
                <button disabled={!valid} onClick={() => performClockOut(Math.round(n * 100) / 100)} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5 }}>{t("closingCountConfirm")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setConfirmDialog(null)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>{confirmDialog.message}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #C9C2B2", background: "transparent", color: COLORS.charcoal, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("cancel")}</button>
              <button
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {t("confirmAction")}
              </button>
            </div>
          </div>
        </div>
      )}

      {tabPinPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 95, padding: 20 }} onClick={() => setTabPinPrompt(null)}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 320, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{t("enterManagerPinTitle")}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20 }}>{t("enterManagerPinHint", { tab: t(`tab_${tabPinPrompt}`) })}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: tabPinError ? 6 : 22 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${theme.secondary}`, background: i < tabPinInput.length ? theme.secondary : "transparent" }} />
              ))}
            </div>
            {tabPinError && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 16 }}>{t("managerPinIncorrect")}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16, direction: "ltr" }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => { setTabPinError(false); setTabPinInput((p) => (p.length < 4 ? p + d : p)); }}
                  style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setTabPinPrompt(null)} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>{t("cancel")}</button>
              <button
                onClick={() => { setTabPinError(false); setTabPinInput((p) => (p.length < 4 ? p + "0" : p)); }}
                style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
              >
                0
              </button>
              <button onClick={() => setTabPinInput((p) => p.slice(0, -1))} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>&larr;</button>
            </div>
          </div>
        </div>
      )}

      {whatsappFallback && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setWhatsappFallback(null)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 24, width: "100%", maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{t("whatsappFallbackTitle")}</div>
            <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 14, lineHeight: 1.5 }}>{t("whatsappFallbackSubtitle")}</div>
            <div style={{ fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 6 }}>{t("smsFallbackTo", { name: whatsappFallback.name, phone: whatsappFallback.phone })}</div>
            <div style={{ background: "#F1ECE0", border: "1px solid #DCD5C4", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.5, marginBottom: 14, userSelect: "all" }}>{whatsappFallback.message}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href={`https://wa.me/${whatsappFallback.phone}?text=${encodeURIComponent(whatsappFallback.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}
              >
                {t("openWhatsApp")}
              </a>
              <button onClick={copyWhatsAppMessage} style={{ padding: "10px 0", borderRadius: 8, border: `1px solid ${COLORS.charcoal}`, background: "transparent", color: COLORS.charcoal, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                {whatsappCopied ? t("copied") : t("copyMessage")}
              </button>
              <button onClick={() => setWhatsappFallback(null)} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: COLORS.charcoalSoft, fontSize: 12.5, cursor: "pointer" }}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      {view === "website" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 1100 }}>
          <WebsiteSettingsPanel
            tenantId={tenantId}
            isRtl={isRtl}
            isMobile={isMobile}
            theme={theme}
            brand={{ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: secondaryColor }}
            loadKey={async (key) => {
              try {
                const r = await getSharedWithRetry(storage, key);
                return r?.value ? JSON.parse(r.value) : null;
              } catch (e) {
                return null;
              }
            }}
            saveKey={(key, obj) => syncSet(key, JSON.stringify(obj), true, t("syncLabelSettings"))}
            resizeImage={resizeImageToDataUrl}
            flashNotice={flashNotice}
            copyText={copyTextToClipboard}
          />
        </div>
      )}

      {view === "settings" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 620 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("settingsTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("settingsSubtitle")}</div>
          </div>

          {!brandingLoaded ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("restaurantNameLabel")}</div>
                <input type="text" value={restaurantName} onChange={(e) => updateRestaurantName(e.target.value)} onFocus={handleNameFocus} onBlur={handleNameBlur} placeholder={t("restaurantNamePlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("logoLabel")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt={restaurantName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: 10.5, color: "#5A5F6A", textAlign: "center", padding: 4 }}>{t("logoLabel")}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, padding: "8px 14px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", textAlign: "center" }}>
                      {logoUrl ? t("changeLogo") : t("uploadLogo")}
                      <input type="file" accept="image/*" onChange={(e) => handleLogoFile(e.target.files?.[0])} style={{ display: "none" }} />
                    </label>
                    {logoUrl && (
                      <button onClick={removeLogo} style={{ fontSize: 12, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("removeLogoBtn")}</button>
                    )}
                  </div>
                </div>
                {!logoUrl && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }}>{t("noLogoUploaded")}</div>}
              </div>

              {hasFeature("googleMapsDirections") && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("locationLabel")}</div>
                <input type="text" value={mapsLink} onChange={(e) => updateMapsLink(e.target.value)} placeholder={t("locationPlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>{t("locationHint")}</div>
              </div>
              )}

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("phoneNumberLabel")}</div>
                <input type="tel" value={phoneNumber} onChange={(e) => updatePhoneNumber(e.target.value)} placeholder={t("phoneNumberPlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>{t("phoneNumberHint")}</div>
              </div>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("primaryColorLabel")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="color" value={primaryColor} onChange={(e) => updatePrimaryColor(e.target.value)} style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
                    <input type="text" value={primaryColor} onChange={(e) => updatePrimaryColor(e.target.value)} className="field" style={{ width: 100, fontFamily: "IBM Plex Mono, monospace" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>{t("primaryColorHint")}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("secondaryColorLabel")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="color" value={secondaryColor} onChange={(e) => updateSecondaryColor(e.target.value)} style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
                    <input type="text" value={secondaryColor} onChange={(e) => updateSecondaryColor(e.target.value)} className="field" style={{ width: 100, fontFamily: "IBM Plex Mono, monospace" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>{t("secondaryColorHint")}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("themeLabel")}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setUiTheme("dark")}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${uiTheme === "dark" ? theme.secondary : "var(--border)"}`, background: uiTheme === "dark" ? "rgba(176,141,87,0.18)" : "transparent", color: uiTheme === "dark" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("themeDark")}
                  </button>
                  <button
                    onClick={() => setUiTheme("light")}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${uiTheme === "light" ? theme.secondary : "var(--border)"}`, background: uiTheme === "light" ? "rgba(176,141,87,0.18)" : "transparent", color: uiTheme === "light" ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("themeLight")}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>{t("themeHint")}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("soundSettingTitle")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => toggleOrderSound(true)}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${orderSoundOn ? theme.secondary : "var(--border)"}`, background: orderSoundOn ? "rgba(176,141,87,0.18)" : "transparent", color: orderSoundOn ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("soundOn")}
                  </button>
                  <button
                    onClick={() => toggleOrderSound(false)}
                    style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${!orderSoundOn ? theme.secondary : "var(--border)"}`, background: !orderSoundOn ? "rgba(176,141,87,0.18)" : "transparent", color: !orderSoundOn ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                  >
                    {t("soundOff")}
                  </button>
                  <button onClick={playOrderChime} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>{t("soundTest")}</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>{t("soundSettingHint")}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("autoPrintTitle")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["none", "autoPrintNone"], ["receipt", "autoPrintReceipt"], ["kitchen", "autoPrintKitchen"], ["both", "autoPrintBoth"]].map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => changeAutoPrint(mode)}
                      style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${autoPrint === mode ? theme.secondary : "var(--border)"}`, background: autoPrint === mode ? "rgba(176,141,87,0.18)" : "transparent", color: autoPrint === mode ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>{t("autoPrintHint")}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("kitchenWhereTitle")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {KITCHEN_MODES.filter((mode) => mode !== "off").map((mode) => (
                    <button
                      key={mode}
                      onClick={() => changeKitchenMode(mode)}
                      style={{ padding: "8px 16px", borderRadius: 7, border: `1px solid ${(kitchenMode === "off" ? "here" : kitchenMode) === mode ? theme.secondary : "var(--border)"}`, background: (kitchenMode === "off" ? "here" : kitchenMode) === mode ? "rgba(176,141,87,0.18)" : "transparent", color: (kitchenMode === "off" ? "here" : kitchenMode) === mode ? theme.secondaryLight : "var(--text-muted)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                    >
                      {t(`kitchenMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>{t(`kitchenHint_${kitchenMode === "off" ? "here" : kitchenMode}`)}</div>
                {kitchenMode !== "send" && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>{t("kitchenSilentTip")}</div>}
                {(kitchenMode === "station" || autoPrint === "kitchen" || autoPrint === "both") && (
                  <button onClick={printKitchenTestTicket} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>{t("kitchenTestPrint")}</button>
                )}
                {kitchenMode === "station" && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: theme.secondaryLight, marginBottom: 8 }}>{t("kitchenStationWaiting")}</div>
                    {kitchenRecent.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("kitchenRecentTitle")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {kitchenRecent.map((tk) => (
                            <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
                              <span>
                                {new Date(tk.at).toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })} · {tk.table || t("takeawayLabel")}{tk.ticketNo !== null && tk.ticketNo !== undefined ? ` · #${tk.ticketNo}` : ""} · {tk.items.reduce((s, it) => s + it.qty, 0)}
                              </span>
                              <button onClick={() => printKitchenTicket(tk)} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>{t("kitchenPrintAgain")}</button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("shiftHoursTitle")}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 10, lineHeight: 1.5 }}>{t("shiftHoursHint")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {WEEKDAY_KEYS.map((wd) => (
                    <div key={wd} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ width: 90, fontSize: 12.5, flexShrink: 0 }}>{t(`weekday_${wd}`)}</div>
                      <TimeSelects value={shiftHoursConfig[wd]?.start || "00:00"} onCommit={(v) => updateShiftHours(wd, "start", v)} />
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("shiftHoursToLabel")}</span>
                      <TimeSelects value={shiftHoursConfig[wd]?.end || "23:59"} onCommit={(v) => updateShiftHours(wd, "end", v)} />
                    </div>
                  ))}
                </div>
              </div>

              {hasFeature("vatService") && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("taxesTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 10 }}>{t("taxesHint")}</div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("vatPercentLabel")}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={vatPercent}
                          onChange={(e) => setVatPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="field"
                          style={{ width: 90 }}
                        />
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("servicePercentLabel")}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={servicePercent}
                          onChange={(e) => setServicePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="field"
                          style={{ width: 90 }}
                        />
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>{t("taxesOrderNote")}</div>
                </div>
              )}

              {isManager && hasFeature("tabAccessControl") && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("tabAccessTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12 }}>{t("tabAccessHint")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    {GATEABLE_TABS.map((key, i) => {
                      const gated = pinGatedTabs.includes(key);
                      return (
                        <div
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "11px 14px",
                            borderTop: i > 0 ? "1px solid #2C313C" : "none",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{t(`tab_${key}`)}</span>
                          <button
                            onClick={() => togglePinGatedTab(key)}
                            style={{
                              width: 40,
                              height: 22,
                              borderRadius: 999,
                              border: "none",
                              background: gated ? theme.primary : "var(--border)",
                              position: "relative",
                              cursor: "pointer",
                              padding: 0,
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                top: 2,
                                left: gated ? 20 : 2,
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                background: "#fff",
                                transition: "left .15s ease",
                              }}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("previewLabel")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, flexWrap: "wrap" }}>
                  {logoUrl && <img src={logoUrl} alt={restaurantName} style={{ height: 28, width: "auto", maxWidth: 120, objectFit: "contain", borderRadius: 4 }} />}
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>{restaurantName}</span>
                  <button style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 13, fontWeight: 600 }}>{t("saveOrder")}</button>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: theme.secondaryLight, color: "#5A431F" }}>{t("available", { n: 12 })}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {hasFeature("helpChat") && helpChatWidget}
    </div>
  );
}

// Read-only page a customer lands on after scanning a table's QR code. Deliberately minimal:
// branding + the live menu with stock badges, no cart, no ordering (per the "view only" scope
// chosen for v1) — reads shared storage so it reflects whatever the operator has actually set up,
// not the hardcoded starter menu.
function CustomerMenuView({ tableId, tenantId, callCenter = false, preview = false, bootstrap = null }) {
  // A null/undefined tableId means this is the general online-ordering link (shared on social
  // media), not a specific table's QR code — the customer chooses Pickup or Delivery instead of
  // it being assumed dine-in.
  const isGeneralLink = tableId === null || tableId === undefined;
  const storage = useMemo(() => createTenantStorage(tenantId), [tenantId]);
  // When the restaurant has published the website look, the server hands the first paint its
  // settings and branding (see app/t/[tenantId]/page.jsx) so the page never flashes the original
  // layout first. Restaurants that haven't published it get null here and nothing below changes.
  const siteBoot = bootstrap && bootstrap.settings ? bootstrap : null;
  const [bootCache] = useState(() => readBoot(tenantId));
  const [lang, setLangState] = useState(siteBoot ? (siteBoot.settings.defaultLang === "en" ? "en" : "ar") : "ar");
  const langChosenRef = useRef(false);
  const setLang = (code) => {
    langChosenRef.current = true;
    setLangState(code);
  };
  const [restaurantName, setRestaurantName] = useState(siteBoot?.brand?.name || bootCache?.name || "");
  const [logoUrl, setLogoUrl] = useState(siteBoot?.brand?.logo || bootCache?.logo || null);
  const [primaryColor, setPrimaryColor] = useState(siteBoot?.brand?.primary || bootCache?.primary || COLORS.burgundy);
  const [secondaryColor, setSecondaryColor] = useState(siteBoot?.brand?.secondary || bootCache?.secondary || COLORS.brass);
  const [mapsLink, setMapsLink] = useState(siteBoot?.brand?.mapsLink || "");
  const [phoneNumber, setPhoneNumber] = useState(siteBoot?.brand?.phone || "");
  const [siteSettings, setSiteSettings] = useState(siteBoot ? mergeSiteSettings(siteBoot.settings) : null);
  const [siteMedia, setSiteMedia] = useState(siteBoot?.media || null);
  const [siteShiftHours, setSiteShiftHours] = useState(null);
  const siteActive = !callCenter && !!siteSettings && (preview || !!siteSettings.enabled);
  const siteOnRef = useRef(siteActive);
  siteOnRef.current = siteActive;
  const lastMenuFetchRef = useRef(0);
  const [categories, setCategories] = useState([]);
  const [menu, setMenu] = useState({});
  const [availability, setAvailability] = useState({}); // { [itemId]: true|false } — boolean only, never raw stock
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [vatPercent, setVatPercent] = useState(0);
  const [servicePercent, setServicePercent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false); // the "Request the bill" modal, table QR view only
  const [checkoutMethod, setCheckoutMethod] = useState("cash");
  const [checkoutTab, setCheckoutTab] = useState(null); // { items } | null — this table's confirmed running order, fetched on demand
  const [checkoutUnpaidReceipts, setCheckoutUnpaidReceipts] = useState([]); // receipts staff already saved for this table but haven't collected payment for yet
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const [cart, setCart] = useState({}); // { [itemId]: { qty, note } }
  const [editingNoteItemId, setEditingNoteItemId] = useState(null);
  const [deliveryMethodChoice, setDeliveryMethodChoice] = useState(null); // "pickup" | "delivery" | null
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [onlineCustomerName, setOnlineCustomerName] = useState("");
  const [onlineCustomerPhone, setOnlineCustomerPhone] = useState("");
  const [onlineCustomerAddress, setOnlineCustomerAddress] = useState("");
  const [customerInfoError, setCustomerInfoError] = useState(false);
  const [zoneChoiceError, setZoneChoiceError] = useState(false);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState(null); // this device's last submitted order — polled below for staff confirmation
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  // Starts optimistic — see the identical reasoning in POSPrototype. navigator.onLine can wrongly
  // report offline inside embedded WebViews (like the Claude mobile app's artifact preview), and
  // here that bug is worse than cosmetic: it was hard-blocking every order submission before even
  // attempting one. The real check now happens at submit time against the actual result of trying
  // to send — see submitOrder below.
  const [isOnline, setIsOnline] = useState(true);

  // Call center mode (?callcenter=1): the online-ordering page plus staff sign-in and customer
  // database search. Agents pick their name from the staff roster and enter its PIN; the choice is
  // kept for this browser tab only. Orders they send carry source "callcenter" and the agent's name.
  const [agent, setAgent] = useState(() => {
    if (!callCenter) return null;
    try {
      return JSON.parse(window.sessionStorage.getItem("callcenter-agent") || "null");
    } catch (e) {
      return null;
    }
  });
  const [ccRoster, setCcRoster] = useState([]);
  const [ccPickedId, setCcPickedId] = useState(null);
  const [ccPin, setCcPin] = useState("");
  const [ccPinError, setCcPinError] = useState(false);
  const [ccCustomers, setCcCustomers] = useState({});
  const [ccShowSuggestions, setCcShowSuggestions] = useState(false);
  const [ccRecognized, setCcRecognized] = useState(null);

  useEffect(() => {
    if (!callCenter) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getSharedWithRetry(storage, "staff-roster");
        if (!cancelled) setCcRoster(r?.value ? JSON.parse(r.value) : []);
      } catch (e) {
        // the sign-in screen just shows no names until the roster can be read
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!callCenter || !agent) return;
    let cancelled = false;
    const loadCustomers = async () => {
      try {
        const r = await storage.get("customers-directory", false);
        if (!cancelled) setCcCustomers(r?.value ? JSON.parse(r.value) : {});
      } catch (e) {
        // keep the last list we had
      }
    };
    loadCustomers();
    const interval = setInterval(loadCustomers, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agent]);
  const ccMatches = useMemo(() => {
    const q = onlineCustomerPhone.trim().toLowerCase();
    if (!callCenter || !q) return [];
    return Object.values(ccCustomers).filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 6);
  }, [onlineCustomerPhone, ccCustomers]);
  const ccTryLogin = (pin) => {
    const emp = ccRoster.find((e) => e.id === ccPickedId);
    if (emp && String(emp.pin) === pin) {
      const a = { id: emp.id, name: emp.name };
      try {
        window.sessionStorage.setItem("callcenter-agent", JSON.stringify(a));
      } catch (e) {
        // fine — they'll just sign in again after a refresh
      }
      setAgent(a);
      setCcPin("");
      setCcPinError(false);
    } else {
      setCcPinError(true);
      setCcPin("");
    }
  };
  const ccSignOut = () => {
    try {
      window.sessionStorage.removeItem("callcenter-agent");
    } catch (e) {
      // nothing to clean up
    }
    setAgent(null);
    setCcPickedId(null);
    setCcPin("");
    setCcRecognized(null);
  };
  const ccPressDigit = (d) => {
    if (ccPin.length >= 4) return;
    const next = ccPin + d;
    setCcPin(next);
    setCcPinError(false);
    if (next.length === 4) setTimeout(() => ccTryLogin(next), 120);
  };
  const ccBackToNames = () => {
    setCcPickedId(null);
    setCcPin("");
    setCcPinError(false);
  };
  // Physical keyboard (including the numpad) works on the PIN screen: digits enter the PIN,
  // Backspace removes the last one, Escape goes back to the name list.
  useEffect(() => {
    if (!callCenter || agent || !ccPickedId) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        ccPressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setCcPin((p) => p.slice(0, -1));
      } else if (e.key === "Escape") {
        ccBackToNames();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agent, ccPickedId, ccPin, ccRoster]);
  const ccFillFromCustomer = (c) => {
    setOnlineCustomerName(c.name || "");
    setOnlineCustomerPhone(c.phone || "");
    setOnlineCustomerAddress(c.address || "");
    setCcRecognized(c);
    setCcShowSuggestions(false);
  };
  const ccHandlePhoneChange = (value) => {
    setOnlineCustomerPhone(value);
    setCcShowSuggestions(true);
    setCcRecognized(null);
    const match = ccCustomers[value.trim()];
    if (match && !onlineCustomerName && !onlineCustomerAddress) ccFillFromCustomer(match);
  };

  // The browser's online/offline events are still a useful hint (kept below), but this view no
  // longer treats them as authoritative for gating submission — only an actual failed submit
  // attempt does that now, so nobody with a perfectly good connection gets wrongly blocked.
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // This view reads a deliberately narrow set of shared keys: branding (name, logo, colors),
  // menu (category/item names and prices only — recipe data is stripped below before it ever
  // reaches state), a boolean-only availability flag per item, and — for the general link only —
  // delivery zone labels and fees. It never reads ingredient names, stock counts, table names,
  // staff records, or shift history. Orders submitted here go into a separate shared key
  // ("pending-orders") that only the staff app reads.
  useEffect(() => {
    let cancelled = false;
    const versions = {};
    const imgUrl = (params, version) => `/api/pos/${encodeURIComponent(tenantId)}/site-image?${params}&v=${encodeURIComponent(version || "0")}`;
    const applyKey = (key, value, version) => {
      if (!value) return;
      if (key === "restaurant-branding") {
        const b = JSON.parse(value);
        setRestaurantName(b.name || "");
        setLogoUrl(b.logo || null);
        setPrimaryColor(b.primary || COLORS.burgundy);
        setSecondaryColor(b.secondary || COLORS.brass);
        setMapsLink(b.mapsLink || "");
        setPhoneNumber(b.phone || "");
        if (b.name) writeBoot(tenantId, { name: b.name, logo: b.logo && b.logo.length < 650000 ? b.logo : null, primary: b.primary || COLORS.burgundy, secondary: b.secondary || COLORS.brass });
      } else if (key === "menu-config") {
        const m = JSON.parse(value);
        setCategories(orderCategoriesByMain(m.categories || [], cleanMains(m.mainCategories)));
        // Strip anything beyond name/tag/price before it ever reaches component state — recipe data
        // (ingredient IDs and quantities) rides along in the same shared record for the staff app's use,
        // but this view has no reason to hold onto it.
        const publicMenu = {};
        Object.keys(m.menu || {}).forEach((cat) => {
          publicMenu[cat] = (m.menu[cat] || []).map((item) =>
            siteOnRef.current
              ? { id: item.id, name: item.name, tag: item.tag, price: item.price, image: item.hasImage ? imgUrl(`type=item&id=${encodeURIComponent(item.id)}`, version) : null, badges: Array.isArray(item.badges) ? item.badges : [], featured: !!item.featured }
              : { id: item.id, name: item.name, tag: item.tag, price: item.price }
          );
        });
        setMenu(publicMenu);
      } else if (key === "menu-availability") {
        setAvailability(JSON.parse(value));
      } else if (key === "delivery-zones-config") {
        setDeliveryZones(JSON.parse(value));
      } else if (key === "tax-config") {
        const parsed = JSON.parse(value);
        setVatPercent(Number(parsed.vatPercent) || 0);
        setServicePercent(Number(parsed.servicePercent) || 0);
      } else if (key === "website-media") {
        const meta = JSON.parse(value);
        setSiteMedia({
          cover: meta.cover ? imgUrl("type=cover", version) : null,
          gallery: Array.from({ length: Number(meta.gallery) || 0 }, (_, i) => imgUrl(`type=gallery&i=${i}`, version)),
        });
      } else if (key === "shift-hours-config") {
        setSiteShiftHours(JSON.parse(value));
      }
    };
    const baseKeys = ["restaurant-branding", "menu-config", "menu-availability", "tax-config", ...(isGeneralLink ? ["delivery-zones-config"] : [])];
    const keysNow = () => [...baseKeys, ...(callCenter ? [] : ["website-settings"]), ...(!callCenter && siteOnRef.current ? ["website-media", "shift-hours-config"] : [])];
    // One request carries every record this page needs; later checks come back empty unless something
    // changed (a price, an item, stock, the website look), so a page left open costs almost nothing.
    const run = async (attempts) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const keys = keysNow();
          const results = await storage.getMany(keys, versions);
          if (cancelled) return true;
          keys.forEach((k) => {
            const r = results[k];
            if (!r || r.unchanged) return;
            versions[k] = r.updated_at || "none";
            if (k === "website-settings") {
              const merged = mergeSiteSettings(r.value ? JSON.parse(r.value) : null);
              setSiteSettings(merged);
              if (merged.enabled || preview) {
                if (!langChosenRef.current) setLangState(merged.defaultLang === "en" ? "en" : "ar");
              }
            } else {
              applyKey(k, r.value, r.updated_at);
            }
          });
          return true;
        } catch (e) {
          if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
        }
      }
      return false;
    };
    run(3).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      run(1);
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Once an order's been sent, poll the same shared pending-orders list staff reviews from, to
  // pick up the moment staff confirms it (see markPendingOrderConfirmed in POSPrototype) — that's
  // how the "order confirmed, being prepared" feedback below reaches this device without the
  // customer needing to do anything.
  useEffect(() => {
    if (!submittedOrderId) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const result = await storage.get("pending-orders", true);
        const list = result?.value ? JSON.parse(result.value) : [];
        const mine = list.find((o) => o.id === submittedOrderId);
        if (!cancelled && mine?.status === "confirmed") setOrderConfirmed(true);
      } catch (e) {
        // offline or a transient failure — just retry on the next tick
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [submittedOrderId, storage]);

  const t = (key, vars) => {
    const template = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
  };
  const isRtl = lang === "ar";
  const theme = { primary: primaryColor, secondary: secondaryColor, secondaryLight: lighten(secondaryColor, 0.42) };

  const allItems = useMemo(() => {
    const map = {};
    Object.values(menu).forEach((items) => (items || []).forEach((it) => (map[it.id] = it)));
    return map;
  }, [menu]);
  const cartLines = Object.entries(cart)
    .filter(([, v]) => v.qty > 0)
    .map(([id, v]) => ({ ...allItems[id], qty: v.qty, note: v.note || "" }))
    .filter((line) => line.id);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.price * l.qty, 0);
  const changeQty = (item, delta) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[item.id]?.qty || 0) + delta);
      return { ...prev, [item.id]: { qty: next, note: prev[item.id]?.note || "" } };
    });
  };
  const updateCartItemNote = (itemId, note) => {
    setCart((prev) => ({ ...prev, [itemId]: { qty: prev[itemId]?.qty || 0, note } }));
  };

  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId) || null;
  const deliveryFeeAmount = deliveryMethodChoice === "delivery" && selectedZone ? Number(selectedZone.fee) || 0 : 0;
  // Same math as the POS terminal (see the equivalent computation in POSPrototype) — service on
  // the item subtotal, VAT on top of that; delivery fee is added after, untaxed.
  const serviceAmt = Math.round(cartTotal * (servicePercent / 100) * 100) / 100;
  const vatAmt = Math.round((cartTotal + serviceAmt) * (vatPercent / 100) * 100) / 100;
  const orderTotal = cartTotal + serviceAmt + vatAmt + deliveryFeeAmount;

  const submitOrder = async () => {
    if (cartCount === 0) return;
    if (isGeneralLink) {
      if (!deliveryMethodChoice) return; // button is disabled in this state, but guard anyway
      if (deliveryMethodChoice === "delivery" && !selectedZone) {
        setSendError(false);
        setCustomerInfoError(false);
        flashChoiceError();
        return;
      }
      // Delivery needs the same name/phone/address a cashier would collect for a walk-in
      // delivery order — pickup doesn't, since the customer is coming to collect it themselves.
      if (deliveryMethodChoice === "delivery" && (!onlineCustomerName.trim() || !onlineCustomerPhone.trim() || !onlineCustomerAddress.trim())) {
        setSendError(false);
        setCustomerInfoError(true);
        setTimeout(() => setCustomerInfoError(false), 2500);
        return;
      }
      if (callCenter && deliveryMethodChoice === "pickup" && !onlineCustomerPhone.trim()) {
        setSendError(false);
        setCustomerInfoError(true);
        setTimeout(() => setCustomerInfoError(false), 2500);
        return;
      }
    }
    // No longer pre-blocked on the isOnline flag — that check was gating the button on
    // navigator.onLine's initial snapshot, which can be wrong inside embedded WebViews. Now every
    // tap genuinely attempts the send; isOnline (and any error shown) reflects what actually
    // happened, not a guess made before even trying.
    setSending(true);
    setSendError(false);
    try {
      const existing = await storage.get("pending-orders", true).catch(() => null);
      const list = existing?.value ? JSON.parse(existing.value) : [];
      const order = {
        id: `${callCenter ? "cc" : "qr"}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        source: callCenter ? "callcenter" : isGeneralLink ? "online" : "qr",
        agent: callCenter ? agent : null,
        tableId: isGeneralLink ? (deliveryMethodChoice === "delivery" ? "delivery" : null) : tableId,
        items: cartLines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty, note: l.note || "" })),
        deliveryMethod: isGeneralLink ? deliveryMethodChoice : null,
        deliveryFee: isGeneralLink ? deliveryFeeAmount : 0,
        deliveryZoneLabel: isGeneralLink && deliveryMethodChoice === "delivery" ? selectedZone?.label || "" : "",
        customer: (isGeneralLink && deliveryMethodChoice === "delivery") || (callCenter && onlineCustomerPhone.trim())
          ? { name: onlineCustomerName.trim(), phone: onlineCustomerPhone.trim(), address: onlineCustomerAddress.trim() }
          : null,
        submittedAt: new Date().toISOString(),
      };
      await storage.set("pending-orders", JSON.stringify([...list, order]), true);
      setIsOnline(true); // it just worked — whatever the flag said before, we're clearly connected
      setCart({});
      if (callCenter) {
        // Ready for the next caller.
        setOnlineCustomerName("");
        setOnlineCustomerPhone("");
        setOnlineCustomerAddress("");
        setCcRecognized(null);
        setDeliveryMethodChoice(null);
        setSelectedZoneId("");
      }
      setJustSent(true);
      setOrderConfirmed(false);
      setSubmittedOrderId(order.id);
    } catch (e) {
      setIsOnline(false);
      setSendError(true);
    } finally {
      setSending(false);
    }
  };
  const flashChoiceError = () => {
    setZoneChoiceError(true);
    setTimeout(() => setZoneChoiceError(false), 2500);
  };

  // "Request the bill" — reads two sources and merges them, because the moment staff save an
  // order the shared "table-tab:<id>" cart is cleared (see persistTableTab/saveOrder in
  // POSPrototype), even when that order was saved as "pay later" and is still an outstanding
  // bill. So this pulls (1) the live, not-yet-saved running tab, same as before, and (2) any
  // already-saved-but-unpaid receipts for this table from this month's history (matched via the
  // receipt's own tableId field) — otherwise a customer who asks for the bill right after staff
  // ring in a pay-later order sees "no confirmed orders" despite there being a real bill to pay.
  const openCheckout = async () => {
    setCheckoutOpen(true);
    setCheckoutRequested(false);
    setCheckoutLoading(true);
    try {
      const [tabRes, receiptsRes] = await Promise.all([
        storage.get(`table-tab:${tableId}`),
        storage.get(`receipts:${new Date().toISOString().slice(0, 7)}`, false),
      ]);
      const parsed = tabRes?.value ? JSON.parse(tabRes.value) : null;
      setCheckoutTab({ items: parsed?.items || [] });
      const receipts = receiptsRes?.value ? JSON.parse(receiptsRes.value) : [];
      setCheckoutUnpaidReceipts(receipts.filter((r) => r.status === "completed" && r.paid === false && r.tableId === tableId));
    } catch (e) {
      setCheckoutTab({ items: [] });
      setCheckoutUnpaidReceipts([]);
    } finally {
      setCheckoutLoading(false);
    }
  };
  const checkoutItems = checkoutTab?.items || [];
  const checkoutSubtotal = checkoutItems.reduce((s, it) => s + it.price * it.qty, 0);
  const checkoutService = Math.round(checkoutSubtotal * (servicePercent / 100) * 100) / 100;
  const checkoutVat = Math.round((checkoutSubtotal + checkoutService) * (vatPercent / 100) * 100) / 100;
  const checkoutLiveTotal = checkoutSubtotal + checkoutService + checkoutVat;
  // Each unpaid receipt carries its own already-computed total (its own snapshotted tax/service
  // rates at the time it was saved) — reuse that rather than re-deriving from live rates, so this
  // matches exactly what the POS terminal will actually collect for that order.
  const checkoutUnpaidTotal = checkoutUnpaidReceipts.reduce((s, r) => s + r.total, 0);
  const checkoutTotal = checkoutLiveTotal + checkoutUnpaidTotal;
  const checkoutHasAnything = checkoutItems.length > 0 || checkoutUnpaidReceipts.length > 0;

  const submitCheckoutRequest = async () => {
    setCheckoutSubmitting(true);
    setCheckoutError(false);
    try {
      const existing = await storage.get("checkout-requests").catch(() => null);
      const list = existing?.value ? JSON.parse(existing.value) : [];
      const next = [...list.filter((r) => r.tableId !== tableId), { id: `co_${Date.now()}`, tableId, paymentMethod: checkoutMethod, requestedAt: new Date().toISOString() }];
      const ok = await storage.set("checkout-requests", JSON.stringify(next));
      if (!ok) throw new Error("failed");
      setCheckoutRequested(true);
    } catch (e) {
      setCheckoutError(true);
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  if (callCenter && !agent) {
    const picked = ccRoster.find((e) => e.id === ccPickedId) || null;
    const pressDigit = ccPressDigit;
    return (
      <div dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: COLORS.ink, minHeight: "100vh", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{restaurantName}</div>
          <div style={{ fontSize: 14, color: theme.secondaryLight, marginBottom: 22 }}>{t("callCenterSignInTitle")}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 18 }}>
            {["en", "ar"].map((code) => (
              <button key={code} onClick={() => setLang(code)} style={{ padding: "5px 11px", borderRadius: 999, border: "1px solid var(--border)", background: lang === code ? theme.primary : "transparent", color: lang === code ? COLORS.paper : "var(--text-muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{code === "en" ? "EN" : "AR"}</button>
            ))}
          </div>
          {!picked ? (
            <>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10 }}>{t("callCenterPickName")}</div>
              {ccRoster.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("callCenterNoStaff")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ccRoster.map((e) => (
                    <button key={e.id} onClick={() => { setCcPickedId(e.id); setCcPin(""); setCcPinError(false); }} style={{ padding: "13px 0", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 15, cursor: "pointer" }}>{e.name}</button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{picked.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>{t("callCenterEnterPin")}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 10 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${ccPinError ? COLORS.red : theme.secondary}`, background: i < ccPin.length ? theme.secondary : "transparent", display: "inline-block" }} />
                ))}
              </div>
              <div style={{ height: 18, fontSize: 12, color: "#E3A79C", marginBottom: 6 }}>{ccPinError ? t("callCenterWrongPin") : ""}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button key={d} onClick={() => pressDigit(d)} style={{ padding: "15px 0", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 19, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}>{d}</button>
                ))}
                <button onClick={() => { setCcPickedId(null); setCcPin(""); setCcPinError(false); }} style={{ padding: "15px 0", borderRadius: 9, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>{t("callCenterBack")}</button>
                <button onClick={() => pressDigit("0")} style={{ padding: "15px 0", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 19, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}>0</button>
                <button onClick={() => setCcPin((p) => p.slice(0, -1))} style={{ padding: "15px 0", borderRadius: 9, border: "none", background: "transparent", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>&larr;</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const billModal = (
    <>
      {checkoutOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setCheckoutOpen(false)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 26, width: "100%", maxWidth: 380, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            {checkoutRequested ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{t("checkoutRequestedTitle")}</div>
                <div style={{ fontSize: 13, color: COLORS.charcoalSoft, marginBottom: 6, lineHeight: 1.5 }}>{t("checkoutRequestedBody")}</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, margin: "14px 0" }}>{money(checkoutTotal)}</div>
                <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 20 }}>{t(`payment_${checkoutMethod}`)}</div>
                <button onClick={() => setCheckoutOpen(false)} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("orderSentOk")}</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{t("checkoutModalTitle")}</div>
                <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginBottom: 16, lineHeight: 1.4 }}>{t("checkoutModalNote")}</div>
                {checkoutLoading ? (
                  <div style={{ fontSize: 13, color: COLORS.charcoalSoft, padding: "12px 0" }}>{t("loading")}</div>
                ) : !checkoutHasAnything ? (
                  <div style={{ fontSize: 13, color: COLORS.charcoalSoft, padding: "12px 0" }}>{t("checkoutEmptyItems")}</div>
                ) : (
                  <>
                    {checkoutUnpaidReceipts.map((r) => (
                      <div key={r.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10.5, color: COLORS.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("ticketNumber", { n: r.ticketNo })}</div>
                        {r.items.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span>{it.qty}&times; {it.name}</span>
                            <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(it.price * it.qty)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {checkoutItems.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{it.qty}&times; {it.name}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(it.price * it.qty)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px dashed #D8D0BE", marginTop: 10, paddingTop: 10 }}>
                      {checkoutItems.length > 0 && (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("subtotal")}</span><span>{money(checkoutSubtotal)}</span></div>
                          {servicePercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("serviceCharge")} ({servicePercent}%)</span><span>{money(checkoutService)}</span></div>}
                          {vatPercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("vat")} ({vatPercent}%)</span><span>{money(checkoutVat)}</span></div>}
                        </>
                      )}
                      {checkoutUnpaidReceipts.length > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("checkoutPreviousOrders")}</span><span>{money(checkoutUnpaidTotal)}</span></div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, marginTop: 4 }}>
                        <span>{t("total")}</span><span>{money(checkoutTotal)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("paymentMethodLabel")}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setCheckoutMethod(m.id)}
                            style={{ flex: "1 1 70px", padding: "9px 0", borderRadius: 7, border: `1px solid ${checkoutMethod === m.id ? theme.secondary : "#DCD5C4"}`, background: checkoutMethod === m.id ? "rgba(176,141,87,0.18)" : "transparent", color: checkoutMethod === m.id ? "#8A6A2E" : COLORS.charcoal, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                          >
                            {t(`payment_${m.id}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {checkoutError && <div style={{ fontSize: 11.5, color: "#A6534A", marginTop: 12 }}>{t("checkoutRequestFailed")}</div>}
                    <button
                      onClick={submitCheckoutRequest}
                      disabled={checkoutSubmitting}
                      style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: checkoutSubmitting ? "default" : "pointer", opacity: checkoutSubmitting ? 0.7 : 1 }}
                    >
                      {t("checkoutRequestButton")}
                    </button>
                  </>
                )}
                <button onClick={() => setCheckoutOpen(false)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: COLORS.charcoalSoft, fontSize: 12.5, cursor: "pointer", marginTop: 8 }}>{t("close")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

  // A device that has never seen this restaurant waits for its real details instead of showing stock ones.
  // A restaurant that never set its own name shows the one it was registered under.
  useEffect(() => {
    if (!loaded || restaurantName) return;
    fetch(`/api/pos/${encodeURIComponent(tenantId)}/status`).then((r) => r.json()).then((st) => { if (st?.restaurant_name) setRestaurantName((cur) => cur || st.restaurant_name); }).catch(() => {});
  }, [loaded]);
  if (!loaded && !siteBoot && !bootCache) return <BootLoader />;

  // The published website look. Everything it shows and does comes from the state above, so ordering
  // behaves exactly like the original page — only the presentation is different.
  if (siteActive) {
    return (
      <SiteView
        lang={lang}
        setLang={setLang}
        isRtl={isRtl}
        t={t}
        money={money}
        site={siteSettings}
        media={siteMedia}
        brand={{ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: secondaryColor, phone: phoneNumber }}
        mapsHref={buildMapsHref(mapsLink) || ""}
        shiftHours={siteShiftHours}
        categories={categories}
        menu={menu}
        availability={availability}
        loaded={loaded}
        cart={cart}
        changeQty={changeQty}
        updateCartItemNote={updateCartItemNote}
        cartLines={cartLines}
        cartCount={cartCount}
        cartTotal={cartTotal}
        serviceAmt={serviceAmt}
        vatAmt={vatAmt}
        deliveryFeeAmount={deliveryFeeAmount}
        orderTotal={orderTotal}
        servicePercent={servicePercent}
        vatPercent={vatPercent}
        isGeneralLink={isGeneralLink}
        tableId={tableId}
        deliveryZones={deliveryZones}
        deliveryMethodChoice={deliveryMethodChoice}
        setDeliveryMethodChoice={setDeliveryMethodChoice}
        selectedZoneId={selectedZoneId}
        setSelectedZoneId={setSelectedZoneId}
        customer={{ name: onlineCustomerName, phone: onlineCustomerPhone, address: onlineCustomerAddress, setName: setOnlineCustomerName, setPhone: setOnlineCustomerPhone, setAddress: setOnlineCustomerAddress }}
        zoneChoiceError={zoneChoiceError}
        customerInfoError={customerInfoError}
        submitOrder={preview ? () => {} : submitOrder}
        sending={sending}
        sendError={sendError}
        isOnline={isOnline}
        justSent={justSent}
        setJustSent={setJustSent}
        orderConfirmed={orderConfirmed}
        dismissConfirmed={() => { setOrderConfirmed(false); setSubmittedOrderId(null); }}
        openBill={openCheckout}
        billModal={billModal}
        previewMode={preview}
      />
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: COLORS.ink, minHeight: "100vh", color: "var(--text-primary)", paddingBottom: cartCount > 0 ? 90 : 0 }}>
      <style>{FONTS}</style>
      <style>{`
        button { transition: filter .12s ease, background .15s ease, border-color .15s ease, transform .08s ease; }
        button:not(:disabled):hover { filter: brightness(1.14); }
        button:not(:disabled):active { transform: scale(0.98); }
        select:focus, input:focus { outline: none; border-color: ${theme.secondary} !important; box-shadow: 0 0 0 3px ${theme.secondary}33; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          {logoUrl && <img src={logoUrl} alt={restaurantName} style={{ height: 40, width: "auto", maxWidth: 140, objectFit: "contain", borderRadius: 4 }} />}
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600 }}>{restaurantName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 14, color: theme.secondaryLight, fontWeight: 500 }}>
            {callCenter ? t("callCenterHeading") : isGeneralLink ? t("onlineOrderingHeading") : t("viewingMenuFor", { table: t("tableNumbered", { n: tableId }) })}
          </div>
          <div style={{ display: "flex", background: "var(--surface)", borderRadius: 999, padding: 3, border: "1px solid var(--border)" }}>
            {["en", "ar"].map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{ padding: "5px 11px", borderRadius: 999, border: "none", background: lang === code ? theme.primary : "transparent", color: lang === code ? COLORS.paper : "var(--text-muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }}
              >
                {code === "en" ? "EN" : "AR"}
              </button>
            ))}
          </div>
        </div>

        {callCenter && agent && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
            <span>{t("callCenterSignedInAs", { name: agent.name })}</span>
            <button onClick={ccSignOut} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 999, color: "var(--text-muted)", fontSize: 11.5, padding: "4px 12px", cursor: "pointer" }}>{t("callCenterSignOut")}</button>
          </div>
        )}

        {orderConfirmed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, padding: "12px 16px", borderRadius: 10, border: "1px solid #4E7A47", background: "rgba(159,203,142,0.15)", color: "#9FCB8E" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>✅ {t("orderConfirmedBanner")}</div>
            <button
              onClick={() => { setOrderConfirmed(false); setSubmittedOrderId(null); }}
              style={{ background: "none", border: "none", color: "#9FCB8E", cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            >
              &times;
            </button>
          </div>
        )}

        {isGeneralLink && !callCenter && (buildMapsHref(mapsLink) || phoneNumber.trim()) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {buildMapsHref(mapsLink) && (
              <a
                href={buildMapsHref(mapsLink)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
              >
                📍 {t("getDirectionsButton")}
              </a>
            )}
            {phoneNumber.trim() && (
              <a
                href={`tel:${phoneNumber.replace(/[^\d+]/g, "")}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
              >
                📞 {t("callButton")}
              </a>
            )}
          </div>
        )}

        {callCenter && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 8 }}>{t("callCenterCustomerTitle")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="tel"
                value={onlineCustomerPhone}
                onChange={(e) => ccHandlePhoneChange(e.target.value)}
                onFocus={() => setCcShowSuggestions(true)}
                onBlur={() => setTimeout(() => setCcShowSuggestions(false), 150)}
                placeholder={t("phoneSearchPlaceholder")}
                style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
              />
              {ccShowSuggestions && onlineCustomerPhone.trim() && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg)" }}>
                  {ccMatches.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-faint)" }}>{t("noMatchesNewCustomer")}</div>
                  ) : (
                    ccMatches.map((c) => (
                      <button key={c.phone} onMouseDown={() => ccFillFromCustomer(c)} style={{ display: "block", width: "100%", textAlign: isRtl ? "right" : "left", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", padding: "9px 12px", cursor: "pointer", color: "var(--text-primary)" }}>
                        <div style={{ fontSize: 13 }}>{c.name || t("unnamed")}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "IBM Plex Mono, monospace" }}>{c.phone}{c.address ? ` · ${c.address}` : ""}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {ccRecognized && <div style={{ fontSize: 11.5, color: "#9FCB8E" }}>{t("callCenterReturning", { n: ccRecognized.orderCount || 0 })}</div>}
              <input
                type="text"
                value={onlineCustomerName}
                onChange={(e) => setOnlineCustomerName(e.target.value)}
                placeholder={t("namePlaceholder")}
                style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
              />
              <input
                type="text"
                value={onlineCustomerAddress}
                onChange={(e) => setOnlineCustomerAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
                style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
              />
            </div>
          </div>
        )}

        {isGeneralLink && (
          <div style={{ background: "var(--surface)", border: `1px solid ${zoneChoiceError ? COLORS.red : "var(--border)"}`, borderRadius: 10, padding: 14, marginBottom: 20, marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 8 }}>{t("fulfillmentMethod")}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: deliveryMethodChoice === "delivery" ? 10 : 0 }}>
              {["pickup", "delivery"].map((mth) => (
                <button
                  key={mth}
                  onClick={() => { setDeliveryMethodChoice(mth); if (mth === "pickup") setSelectedZoneId(""); }}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${deliveryMethodChoice === mth ? theme.secondary : "var(--border)"}`, background: deliveryMethodChoice === mth ? "rgba(176,141,87,0.18)" : "transparent", color: deliveryMethodChoice === mth ? theme.secondaryLight : "var(--text-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  {mth === "pickup" ? t("pickupOption") : t("deliveryOption")}
                </button>
              ))}
            </div>
            {deliveryMethodChoice === "delivery" && (
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>{t("chooseDeliveryZone")}</div>
                {deliveryZones.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{t("noZonesYet")}</div>
                ) : (
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
                  >
                    <option value="">{t("selectZonePlaceholder")}</option>
                    {deliveryZones.map((z) => (
                      <option key={z.id} value={z.id}>{z.label} — {money(z.fee)}</option>
                    ))}
                  </select>
                )}
                <div style={{ marginTop: 10, display: callCenter ? "none" : "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("deliveryDetailsLabel")}</div>
                  <input
                    type="text"
                    value={onlineCustomerName}
                    onChange={(e) => setOnlineCustomerName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
                  />
                  <input
                    type="tel"
                    value={onlineCustomerPhone}
                    onChange={(e) => setOnlineCustomerPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
                  />
                  <input
                    type="text"
                    value={onlineCustomerAddress}
                    onChange={(e) => setOnlineCustomerAddress(e.target.value)}
                    placeholder={t("addressPlaceholder")}
                    style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid var(--border)", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
                  />
                </div>
              </div>
            )}
            {zoneChoiceError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginTop: 8 }}>{t("notice_chooseZoneFirst")}</div>}
            {customerInfoError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginTop: 8 }}>{callCenter && deliveryMethodChoice === "pickup" ? t("callCenterPhoneRequired") : t("notice_deliveryDetailsRequired")}</div>}
          </div>
        )}

        {!callCenter && <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 6 }}>{t("customerMenuHint")}</div>}
        <div style={{ fontSize: 11, color: "#6E7580", marginBottom: !isGeneralLink ? 14 : 28, paddingBottom: !isGeneralLink ? 0 : 20, borderBottom: !isGeneralLink ? "none" : "1px solid #333945", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6FA86F", display: "inline-block" }} />
          {t("liveMenuNote")}
        </div>
        {!isGeneralLink && (
          <button
            onClick={openCheckout}
            style={{ display: "block", width: "100%", marginBottom: 28, padding: "12px 0", borderRadius: 8, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
          >
            {t("requestBillButton")}
          </button>
        )}

        {!loaded ? (
          <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{t("loading")}</div>
        ) : (
          categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 30 }}>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 12, color: theme.secondaryLight }}>{cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(menu[cat] || []).map((item) => {
                  const qty = cart[item.id]?.qty || 0;
                  const note = cart[item.id]?.note || "";
                  // Missing from the availability map (e.g. it hasn't synced yet) defaults to
                  // available rather than blocking ordering on a transient load gap.
                  const available = availability[item.id] !== false;
                  return (
                    <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 16px", opacity: available ? 1 : 0.6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <MenuThumb item={item} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{item.name}</div>
                          {item.tag && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>{item.tag}</div>}
                          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13.5, color: theme.secondaryLight, marginTop: 6 }}>{money(item.price)}</div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: available ? "#22301F" : "#3A2A28", color: available ? "#9FCB8E" : "#E3A79C", fontWeight: 500 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: available ? "#9FCB8E" : "#E3A79C", display: "inline-block" }} />
                            {available ? t("availableBadge") : t("notAvailableBadge")}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {qty > 0 && (
                            <>
                              <button onClick={() => changeQty(item, -1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontSize: 14 }}>&minus;</button>
                              <span style={{ fontFamily: "IBM Plex Mono, monospace", minWidth: 16, textAlign: "center" }}>{qty}</span>
                            </>
                          )}
                          <button
                            onClick={() => available && changeQty(item, 1)}
                            disabled={!available}
                            style={{ padding: qty > 0 ? "6px 10px" : "8px 14px", borderRadius: 6, border: "none", background: available ? theme.primary : "#4A4F5A", color: "var(--text-primary)", cursor: available ? "pointer" : "not-allowed", fontSize: qty > 0 ? 14 : 12, fontWeight: 500, opacity: available ? 1 : 0.7 }}
                          >
                            {qty > 0 ? "+" : t("addToOrder")}
                          </button>
                        </div>
                      </div>
                      {qty > 0 && (
                        editingNoteItemId === item.id ? (
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <input
                              type="text"
                              autoFocus
                              maxLength={140}
                              value={note}
                              onChange={(e) => updateCartItemNote(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") setEditingNoteItemId(null);
                              }}
                              placeholder={t("notePlaceholder")}
                              style={{ flex: 1, fontSize: 12.5, border: "1px solid var(--border)", borderRadius: 6, padding: "7px 9px", background: "#FFFFFF", color: "#111111", fontFamily: isRtl ? "Tajawal, sans-serif" : "Inter, sans-serif" }}
                            />
                            <button onClick={() => setEditingNoteItemId(null)} style={{ fontSize: 12, background: theme.primary, color: "#FBF8F2", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>{t("apply")}</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingNoteItemId(item.id)}
                            style={{ display: "block", marginTop: 8, fontSize: 12, color: note ? theme.secondaryLight : "var(--text-faint)", background: "none", border: "none", cursor: "pointer", padding: 0, fontStyle: note ? "italic" : "normal", textAlign: isRtl ? "right" : "left" }}
                          >
                            {note || t("addNote")}
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
                {(menu[cat] || []).length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t("noItemsYet")}</div>}
              </div>
            </div>
          ))
        )}
        <div style={{ textAlign: "center", marginTop: 30, fontSize: 10, letterSpacing: 0.6, color: "#4A4F5A" }}>G&amp;B</div>
      </div>

      {cartCount > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderTop: `1px solid ${!isOnline ? COLORS.red : theme.secondary}`, padding: "14px 20px", boxShadow: "0 -8px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            {sendError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginBottom: 8 }}>{t("notice_orderSendFailed")}</div>}
            {!isOnline && !sendError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginBottom: 8 }}>{t("offlineOrderingHint")}</div>}
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("subtotal")}</span><span>{money(cartTotal)}</span></div>
              {servicePercent > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("serviceCharge")} ({servicePercent}%)</span><span>{money(serviceAmt)}</span></div>}
              {vatPercent > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("vat")} ({vatPercent}%)</span><span>{money(vatAmt)}</span></div>}
              {deliveryFeeAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("deliveryFeeLineLabel")}</span><span>{money(deliveryFeeAmount)}</span></div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{cartCount === 1 ? t("itemCount", { n: cartCount }) : t("itemCount_plural", { n: cartCount })} &middot; {t("orderTotal")}</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 17, color: theme.secondaryLight }}>{money(orderTotal)}</div>
              </div>
              <button
                onClick={submitOrder}
                disabled={sending || (isGeneralLink && !deliveryMethodChoice)}
                style={{ padding: "13px 22px", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: sending ? "default" : "pointer", opacity: sending || (isGeneralLink && !deliveryMethodChoice) ? 0.6 : 1, flexShrink: 0 }}
              >
                {t("sendOrderToKitchen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {justSent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setJustSent(false)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 26, width: "100%", maxWidth: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{t("orderSentTitle")}</div>
            <div style={{ fontSize: 13, color: COLORS.charcoalSoft, marginBottom: 20, lineHeight: 1.5 }}>{t("orderSentSubtitle")}</div>
            <button onClick={() => setJustSent(false)} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: "#FBF8F2", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("orderSentOk")}</button>
          </div>
        </div>
      )}

      {billModal}
    </div>
  );
}

// Entry point: a customer scanning a table's QR code lands on this same page with ?table=<id> in
// the URL, which routes to the read-only menu instead of the full staff POS. ?order=1 (no table)
// is the general online-ordering link meant for social media — same customer-facing component,
// just without a table context, so it prompts for Pickup/Delivery instead of assuming dine-in.
// This check runs once per mount (not inside a hook), so it never changes mid-session and never
// violates the rules of hooks — POSPrototype and CustomerMenuView are two independent components,
// not a conditional branch inside one.
export default function App({ tenantId, storeLink = false, siteBootstrap = null }) {
  let tableParam = null;
  let isStoreLink = false;
  let isCallCenter = false;
  let isPreview = false;
  try {
    const params = new URLSearchParams(window.location.search);
    tableParam = params.get("table");
    isStoreLink = params.get("order") === "1";
    isCallCenter = params.get("callcenter") === "1";
    isPreview = params.get("preview") === "1";
  } catch (e) {
    tableParam = null;
    isStoreLink = false;
    isCallCenter = false;
  }
  // /r/<name> (the restaurant's short web address) is always the online-ordering page.
  if (storeLink) isStoreLink = true;
  if (isCallCenter) return <CustomerMenuView tableId={null} tenantId={tenantId} callCenter />;
  if (tableParam) return <CustomerMenuView tableId={tableParam} tenantId={tenantId} bootstrap={siteBootstrap} />;
  if (isStoreLink) return <CustomerMenuView tableId={null} tenantId={tenantId} preview={isPreview} bootstrap={siteBootstrap} />;
  return <POSPrototype tenantId={tenantId} />;
}