"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createTenantStorage } from "@/lib/tenantStorage";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
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
    payment_split: "Split payment",
    splitPaymentOption: "Split payment",
    splitRemainingLabel: "Remaining",
    notice_splitPaymentMismatch: "Split amounts must add up to the total ({{amount}}) across at least 2 methods",

    status_placed: "Order placed",
    status_preparing: "Preparing",
    status_out_for_delivery: "Out for delivery",
    status_delivered: "Delivered",

    ticketNumber: "Ticket #{{n}}",
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
    searchCustomerPlaceholder: "Search returning customer by name or phone…",
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
    notice_menuScanTooLarge: "That photo is too large — try one under 8MB",
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
    dishNamePlaceholder: "Dish name",
    shortDescriptionPlaceholder: "Short description",
    pricePlaceholder: "Price",
    recipeLabel: "Recipe — stock used per serving",
    noIngredientsAdded: "No ingredients added yet.",
    selectIngredient: "Select ingredient…",
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
    restock10: "+10 restock",
    stockDecreaseTooltip: "Only for correcting counts or returning defective/damaged supply — staff can only add stock, not remove it.",
    unitGroup_Weight: "Weight",
    unitGroup_Volume: "Volume",
    unitGroup_Count: "Count",

    receiptsTitle: "Receipts",
    receiptsSubtitle: "Every month is stored separately and kept indefinitely. Cancelling restores stock; refunding does not; editing adjusts it.",
    loadingHistory: "Loading history…",
    orderCount: "{{n}} order",
    orderCount_plural: "{{n}} orders",
    loadingMonth: "Loading {{month}}…",
    noSavedOrdersForMonth: "No saved orders for {{month}}.",
    ticketHash: "Ticket #{{n}}",
    cancelledBadge: "Cancelled · stock restored",
    refundedBadge: "Refunded · stock kept",
    statusColon: "Status:",
    whatsappSent: "sent",
    whatsappChatOpened: "chat opened",
    whatsappLogLine: "✓ WhatsApp {{sentOrOpened}} for \"{{status}}\" at {{time}}",
    saveChanges: "Save changes",
    cancelEdit: "Cancel edit",
    editReasonLabel: "Reason for edit (optional)",
    editReasonPlaceholder: "e.g. customer changed their mind",
    viewEditHistory: "View edit history ({{n}})",
    hideEditHistory: "Hide edit history",
    editHistoryEntry: "{{name}} · {{time}}",
    editHistoryChange: "{{item}}: {{from}} → {{to}}",
    editHistoryNoReason: "No reason given",
    editHistoryUnknownEditor: "Staff member",
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
    discountsGiven: "Discounts given",
    cashReconciliationTitle: "Cash reconciliation",
    cashReconciliationSubtitle: "Counts every cash order, cash refund, and cash expense logged this shift, so the expected drawer total is actually accurate.",
    openingFloatLabel: "Opening float",
    openingFloatHint: "Cash physically in the drawer when this shift started",
    cashSalesLabel: "Cash sales",
    cashRefundsLabel: "Cash refunds",
    cashExpensesLabel: "Cash expenses paid out",
    noCashExpensesThisShift: "No cash expenses logged this shift.",
    expectedCashLabel: "Expected cash in drawer",
    countedCashLabel: "Counted cash",
    countedCashPlaceholder: "Count the drawer and enter it here",
    varianceLabel: "Variance",
    varianceOver: "Over",
    varianceShort: "Short",
    varianceMatch: "Matches exactly",
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
    primaryColorLabel: "Primary color",
    secondaryColorLabel: "Secondary color",
    primaryColorHint: "Used for buttons, the active tab, and key actions.",
    secondaryColorHint: "Used for accents, links, and highlighted badges.",
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
    takeawayDelivery: "Takeaway / Delivery",
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
    checkoutRequestButton: "Request bill",
    checkoutRequestedTitle: "Bill requested",
    checkoutRequestedBody: "Your server will bring your bill shortly.",
    checkoutRequestFailed: "Couldn't request the bill — check your connection and try again.",

    addToOrder: "Add",
    yourOrder: "Your order",
    orderTotal: "Total",
    sendOrderToKitchen: "Send order to server",
    emptyCartHint: "Add items from the menu to build your order.",
    orderSentTitle: "Order sent!",
    orderSentSubtitle: "Your server will review it shortly and bring it out. You can keep browsing and send another order any time.",
    orderSentOk: "Got it",
    notice_cartEmpty: "Add at least one item before sending your order",
    notice_orderSendFailed: "Couldn't send your order — check your connection and try again",
    pendingOrdersPill: "{{n}} new order",
    pendingOrdersPill_plural: "{{n}} new orders",
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
    confirm_removeSupplier: "Remove {{name}} from suppliers? Past expenses linked to them are kept.",
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
    notice_copyFailed: "Couldn't copy automatically — select the text and copy it manually",

    tab_dashboard: "Dashboard",
    dashboardTitle: "Dashboard",
    dashboardSubtitle: "A snapshot of how the business is doing this month.",
    todayRevenue: "Today's revenue",
    monthRevenue: "This month's revenue",
    monthOrders: "This month's orders",
    netProfitLabel: "Net profit this month",
    netProfitHint: "Revenue minus logged expenses",
    avgOrderValueLabel: "Average order value",
    revenueTrendTitle: "Revenue this month",
    topSellersTitle: "Top sellers this month",
    noSalesYetDashboard: "No completed orders yet this month.",
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
    shiftRecapTitle: "Nice work, {{name}}!",
    shiftRecapHours: "{{hours}} worked",
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
    shiftHistoryTitle: "Recent shifts",
    noShiftHistory: "No completed shifts yet.",
    leaderboardTitle: "Top performers (last 30 days)",
    noLeaderboardData: "Not enough data yet.",
    shiftHistoryLine: "{{orders}} orders · {{revenue}} · {{hours}}",
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
    payment_split: "دفع مقسّم",
    splitPaymentOption: "دفع مقسّم",
    splitRemainingLabel: "المتبقي",
    notice_splitPaymentMismatch: "يجب أن يساوي مجموع المبالغ المقسّمة الإجمالي ({{amount}}) موزعًا على طريقتين على الأقل",

    status_placed: "تم استلام الطلب",
    status_preparing: "قيد التحضير",
    status_out_for_delivery: "في الطريق للتوصيل",
    status_delivered: "تم التوصيل",

    ticketNumber: "فاتورة رقم {{n}}",
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
    searchCustomerPlaceholder: "ابحث عن عميل سابق بالاسم أو الهاتف…",
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
    notice_menuScanTooLarge: "هذه الصورة كبيرة جدًا — جرّب صورة أصغر من 8 ميجابايت",
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
    dishNamePlaceholder: "اسم الطبق",
    shortDescriptionPlaceholder: "وصف مختصر",
    pricePlaceholder: "السعر",
    recipeLabel: "المكونات — الكمية المستخدمة لكل حصة",
    noIngredientsAdded: "لم تتم إضافة مكونات بعد.",
    selectIngredient: "اختر مكونًا…",
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
    restock10: "+١٠ تجديد المخزون",
    stockDecreaseTooltip: "فقط لتصحيح الأرقام أو إرجاع بضاعة تالفة/معيبة — الموظفون يقدروا يزودوا المخزون فقط ولا يقدروا يقللوه.",
    unitGroup_Weight: "الوزن",
    unitGroup_Volume: "الحجم",
    unitGroup_Count: "العدد",

    receiptsTitle: "الإيصالات",
    receiptsSubtitle: "يُحفظ كل شهر بشكل منفصل ويبقى محفوظًا إلى أجل غير مسمى. الإلغاء يستعيد المخزون؛ الاسترجاع لا يفعل ذلك؛ التعديل يضبطه.",
    loadingHistory: "جارٍ تحميل السجل…",
    orderCount: "طلب واحد",
    orderCount_plural: "{{n}} طلبات",
    loadingMonth: "جارٍ تحميل {{month}}…",
    noSavedOrdersForMonth: "لا توجد طلبات محفوظة لشهر {{month}}.",
    ticketHash: "فاتورة رقم {{n}}",
    cancelledBadge: "ملغى · تمت استعادة المخزون",
    refundedBadge: "مُسترجع · تم الاحتفاظ بالمخزون",
    statusColon: "الحالة:",
    whatsappSent: "تم الإرسال",
    whatsappChatOpened: "تم فتح المحادثة",
    whatsappLogLine: "✓ واتساب {{sentOrOpened}} لحالة \"{{status}}\" في {{time}}",
    saveChanges: "حفظ التغييرات",
    cancelEdit: "إلغاء التعديل",
    editReasonLabel: "سبب التعديل (اختياري)",
    editReasonPlaceholder: "مثال: العميل غيّر رأيه",
    viewEditHistory: "عرض سجل التعديلات ({{n}})",
    hideEditHistory: "إخفاء سجل التعديلات",
    editHistoryEntry: "{{name}} · {{time}}",
    editHistoryChange: "{{item}}: {{from}} ← {{to}}",
    editHistoryNoReason: "لم يُذكر سبب",
    editHistoryUnknownEditor: "أحد الموظفين",
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
    discountsGiven: "الخصومات الممنوحة",
    cashReconciliationTitle: "تسوية النقدية",
    cashReconciliationSubtitle: "يحسب كل طلب نقدي ومسترجع نقدي ومصروف نقدي سُجّل في هذه الوردية، عشان يكون إجمالي الدرج المتوقع دقيق فعلاً.",
    openingFloatLabel: "رصيد بداية الوردية",
    openingFloatHint: "النقدية الموجودة فعليًا في الدرج عند بداية هذه الوردية",
    cashSalesLabel: "المبيعات النقدية",
    cashRefundsLabel: "المسترجع نقدًا",
    cashExpensesLabel: "المصروفات المدفوعة نقدًا",
    noCashExpensesThisShift: "لا توجد مصروفات نقدية مسجّلة في هذه الوردية.",
    expectedCashLabel: "النقدية المتوقعة في الدرج",
    countedCashLabel: "النقدية المعدودة",
    countedCashPlaceholder: "اعدّ الدرج واكتب الرقم هنا",
    varianceLabel: "الفرق",
    varianceOver: "زيادة",
    varianceShort: "عجز",
    varianceMatch: "مطابق تمامًا",
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
    primaryColorLabel: "اللون الأساسي",
    secondaryColorLabel: "اللون الثانوي",
    primaryColorHint: "يُستخدم للأزرار والتبويب النشط والإجراءات الرئيسية.",
    secondaryColorHint: "يُستخدم للمسات المميزة والروابط والشارات البارزة.",
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
    takeawayDelivery: "توصيل / استلام",
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
    checkoutRequestButton: "طلب الحساب",
    checkoutRequestedTitle: "تم طلب الحساب",
    checkoutRequestedBody: "سيحضر لك النادل الحساب قريبًا.",
    checkoutRequestFailed: "تعذّر طلب الحساب — تحقق من اتصالك وحاول مرة أخرى.",

    addToOrder: "إضافة",
    yourOrder: "طلبك",
    orderTotal: "الإجمالي",
    sendOrderToKitchen: "إرسال الطلب إلى النادل",
    emptyCartHint: "أضف أصنافًا من القائمة لتكوين طلبك.",
    orderSentTitle: "تم إرسال الطلب!",
    orderSentSubtitle: "سيقوم النادل بمراجعته قريبًا وإحضاره. يمكنك متابعة التصفح وإرسال طلب آخر في أي وقت.",
    orderSentOk: "تم",
    notice_cartEmpty: "أضف صنفًا واحدًا على الأقل قبل إرسال طلبك",
    notice_orderSendFailed: "تعذّر إرسال طلبك — تحقق من اتصالك وحاول مرة أخرى",
    pendingOrdersPill: "طلب جديد واحد",
    pendingOrdersPill_plural: "{{n}} طلبات جديدة",
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
    confirm_removeSupplier: "إزالة {{name}} من الموردين؟ سيتم الاحتفاظ بالمصروفات السابقة المرتبطة به.",
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
    notice_copyFailed: "تعذّر النسخ تلقائيًا — حدد النص وانسخه يدويًا",

    tab_dashboard: "لوحة المعلومات",
    dashboardTitle: "لوحة المعلومات",
    dashboardSubtitle: "نظرة سريعة على أداء العمل هذا الشهر.",
    todayRevenue: "إيرادات اليوم",
    monthRevenue: "إيرادات هذا الشهر",
    monthOrders: "طلبات هذا الشهر",
    netProfitLabel: "صافي الربح هذا الشهر",
    netProfitHint: "الإيرادات ناقص المصروفات المسجلة",
    avgOrderValueLabel: "متوسط قيمة الطلب",
    revenueTrendTitle: "إيرادات هذا الشهر",
    topSellersTitle: "الأكثر مبيعًا هذا الشهر",
    noSalesYetDashboard: "لا توجد طلبات مكتملة بعد هذا الشهر.",
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
    shiftRecapTitle: "عمل رائع، {{name}}!",
    shiftRecapHours: "{{hours}} من العمل",
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
    shiftHistoryTitle: "الورديات الأخيرة",
    noShiftHistory: "لا توجد ورديات مكتملة بعد.",
    leaderboardTitle: "الأفضل أداءً (آخر 30 يومًا)",
    noLeaderboardData: "لا توجد بيانات كافية بعد.",
    shiftHistoryLine: "{{orders}} طلبات · {{revenue}} · {{hours}}",
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

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "visa", label: "Visa" },
  { id: "instapay", label: "InstaPay" },
];
// A receipt paid across more than one method stores paymentMethod: "split" plus a splitPayments
// breakdown; every other receipt effectively has one "split" of just its own total. Reporting
// code should always read amounts through this helper rather than assuming paymentMethod alone
// tells you the full story, so a split payment counts correctly toward each method it touched.
const receiptMethodAmounts = (r) =>
  r.paymentMethod === "split" && Array.isArray(r.splitPayments) && r.splitPayments.length > 0
    ? r.splitPayments
    : [{ method: r.paymentMethod, amount: r.total }];

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

const newId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

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
const buildHelpSystemPrompt = (restaurantName, lang) => {
  const responseLang = lang === "ar" ? "Arabic" : "English";
  const S = STRINGS[lang] || STRINGS.en;
  // The exact on-screen wording for the current language, pulled straight from the same
  // dictionary the UI itself renders from — so if the bot says "tap X", X is guaranteed to match
  // what's actually printed on the button, rather than the model improvising its own translation
  // that might use slightly different (if reasonable) Arabic wording than the real interface.
  const glossaryKeys = [
    "tab_order", "tab_menu", "tab_stock", "tab_tables", "tab_delivery", "tab_receipts", "tab_expenses", "tab_dashboard",
    "tab_customers", "tab_shift", "tab_staff", "tab_settings",
    "addDiscount", "splitBill", "saveOrder", "printReceipt", "download", "clockOut", "clockIn",
    "qrCode", "addCategory", "addItem", "addEmployee", "editPin", "restock10",
    "confirmOrder", "rejectOrder", "openTicket", "cancelOrder", "refundOrder",
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
- **Order**: build a ticket for a table or Takeaway/Delivery. Tap menu items to add them, adjust quantities, apply a discount (+ Add discount), split the bill evenly among any number of people (+ Split bill), choose a payment method, then Save order. "Print receipt" and "Download" are both available — see printing notes below. Switching tables preserves each table's in-progress order separately.
- **Menu**: add/edit/delete categories and dishes. Each dish can have a "recipe" — which stock ingredients it uses and how much — so orders automatically deduct stock. A dish with no recipe set is treated as always in stock. There's also a "Scan a menu photo" option (if included in this restaurant's package) that reads a photo of a printed menu and pre-fills items for review before adding them — you check each one, edit anything wrong, then add.
- **Stock**: manage ingredients, their units (weight/volume/count), and current stock levels. Use +10 restock or the +/- buttons to adjust.
- **Tables**: set how many tables the restaurant has, rename any of them, see which are occupied, and generate/print a QR code per table that customers can scan to view the live menu and place their own order. A table shows "Occupied" while it has an open ticket, and shows a "Bill requested" badge with the customer's chosen payment method once they use the QR menu's checkout option — staff confirm payment with a "Mark as paid" button, which clears the table.
- **Delivery**: shows the shareable online-ordering link (for social media — customers browse the live menu and order pickup/delivery without a table's QR code) and lets you set delivery zones with a fee per zone, which customers pick from at checkout.
- **Receipts**: monthly order history. Cancel (restores stock, use when an order never went out), Refund (stock stays deducted, use when it was already served), or Edit a saved order. Mark fulfillment status (Preparing/Out for delivery) to trigger a WhatsApp update to the customer if they left a phone number — this opens WhatsApp with the message ready and still needs one tap of Send there, WhatsApp itself never allows sending on someone's behalf automatically.
- **Expenses** (manager-only): log business expenses with a supplier, category, and paid/unpaid status, see monthly totals, outstanding payables, and a by-category breakdown.
- **Dashboard** (manager-only): today's revenue, this month's revenue/orders/average order value, net profit (revenue minus logged expenses), a daily revenue trend chart, and top-selling items.
- **Customers**: anyone whose phone number was entered at checkout is saved here automatically, with order history.
- **Shift**: shows the currently clocked-in employee's personal stats (hours worked, their orders, their revenue) plus register-wide totals for the day. "Clock out" ends their shift and shows a recap.
- **Staff**: manage the employee roster (name + 4-digit PIN). An employee can only ever edit their OWN PIN, not a colleague's. Also shows a 30-day revenue leaderboard and shift history.
- **Settings**: restaurant name, logo, and primary/secondary brand colors — these apply across the whole app and printed receipts. If VAT/service charge is included in this restaurant's package, it's also set here (a percentage each, applied automatically to every order — set either to 0 to turn it off). Also the EN/AR language toggle in the header.

## How staff log in
The app requires clocking in with a name + 4-digit PIN before anything else is usable (a login/PIN-pad screen). First-time setup lets someone add themselves. IMPORTANT: PINs here are for quick identification at a shared terminal, not real security — there's no encryption. If someone can't log in, check they're using the right PIN via a manager in the Staff tab (any logged-in staff member can edit their own PIN there).

## QR code table ordering
Each table's QR code links to this same app with a table ID in the URL, showing customers a live, view-only menu (items, descriptions, prices — no stock/availability details, by design, for customer privacy) where they can add items and send an order. That order does NOT go straight to the kitchen — it shows up as a "pending order" for staff to review in the Tables view (a badge appears, plus a pill in the header) and must be explicitly Confirmed (which merges it into that table's ticket) or Rejected. This is intentional so staff always have final say before anything hits the kitchen.

## Known limitations — mention these proactively if relevant
- **Printing and QR codes only fully work once this app is deployed to a real, published URL.** If someone is testing inside Claude's chat preview, "Print receipt" and the QR code links won't function — use the "Download" button instead (downloads a receipt/flyer file they can open and print manually), and know that QR codes will start working once the app is actually deployed/published somewhere with a real public URL.
- **Offline behavior**: the staff app keeps working through a lost connection — orders, menu edits, stock changes all still work and are queued to sync automatically once back online (shown via a "changes waiting to sync" indicator in the header). However, nothing survives closing the tab or refreshing while offline. Customer QR ordering is deliberately blocked while offline (no queueing) so no order can exist that the restaurant never sees.
- **Ticket numbers** are simple ascending numbers (1, 2, 3...) that reset each morning, shared across every terminal.
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

const money = (n) => `${n.toFixed(2)} EGP`;
const fmtQty = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

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
  const [tenantStatus, setTenantStatus] = useState(null); // { status, paid_until, days_remaining, restaurant_name } | null while loading
  const [renewalNoticeDismissed, setRenewalNoticeDismissed] = useState(false);
  const [view, setView] = useState("order"); // "order" | "menu" | "stock" | "receipts" | "customers" | "shift"
  const [active, setActive] = useState("Mains");
  const [categories, setCategories] = useState(Object.keys(INITIAL_MENU));
  const [menu, setMenu] = useState(INITIAL_MENU);
  const [ingredients, setIngredients] = useState(INITIAL_INGREDIENTS);
  const [menuLoaded, setMenuLoaded] = useState(false);

  const [tableCount, setTableCount] = useState(12);
  const [tableNames, setTableNames] = useState({});
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const [activeTableId, setActiveTableId] = useState(null); // null = Takeaway/Delivery
  const [tableDrafts, setTableDrafts] = useState({}); // in-session only — per-table in-progress carts
  const [qrTableId, setQrTableId] = useState(null); // which table's QR modal is open, if any
  const [storeLinkCopied, setStoreLinkCopied] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]); // orders submitted by customers via QR, awaiting staff review
  const [pendingOrdersLoaded, setPendingOrdersLoaded] = useState(false);
  const [reviewTableId, setReviewTableId] = useState(undefined); // which table's pending-orders review modal is open — undefined = closed, null = reviewing Takeaway/Delivery, else a table id
  const [cart, setCart] = useState([]);
  const [editingNoteLineId, setEditingNoteLineId] = useState(null); // which cart line's note input is open, if any
  const [ticketNo, setTicketNo] = useState("1"); // placeholder — corrected to the real next number once the shared counter loads
  const ticketCounterRef = useRef({ date: null, next: 1 }); // { date: "YYYY-MM-DD", next: number } — resets each day, shared across every terminal
  const [ticketCounterLoaded, setTicketCounterLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
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
  const [discountDraft, setDiscountDraft] = useState({ type: "percent", value: "" });
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
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customers, setCustomers] = useState({});
  const [customersLoaded, setCustomersLoaded] = useState(false);

  const [receiptsByMonth, setReceiptsByMonth] = useState({});
  const [monthKeys, setMonthKeys] = useState([]);
  const [monthsLoaded, setMonthsLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editDraftItems, setEditDraftItems] = useState([]);
  const [editReason, setEditReason] = useState("");
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
  const [expenseMonthKeys, setExpenseMonthKeys] = useState([]);
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState(null);
  const [loadingExpenseMonth, setLoadingExpenseMonth] = useState(false);
  const [expenseEditor, setExpenseEditor] = useState(null); // draft object while adding/editing, or null when closed

  const [shiftStart, setShiftStart] = useState(null); // doubles as this device's clock-in time
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0"); // cash physically in the drawer at clock-in, for cash reconciliation
  const [countedCash, setCountedCash] = useState(""); // cash actually counted at close — entered fresh each time, never persisted

  const [employees, setEmployees] = useState([]); // shared staff roster: [{id, name, pin}]
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [rosterLoadFailed, setRosterLoadFailed] = useState(false); // couldn't reach the roster (e.g. offline) — distinct from "genuinely no staff yet"
  const rosterLoadFailedRef = useRef(false);
  useEffect(() => {
    rosterLoadFailedRef.current = rosterLoadFailed;
  }, [rosterLoadFailed]);
  const [currentEmployee, setCurrentEmployee] = useState(null); // {id, name} | null — who's clocked in on this device
  const [currentEmployeeLoaded, setCurrentEmployeeLoaded] = useState(false);
  const [shiftLog, setShiftLog] = useState([]); // shared history of completed shifts
  const [shiftLogLoaded, setShiftLogLoaded] = useState(false);
  const [loginSelectedId, setLoginSelectedId] = useState(null);
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginAddMode, setLoginAddMode] = useState(false);
  const [loginNewName, setLoginNewName] = useState("");
  const [loginNewPin, setLoginNewPin] = useState("");
  const [shiftRecap, setShiftRecap] = useState(null); // stats shown right after clocking out
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

  const [lang, setLang] = useState("en");
  const [langLoaded, setLangLoaded] = useState(false);

  const [restaurantName, setRestaurantName] = useState("Ember & Vine");
  const [logoUrl, setLogoUrl] = useState(null);
  const [primaryColor, setPrimaryColor] = useState(COLORS.burgundy);
  const [secondaryColor, setSecondaryColor] = useState(COLORS.brass);
  const [mapsLink, setMapsLink] = useState(""); // a Google Maps place link, or a plain address — see openInGoogleMaps
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  const [vatPercent, setVatPercent] = useState(0);
  const [servicePercent, setServicePercent] = useState(0);
  const [taxConfigLoaded, setTaxConfigLoaded] = useState(false);

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
          const result = await storage.get("shift-start", false);
          setShiftStart(result?.value || new Date().toISOString());
          const floatResult = await storage.get("opening-float", false);
          setOpeningFloat(floatResult?.value || "0");
        } else {
          setShiftStart(null);
        }
      } catch (e) {
        setCurrentEmployee(null);
        setShiftStart(null);
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
        setLang(result?.value === "ar" ? "ar" : "en");
      } catch (e) {
        setLang("en");
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
          setRestaurantName(parsed.name || "Ember & Vine");
          setLogoUrl(parsed.logo || null);
          setPrimaryColor(parsed.primary || theme.primary);
          setSecondaryColor(parsed.secondary || theme.secondary);
          setMapsLink(parsed.mapsLink || "");
        }
      } catch (e) {
        // fall back to defaults already set
      } finally {
        setBrandingLoaded(true);
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
        // fall back to 0%/0% already set
      } finally {
        setTaxConfigLoaded(true);
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
      try {
        const result = await getSharedWithRetry(storage, "menu-config");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        if (parsed) {
          if (parsed.categories) setCategories(parsed.categories);
          if (parsed.menu) setMenu(parsed.menu);
        }
      } catch (e) {
        // fall back to the built-in starter menu already set
      }
      try {
        const ingResult = await getSharedWithRetry(storage, "ingredients-config");
        if (ingResult?.value) setIngredients(JSON.parse(ingResult.value));
      } catch (e) {
        // fall back to the built-in starter ingredients already set
      } finally {
        setMenuLoaded(true);
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
        // fall back to defaults already set
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
      const today = new Date().toISOString().slice(0, 10);
      try {
        const result = await getSharedWithRetry(storage, "ticket-counter");
        const parsed = result?.value ? JSON.parse(result.value) : null;
        ticketCounterRef.current = parsed && parsed.date === today ? parsed : { date: today, next: 1 };
      } catch (e) {
        ticketCounterRef.current = { date: today, next: 1 };
      } finally {
        setTicketCounterLoaded(true);
        setTicketNo(issueTicketNumber());
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
      } catch (e) {
        // leave whatever was there before — a transient failure shouldn't wipe the list
      } finally {
        if (!cancelled) setPendingOrdersLoaded(true);
      }
    };
    loadPending();
    const interval = setInterval(loadPending, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-persists menu/category/ingredient edits to shared storage as they change, rather than
  // threading a save call through every individual add/edit/delete handler. Routed through
  // syncSet so an edit made while offline is queued and retried instead of silently lost.
  useEffect(() => {
    if (!menuLoaded) return; // don't overwrite shared data with initial defaults before load completes
    syncSet("menu-config", JSON.stringify({ categories, menu }), true, t("syncLabelMenu"));
  }, [categories, menu, menuLoaded]);
  useEffect(() => {
    if (!menuLoaded) return;
    syncSet("ingredients-config", JSON.stringify(ingredients), true, t("syncLabelStock"));
  }, [ingredients, menuLoaded]);
  useEffect(() => {
    if (!tablesLoaded) return;
    syncSet("tables-config", JSON.stringify({ count: tableCount, names: tableNames }), true, t("syncLabelTables"));
  }, [tableCount, tableNames, tablesLoaded]);
  useEffect(() => {
    if (!taxConfigLoaded) return;
    syncSet("tax-config", JSON.stringify({ vatPercent, servicePercent }), true, t("syncLabelSettings"));
  }, [vatPercent, servicePercent, taxConfigLoaded]);
  // Publishes ONLY a per-item true/false availability flag to shared storage — never the
  // underlying ingredient names, quantities, or stock counts. This is what the public online-
  // ordering link (and table QR menus) read to show "Available"/"Not available" per dish, without
  // any path to the actual inventory data that produced that flag.
  useEffect(() => {
    if (!menuLoaded) return;
    const availability = {};
    Object.values(menu).flat().forEach((item) => {
      const available =
        !item.recipe || item.recipe.length === 0
          ? true
          : item.recipe.every((r) => {
              const ing = ingredients[r.ingredientId];
              return ing && r.qty > 0 && ing.stock >= r.qty;
            });
      availability[item.id] = available;
    });
    syncSet("menu-availability", JSON.stringify(availability), true, t("syncLabelStock"));
  }, [menu, ingredients, menuLoaded]);

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
    persistBranding({ name: value, logo: logoUrl, primary: primaryColor, secondary: secondaryColor, mapsLink });
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
    persistBranding({ name: restaurantName, logo: logoUrl, primary: value, secondary: secondaryColor, mapsLink });
  };
  const updateSecondaryColor = (value) => {
    setSecondaryColor(value);
    persistBranding({ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: value, mapsLink });
  };
  const updateMapsLink = (value) => {
    setMapsLink(value);
    persistBranding({ name: restaurantName, logo: logoUrl, primary: primaryColor, secondary: secondaryColor, mapsLink: value });
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
    setView(key);
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
    if (!file.type.startsWith("image/")) {
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
      persistBranding({ name: restaurantName, logo: dataUrl, primary: primaryColor, secondary: secondaryColor, mapsLink });
      flashNotice(t("notice_logoUpdated"));
      logActivity("logo_changed");
    };
    reader.onerror = () => flashNotice(t("notice_logoInvalidType"));
    reader.readAsDataURL(file);
  };
  const removeLogo = () => {
    setLogoUrl(null);
    persistBranding({ name: restaurantName, logo: null, primary: primaryColor, secondary: secondaryColor, mapsLink });
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

  // Which package-gated tabs/features this tenant can use (see lib/packageFeatures.js and
  // /admin/packages) — "order" and "settings" are always available regardless of package, every
  // other tab needs an explicit true here. Fails closed (nothing gated shows) until the status
  // fetch resolves, rather than flashing tabs a Basic tenant shouldn't see and then hiding them.
  const hasFeature = (key) => !!tenantStatus?.features?.[key];

  // Defense in depth: if package-gated tabs are open when the admin downgrades this restaurant's
  // package mid-session, don't leave a now-disallowed screen up — bounce back to Order.
  const PACKAGE_GATED_VIEWS = ["menu", "stock", "tables", "delivery", "receipts", "expenses", "dashboard", "customers", "shift", "staff"];
  const tabStillAllowed = (key) => (key === "delivery" ? hasFeature("onlineOrderingLink") || hasFeature("deliveryZones") : hasFeature(key));
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
    if (id === null || id === undefined) return t("takeawayDelivery");
    if (id === "dine-in") return t("dineInLabel");
    return tableNames[id] || t("tableNumbered", { n: id });
  };
  const tableIds = useMemo(() => Array.from({ length: tableCount }, (_, i) => String(i + 1)), [tableCount]);
  const pendingOrdersForTable = (id) => pendingOrders.filter((o) => o.tableId === id);
  // How many items are sitting in a given table's in-progress order right now — checks the live
  // top-level cart if it's the currently active table, otherwise its stashed draft.
  const tableItemCount = (id) => {
    const key = id === null ? "takeaway" : id;
    if (id === activeTableId) return cart.length;
    return tableDrafts[key]?.cart?.length || 0;
  };
  const blankDraft = () => ({
    cart: [],
    ticketNo: issueTicketNumber(),
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
    const incoming = tableDrafts[incomingKey] || blankDraft();
    setTableDrafts((prev) => ({ ...prev, [outgoingKey]: outgoingDraft }));
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
    setCustomerSearch("");
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
  useEffect(() => {
    let cancelled = false;
    const loadRequests = async () => {
      try {
        const result = await storage.get("checkout-requests", true);
        if (cancelled) return;
        setCheckoutRequests(result?.value ? JSON.parse(result.value) : []);
      } catch (e) {
        // leave whatever was there before — a transient failure shouldn't wipe the list
      }
    };
    loadRequests();
    const interval = setInterval(loadRequests, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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
    if (!payTableModal) return;
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
        return;
      }
    }

    items.forEach((cartItem) => {
      const menuItem = Object.values(menu).flat().find((m) => m.id === cartItem.id);
      (menuItem?.recipe || []).forEach((r) => updateIngredientStock(r.ingredientId, -r.qty * cartItem.qty));
    });

    const itemsSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const tablePaymentServicePercent = hasFeature("vatService") ? servicePercent : 0;
    const tablePaymentVatPercent = hasFeature("vatService") ? vatPercent : 0;
    const svcAmt = Math.round(itemsSubtotal * (tablePaymentServicePercent / 100) * 100) / 100;
    const vtAmt = Math.round((itemsSubtotal + svcAmt) * (tablePaymentVatPercent / 100) * 100) / 100;
    const grandTotal = itemsSubtotal + svcAmt + vtAmt;
    const ticketForThisTable = tableId === activeTableId ? ticketNo : tableDrafts[tableId]?.ticketNo || issueTicketNumber();

    const receipt = {
      id: `${ticketForThisTable}-${Date.now()}`,
      ticketNo: ticketForThisTable,
      timestamp: new Date().toISOString(),
      table: tableLabel(tableId),
      servedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
      assignedTo: (tableId === activeTableId ? assignedTo : tableDrafts[tableId]?.assignedTo) || null,
      items: items.map((c) => {
        const menuItem = Object.values(menu).flat().find((m) => m.id === c.id);
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
      setCustomerSearch("");
      setShowCustomerSuggestions(false);
      setSaved(false);
      setActiveTableId(targetId);
    }
    removePendingOrder(order.id);
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
    } catch (e) {
      list = [];
    }
    setReceiptsByMonth((prev) => ({ ...prev, [monthKey]: list }));
    setLoadingMonth(false);
    return list;
  };

  useEffect(() => {
    if (selectedMonth) ensureMonthLoaded(selectedMonth);
  }, [selectedMonth]);
  useEffect(() => {
    ensureMonthLoaded(thisMonthKey());
  }, []);
  useEffect(() => {
    if (selectedExpenseMonth) ensureExpenseMonthLoaded(selectedExpenseMonth);
  }, [selectedExpenseMonth]);
  useEffect(() => {
    ensureExpenseMonthLoaded(thisMonthKey());
  }, []);

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
    };
    const goOffline = () => setIsOnline(false);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (syncQueueRef.current.length > 0) flushSyncQueue();
      if (rosterLoadFailedRef.current) retryRosterLoad();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [rosterLoadFailed]);
  useEffect(() => {
    const interval = setInterval(() => {
      // No longer gated on navigator.onLine — that flag is exactly what's unreliable here, so
      // gating retries on it risked never even trying when the real connection was actually fine.
      if (syncQueueRef.current.length > 0) flushSyncQueue();
      if (rosterLoadFailedRef.current) retryRosterLoad();
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

  // Hands out the next ticket number and advances the shared counter. Uses the ref (not state)
  // so a burst of tickets issued in quick succession — e.g. several tables opened back to back —
  // each get a distinct number instead of racing against a stale render's snapshot. Two different
  // terminals issuing a ticket at the exact same instant could in principle still collide, since
  // there's no real transactional backend here to prevent it — an acceptable, rare edge case for
  // a display number, not something the business logic depends on being unique.
  const issueTicketNumber = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (ticketCounterRef.current.date !== today) {
      ticketCounterRef.current = { date: today, next: 1 }; // new day — start the count over at 1
    }
    const n = ticketCounterRef.current.next;
    ticketCounterRef.current = { ...ticketCounterRef.current, next: n + 1 };
    syncSet("ticket-counter", JSON.stringify(ticketCounterRef.current), true, t("syncLabelSettings"));
    return String(n);
  };

  const persistMonth = async (monthKey, updatedList) => {
    setReceiptsByMonth((prev) => ({ ...prev, [monthKey]: updatedList }));
    if (!monthKeys.includes(monthKey)) setMonthKeys((prev) => [monthKey, ...prev].sort().reverse());
    return syncSet(`receipts:${monthKey}`, JSON.stringify(updatedList), false, t("syncLabelOrders"));
  };
  const appendReceipt = async (monthKey, receipt) => {
    let existing = receiptsByMonth[monthKey];
    if (existing === undefined) existing = await ensureMonthLoaded(monthKey);
    return persistMonth(monthKey, [receipt, ...existing]);
  };

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
  const appendExpense = async (monthKey, expense) => {
    let existing = expensesByMonth[monthKey];
    if (existing === undefined) existing = await ensureExpenseMonthLoaded(monthKey);
    return persistExpenseMonth(monthKey, [expense, ...existing]);
  };
  const updateExpenseInMonth = async (monthKey, expenseId, updater) => {
    let existing = expensesByMonth[monthKey];
    if (existing === undefined) existing = await ensureExpenseMonthLoaded(monthKey);
    return persistExpenseMonth(monthKey, existing.map((e) => (e.id === expenseId ? updater(e) : e)));
  };
  const deleteExpenseFromMonth = async (monthKey, expenseId) => {
    let existing = expensesByMonth[monthKey];
    if (existing === undefined) existing = await ensureExpenseMonthLoaded(monthKey);
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

  const handlePhoneChange = (value) => {
    setCustomerPhone(value);
    const match = customers[value];
    if (match && !customerName && !customerAddress) {
      setCustomerName(match.name || "");
      setCustomerAddress(match.address || "");
      flashNotice(t("notice_recognizedCustomer", { name: match.name || value }));
    }
  };
  const customerMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return Object.values(customers).filter((c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 6);
  }, [customerSearch, customers]);
  const selectCustomer = (c) => {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
    setCustomerSearch("");
    setShowCustomerSuggestions(false);
    flashNotice(t("notice_loadedCustomerDetails", { name: c.name || c.phone }));
  };

  // --- Ingredient stock helpers ---
  const updateIngredientStock = (id, delta) => {
    setIngredients((prev) => {
      if (!prev[id]) return prev;
      const nextVal = Math.max(0, Math.round((prev[id].stock + delta) * 1000) / 1000);
      return { ...prev, [id]: { ...prev[id], stock: nextVal } };
    });
  };
  const setIngredientStockValue = (id, value) => {
    const n = Math.max(0, parseFloat(value) || 0);
    setIngredients((prev) => ({ ...prev, [id]: { ...prev[id], stock: n } }));
  };
  const addIngredient = () => {
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
    setIngredients((prev) => ({
      ...prev,
      [id]: { id, name: newIngName.trim(), unit: resolvedUnit, stock: Math.max(0, parseFloat(newIngStock) || 0) },
    }));
    setNewIngName("");
    setNewIngStock("");
    setNewIngUnitCustom("");
    flashNotice(t("notice_ingredientAdded", { name: newIngName.trim(), unit: resolvedUnit }));
  };
  const isIngredientUsed = (id) => Object.values(menu).some((items) => items.some((it) => it.recipe.some((r) => r.ingredientId === id)));
  const deleteIngredient = (id) => {
    if (isIngredientUsed(id)) {
      flashNotice(t("notice_cantDeleteUsed"));
      return;
    }
    setIngredients((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // remaining ingredient stock after subtracting what's already reserved by the current cart
  const remainingIngredientStock = useMemo(() => {
    const remaining = {};
    Object.values(ingredients).forEach((ing) => (remaining[ing.id] = ing.stock));
    cart.forEach((cartItem) => {
      const menuItem = Object.values(menu).flat().find((m) => m.id === cartItem.id);
      if (!menuItem) return;
      menuItem.recipe.forEach((r) => {
        if (remaining[r.ingredientId] !== undefined) remaining[r.ingredientId] -= r.qty * cartItem.qty;
      });
    });
    return remaining;
  }, [ingredients, cart, menu]);

  const rawMaxServings = (item) => {
    if (!item.recipe || item.recipe.length === 0) return null; // not tracked
    return Math.min(...item.recipe.map((r) => {
      const ing = ingredients[r.ingredientId];
      if (!ing || r.qty <= 0) return 0;
      return Math.floor(ing.stock / r.qty);
    }));
  };
  const canAddOneMore = (item) => {
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
    if (max === null) return { text: t("stockNotTracked"), color: "#2E3440", fg: "#9CA1AC" };
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
      const item = line && Object.values(menu).flat().find((m) => m.id === line.id);
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
    setDiscount({ type: discountDraft.type, value: v });
    setDiscountOpen(false);
  };
  const removeDiscount = () => {
    setDiscount(null);
    setDiscountDraft({ type: "percent", value: "" });
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
    if (cart.length === 0) return;

    const splitPayments = paymentMethod === "split"
      ? PAYMENT_METHODS.map((m) => ({ method: m.id, amount: Math.round((Number(splitAmounts[m.id]) || 0) * 100) / 100 })).filter((sp) => sp.amount > 0)
      : null;
    if (paymentMethod === "split") {
      const splitSum = splitPayments.reduce((s, sp) => s + sp.amount, 0);
      if (splitPayments.length < 2 || Math.abs(splitSum - total) > 0.01) {
        flashNotice(t("notice_splitPaymentMismatch", { amount: money(total) }));
        return;
      }
    }

    // deduct ingredient stock per recipe, and snapshot the recipe used at time of sale
    cart.forEach((cartItem) => {
      const menuItem = Object.values(menu).flat().find((m) => m.id === cartItem.id);
      (menuItem?.recipe || []).forEach((r) => updateIngredientStock(r.ingredientId, -r.qty * cartItem.qty));
    });

    const hasCustomer = customerName.trim() || customerPhone.trim() || customerAddress.trim();
    const customer = hasCustomer ? { name: customerName.trim(), phone: customerPhone.trim(), address: customerAddress.trim() } : null;

    const receipt = {
      id: `${ticketNo}-${Date.now()}`,
      ticketNo,
      timestamp: new Date().toISOString(),
      table: activeTableId === null ? null : tableLabel(activeTableId),
      servedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
      assignedTo: assignedTo ? { ...assignedTo } : null,
      items: cart.map((c) => {
        const menuItem = Object.values(menu).flat().find((m) => m.id === c.id);
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

    const receiptOk = await appendReceipt(thisMonthKey(), receipt);

    let customerOk = true;
    if (customer && customer.phone) {
      const existing = customers[customer.phone];
      const updatedEntry = {
        name: customer.name || existing?.name || "",
        phone: customer.phone,
        address: customer.address || existing?.address || "",
        orderCount: (existing?.orderCount || 0) + 1,
        lastOrder: receipt.timestamp,
      };
      customerOk = await persistCustomers({ ...customers, [customer.phone]: updatedEntry });
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
      setCustomerSearch("");
      setOrderEta(fresh.orderEta);
      setTicketNo(fresh.ticketNo);
      setSaved(false);
      // Free up this table (or Takeaway/Delivery slot) now that its order has been placed —
      // otherwise switching away and back would restore the just-saved cart as if still open.
      const key = activeTableId === null ? "takeaway" : activeTableId;
      setTableDrafts((prev) => ({ ...prev, [key]: fresh }));
    }, 1100);
  };

  // Small header block (logo + name) shared by both printable documents.
  const brandHeaderHtml = () => {
    const nameHtml = `<div style="font-size:16px;font-weight:700;">${escapeHtml(restaurantName)}</div>`;
    if (!logoUrl) return nameHtml;
    return `<img src="${logoUrl}" alt="${escapeHtml(restaurantName)}" style="max-width:130px;max-height:60px;margin:0 auto 6px;display:block;" />${nameHtml}`;
  };

  const buildOrderReceiptBodyHtml = () => {
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
        <div style="font-size:11px;">${escapeHtml(activeTableId === null ? t("takeawayDelivery") : tableLabel(activeTableId))}</div>
        <div style="font-size:11px;">${escapeHtml(t("ticketNumber", { n: ticketNo }))}</div>
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
    printViaHiddenFrame(t("ticketNumber", { n: ticketNo }), buildOrderReceiptBodyHtml(), isRtl);
  };
  const downloadOrderReceipt = () => {
    downloadReceiptFile(t("ticketNumber", { n: ticketNo }), buildOrderReceiptBodyHtml(), isRtl);
    flashNotice(t("notice_receiptDownloaded"));
  };


  const monthLabel = (key) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  };
  const availableMonths = useMemo(() => Array.from(new Set([thisMonthKey(), ...monthKeys])).sort().reverse(), [monthKeys]);
  const currentMonth = selectedMonth || thisMonthKey();
  const monthReceipts = receiptsByMonth[currentMonth] || [];
  const monthRevenue = monthReceipts.filter((r) => r.status === "completed").reduce((s, r) => s + r.total, 0);
  const monthUnpaid = monthReceipts.filter((r) => r.status === "completed" && r.paid === false);
  const monthUnpaidTotal = monthUnpaid.reduce((s, r) => s + r.total, 0);

  const availableExpenseMonths = useMemo(() => Array.from(new Set([thisMonthKey(), ...expenseMonthKeys])).sort().reverse(), [expenseMonthKeys]);
  const currentExpenseMonth = selectedExpenseMonth || thisMonthKey();
  const monthExpenses = expensesByMonth[currentExpenseMonth] || [];
  const expenseTotalThisMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const expenseByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    id: cat,
    total: monthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);
  const outstandingExpenses = monthExpenses.filter((e) => e.status === "unpaid");
  const outstandingTotal = outstandingExpenses.reduce((s, e) => s + e.amount, 0);

  // Dashboard analytics — deliberately scoped to the actual current month via thisMonthKey(),
  // independent of whatever month a manager might have selected in the Receipts or Expenses view
  // dropdowns elsewhere. Both underlying datasets are already loaded eagerly at startup, so this
  // needs no extra fetching.
  const dashboardReceipts = (receiptsByMonth[thisMonthKey()] || []).filter((r) => r.status === "completed");
  const dashboardExpenseTotal = (expensesByMonth[thisMonthKey()] || []).reduce((s, e) => s + e.amount, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRevenue = dashboardReceipts.filter((r) => r.timestamp.slice(0, 10) === todayStr).reduce((s, r) => s + r.total, 0);
  const dashboardMonthRevenue = dashboardReceipts.reduce((s, r) => s + r.total, 0);
  const dashboardMonthOrders = dashboardReceipts.length;
  const avgOrderValue = dashboardMonthOrders > 0 ? dashboardMonthRevenue / dashboardMonthOrders : 0;
  const netProfit = dashboardMonthRevenue - dashboardExpenseTotal;

  const dailyRevenue = Array.from({ length: new Date().getDate() }, (_, i) => {
    const dayStr = String(i + 1).padStart(2, "0");
    return { day: i + 1, total: dashboardReceipts.filter((r) => r.timestamp.slice(8, 10) === dayStr).reduce((s, r) => s + r.total, 0) };
  });
  const maxDailyRevenue = Math.max(1, ...dailyRevenue.map((d) => d.total));

  const dashboardItemTotals = {};
  dashboardReceipts.forEach((r) => r.items.forEach((it) => { dashboardItemTotals[it.name] = (dashboardItemTotals[it.name] || 0) + it.qty; }));
  const topSellers = Object.entries(dashboardItemTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
  const maxTopSellerQty = Math.max(1, ...topSellers.map((s) => s.qty));

  const dashboardMethodAmounts = dashboardReceipts.flatMap(receiptMethodAmounts);
  const dashboardByMethod = PAYMENT_METHODS.map((m) => ({ ...m, total: dashboardMethodAmounts.filter((a) => a.method === m.id).reduce((s, a) => s + a.amount, 0) }));
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
  const addSupplierRecord = () => {
    const name = newSupplierName.trim();
    if (!name) {
      flashNotice(t("notice_enterSupplierName"));
      return;
    }
    persistSuppliers([...suppliers, { id: newId("sup"), name, category: newSupplierCategory, phone: newSupplierPhone.trim() }]);
    flashNotice(t("notice_supplierAdded", { name }));
    setNewSupplierName("");
    setNewSupplierPhone("");
  };
  const removeSupplierRecord = (supplier) => {
    setConfirmDialog({
      message: t("confirm_removeSupplier", { name: supplier.name }),
      onConfirm: () => persistSuppliers(suppliers.filter((s) => s.id !== supplier.id)),
    });
  };

  const persistDutyRoster = async (next) => {
    setDutyRoster(next);
    return syncSet("duty-roster", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const addDutyMember = () => {
    const name = newDutyName.trim();
    if (!name) {
      flashNotice(t("notice_enterTeamMemberName"));
      return;
    }
    persistDutyRoster([...dutyRoster, { id: newId("duty"), name, role: newDutyRole }]);
    flashNotice(t("notice_teamMemberAdded", { name }));
    setNewDutyName("");
  };
  const removeDutyMember = (member) => {
    setConfirmDialog({
      message: t("confirm_removeTeamMember", { name: member.name }),
      onConfirm: () => {
        persistDutyRoster(dutyRoster.filter((m) => m.id !== member.id));
        if (assignedTo?.id === member.id) setAssignedTo(null);
      },
    });
  };

  const persistDeliveryZones = async (next) => {
    setDeliveryZones(next);
    return syncSet("delivery-zones-config", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const addDeliveryZone = () => {
    const label = newZoneLabel.trim();
    if (!label) {
      flashNotice(t("notice_enterZoneLabel"));
      return;
    }
    const fee = Number(newZoneFee) || 0;
    persistDeliveryZones([...deliveryZones, { id: newId("zone"), label, fee }]);
    flashNotice(t("notice_zoneAdded"));
    setNewZoneLabel("");
    setNewZoneFee("");
  };
  const startEditZone = (zone) => {
    setEditingZoneId(zone.id);
    setEditingZoneLabel(zone.label);
    setEditingZoneFee(String(zone.fee));
  };
  const saveEditZone = () => {
    const label = editingZoneLabel.trim();
    if (!label) {
      flashNotice(t("notice_enterZoneLabel"));
      return;
    }
    const fee = Number(editingZoneFee) || 0;
    persistDeliveryZones(deliveryZones.map((z) => (z.id === editingZoneId ? { ...z, label, fee } : z)));
    setEditingZoneId(null);
  };
  const removeDeliveryZone = (zone) => {
    setConfirmDialog({
      message: t("confirm_removeZone"),
      onConfirm: () => persistDeliveryZones(deliveryZones.filter((z) => z.id !== zone.id)),
    });
  };

  const openNewExpense = () => {
    setExpenseEditor({
      mode: "new",
      id: null,
      date: new Date().toISOString().slice(0, 10),
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


  const cancelReceipt = (r) => {
    if (r.status !== "completed") return;
    r.items.forEach((it) => (it.recipeSnapshot || []).forEach((rec) => updateIngredientStock(rec.ingredientId, rec.qty * it.qty)));
    persistMonth(currentMonth, monthReceipts.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)));
    flashNotice(t("notice_orderCancelled", { n: r.ticketNo }));
  };
  const refundReceipt = (r) => {
    if (r.status !== "completed") return;
    persistMonth(currentMonth, monthReceipts.map((x) => (x.id === r.id ? { ...x, status: "refunded" } : x)));
    flashNotice(t("notice_orderRefunded", { n: r.ticketNo }));
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
    persistMonth(
      currentMonth,
      monthReceipts.map((x) => (x.id === receipt.id ? { ...x, whatsappLog: [...(x.whatsappLog || x.smsLog || []), logEntry] } : x))
    );
  };

  const updateFulfillmentStatus = (r, statusId) => {
    const updated = { ...r, fulfillmentStatus: statusId };
    persistMonth(currentMonth, monthReceipts.map((x) => (x.id === r.id ? updated : x)));
    flashNotice(t("notice_orderMarked", { n: r.ticketNo, status: t(`status_${statusId}`) }));
    const statusDef = FULFILLMENT_STATUSES.find((s) => s.id === statusId);
    if (statusDef?.whatsapp) sendWhatsAppUpdate(updated, statusId);
  };

  // Reassigns which waiter/delivery person a saved order is attributed to — a manager correction,
  // separate from editItemsHistory since it's not a change to what was ordered.
  const assignReceiptTo = (r, member) => {
    const updated = { ...r, assignedTo: member ? { id: member.id, name: member.name, role: member.role } : null };
    persistMonth(currentMonth, monthReceipts.map((x) => (x.id === r.id ? updated : x)));
  };

  // Marks a "pay later" order as actually paid, the moment the cash (or card) is actually
  // collected — which is what the cash reconciliation keys off, not when the order was rung up.
  const markReceiptPaid = (r) => {
    setConfirmDialog({
      message: t("confirm_markOrderPaid", { n: r.ticketNo }),
      onConfirm: () => {
        const updated = { ...r, paid: true, paidAt: new Date().toISOString() };
        persistMonth(currentMonth, monthReceipts.map((x) => (x.id === r.id ? updated : x)));
        flashNotice(t("notice_orderMarkedPaid", { n: r.ticketNo }));
      },
    });
  };

  const startEditReceipt = (r) => {
    setEditingReceiptId(r.id);
    setEditDraftItems(r.items.map((it) => ({ ...it })));
    setEditReason("");
  };
  const cancelEditReceipt = () => {
    setEditingReceiptId(null);
    setEditDraftItems([]);
    setEditReason("");
  };
  const changeEditQty = (index, delta, original) => {
    setEditDraftItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = it.qty + delta;
        if (next < 0) return it;
        if (delta > 0) {
          const increaseBy = next - original;
          const shortage = (it.recipeSnapshot || []).find((rec) => (ingredients[rec.ingredientId]?.stock ?? 0) < rec.qty * increaseBy);
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
    const cleaned = editDraftItems.filter((it) => it.qty > 0);
    // Paired by position, not by menu item id — a receipt can have two lines for the same dish
    // with different notes (e.g. one plain, one "no onions"), and matching by id alone would
    // conflate them.
    const changes = [];
    r.items.forEach((orig, i) => {
      const edited = editDraftItems[i];
      const newQty = edited ? edited.qty : 0;
      const delta = orig.qty - newQty;
      if (delta !== 0) {
        (orig.recipeSnapshot || []).forEach((rec) => updateIngredientStock(rec.ingredientId, rec.qty * delta));
        changes.push({ name: orig.name, from: orig.qty, to: newQty });
      }
    });
    const newSubtotal = cleaned.reduce((s, it) => s + it.price * it.qty, 0);
    const newDiscAmt = discountAmount(newSubtotal, r.discount);
    // Recomputed using THIS receipt's own stored rates, not today's live settings — editing an
    // old order shouldn't retroactively apply a VAT/service rate change made since then.
    const newNet = newSubtotal - newDiscAmt;
    const newServiceAmt = Math.round(newNet * ((r.serviceRate || 0) / 100) * 100) / 100;
    const newVatAmt = Math.round((newNet + newServiceAmt) * ((r.vatRate || 0) / 100) * 100) / 100;
    const historyEntry = changes.length > 0
      ? {
          timestamp: new Date().toISOString(),
          editedBy: currentEmployee ? { id: currentEmployee.id, name: currentEmployee.name } : null,
          reason: editReason.trim(),
          changes,
        }
      : null;
    const newTotal = newNet + newServiceAmt + newVatAmt + (r.deliveryFee || 0);
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
      discountAmount: newDiscAmt,
      serviceAmount: newServiceAmt,
      vatAmount: newVatAmt,
      total: newTotal,
      splitPayments: rescaledSplitPayments,
      editHistory: historyEntry ? [historyEntry, ...(r.editHistory || [])] : r.editHistory,
    };
    persistMonth(currentMonth, monthReceipts.map((x) => (x.id === r.id ? updatedReceipt : x)));
    flashNotice(t("notice_orderUpdated", { n: r.ticketNo }));
    cancelEditReceipt();
  };

  const monthReceiptsForShift = receiptsByMonth[thisMonthKey()] || [];
  const shiftReceipts = shiftStart ? monthReceiptsForShift.filter((r) => r.timestamp >= shiftStart) : [];
  const shiftCompleted = shiftReceipts.filter((r) => r.status === "completed");
  const shiftCancelled = shiftReceipts.filter((r) => r.status === "cancelled");
  const shiftRefunded = shiftReceipts.filter((r) => r.status === "refunded");
  const shiftGross = shiftCompleted.reduce((s, r) => s + r.total, 0);
  const shiftRefundsTotal = shiftRefunded.reduce((s, r) => s + r.total, 0);
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
  const shiftCashSalesTotal = shiftByMethod.find((m) => m.id === "cash")?.total || 0;
  const shiftUnpaid = shiftCompleted.filter((r) => r.paid === false);
  const shiftUnpaidTotal = shiftUnpaid.reduce((s, r) => s + r.total, 0);
  // A cash refund is cash actually leaving the drawer back to the customer — unlike a cancellation
  // (which the app treats as the order never having happened financially), so it belongs in the
  // cash reconciliation the same way an expense paid in cash does.
  const shiftCashRefundsTotal = shiftRefunded.flatMap(receiptMethodAmounts).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
  const shiftDiscountTotal = shiftCompleted.reduce((s, r) => s + (r.discountAmount || 0), 0);
  // Expenses only carry a date (not a timestamp), so "this shift" is approximated as anything
  // logged on or after the shift's start date — exact enough for the normal case of a shift that
  // doesn't span midnight, and still reasonable for one that does.
  const shiftStartDateStr = shiftStart ? shiftStart.slice(0, 10) : null;
  const shiftCashExpenses = shiftStartDateStr
    ? Object.values(expensesByMonth).flat().filter((e) => e.status === "paid" && e.paymentMethod === "cash" && e.date >= shiftStartDateStr)
    : [];
  const shiftCashExpensesTotal = shiftCashExpenses.reduce((s, e) => s + e.amount, 0);
  const openingFloatNum = Number(openingFloat) || 0;
  const expectedCash = openingFloatNum + shiftCashSalesTotal - shiftCashRefundsTotal - shiftCashExpensesTotal;
  const countedCashNum = countedCash === "" ? null : Number(countedCash) || 0;
  const cashVariance = countedCashNum === null ? null : Math.round((countedCashNum - expectedCash) * 100) / 100;

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
        ${shiftDiscountTotal > 0 ? `<div class="row" style="font-size:12px;"><span>${escapeHtml(t("discountsGiven"))}</span><span>-${money(shiftDiscountTotal)}</span></div>` : ""}
        <div class="row" style="font-size:15px;font-weight:700;margin-top:4px;"><span>${escapeHtml(t("net"))}</span><span>${money(shiftGross - shiftRefundsTotal)}</span></div>
      </div>
      <div class="dashed" style="font-size:12px;">
        <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(t("cashReconciliationTitle"))}</div>
        <div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("openingFloatLabel"))}</span><span>${money(openingFloatNum)}</span></div>
        <div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("cashSalesLabel"))}</span><span>${money(shiftCashSalesTotal)}</span></div>
        ${shiftCashRefundsTotal > 0 ? `<div class="row" style="margin-bottom:3px;"><span>${escapeHtml(t("cashRefundsLabel"))}</span><span>-${money(shiftCashRefundsTotal)}</span></div>` : ""}
        ${cashExpenseRows}
        <div class="row" style="font-weight:700;margin-top:4px;"><span>${escapeHtml(t("expectedCashLabel"))}</span><span>${money(expectedCash)}</span></div>
        ${countedCashNum !== null ? `<div class="row" style="margin-top:3px;"><span>${escapeHtml(t("countedCashLabel"))}</span><span>${money(countedCashNum)}</span></div>` : ""}
        ${cashVariance !== null ? `<div class="row" style="font-weight:700;"><span>${escapeHtml(t("varianceLabel"))}</span><span>${cashVariance >= 0 ? "+" : ""}${money(cashVariance)}</span></div>` : ""}
      </div>`;
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
  const persistShiftLog = async (next) => {
    setShiftLog(next);
    syncSet("shift-log", JSON.stringify(next), true, t("syncLabelSettings"));
  };
  const doClockIn = async (emp) => {
    const now = new Date().toISOString();
    setCurrentEmployee({ id: emp.id, name: emp.name });
    setShiftStart(now);
    setOpeningFloat("0");
    setCountedCash("");
    setLoginSelectedId(null);
    setLoginPin("");
    setLoginError(false);
    setLoginAddMode(false);
    setLoginNewName("");
    setLoginNewPin("");
    // Login itself always works offline (it's just checking the PIN against the roster already
    // in memory) — only the "remember this session" writes can fail, and those are non-critical
    // enough to just queue quietly rather than block the person from getting to work.
    syncSet("current-employee", JSON.stringify({ id: emp.id, name: emp.name }), false, t("syncLabelSettings"));
    syncSet("shift-start", now, false, t("syncLabelSettings"));
    syncSet("opening-float", "0", false, t("syncLabelSettings"));
  };
  const updateOpeningFloat = (value) => {
    setOpeningFloat(value);
    syncSet("opening-float", value, false, t("syncLabelSettings"));
  };
  const attemptLogin = () => {
    const emp = employees.find((e) => e.id === loginSelectedId);
    if (!emp) return;
    if (loginPin !== emp.pin) {
      setLoginError(true);
      setLoginPin("");
      return;
    }
    doClockIn(emp);
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
    doClockIn(emp);
  };
  const clockOut = () => {
    if (!currentEmployee) return;
    setConfirmDialog({
      message: t("confirm_clockOut"),
      onConfirm: () => {
        const clockOutTime = new Date().toISOString();
        const hoursMs = shiftStart ? new Date(clockOutTime) - new Date(shiftStart) : 0;
        const top = myTopSeller();
        setShiftRecap({ name: currentEmployee.name, orders: myShiftCompleted.length, revenue: myShiftRevenue, avg: myShiftAvgOrder, hoursMs, topSeller: top });
        persistShiftLog([
          { id: `shift_${Date.now()}`, employeeId: currentEmployee.id, employeeName: currentEmployee.name, clockIn: shiftStart, clockOut: clockOutTime, orders: myShiftCompleted.length, revenue: myShiftRevenue },
          ...shiftLog,
        ]);
      },
    });
  };
  const finishClockOut = async () => {
    setShiftRecap(null);
    setCurrentEmployee(null);
    setShiftStart(null);
    setOpeningFloat("0");
    setCountedCash("");
    setUnlockedTabs(new Set());
    try {
      await storage.delete("current-employee", false);
      await storage.delete("shift-start", false);
      await storage.delete("opening-float", false);
    } catch (e) {
      // non-fatal — worst case the next load briefly shows a stale session before this clears
    }
  };
  const addStaffMember = () => {
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
    persistEmployees([...employees, { id: `emp_${Date.now()}`, name, pin: newStaffPin, role: "staff" }]);
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
      onConfirm: () => persistEmployees(employees.filter((e) => e.id !== id)),
    });
  };
  const toggleEmployeeRole = (emp) => {
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
      persistEmployees(employees.map((e) => (e.id === emp.id ? { ...e, role: "staff" } : e)));
    } else {
      persistEmployees(employees.map((e) => (e.id === emp.id ? { ...e, role: "manager" } : e)));
    }
  };
  const saveEditedPin = (id) => {
    if (id !== currentEmployee?.id) return; // staff can only ever change their own PIN, not a colleague's
    if (!/^\d{4}$/.test(editingPinValue)) {
      flashNotice(t("notice_pinMustBe4Digits"));
      return;
    }
    persistEmployees(employees.map((e) => (e.id === id ? { ...e, pin: editingPinValue } : e)));
    setEditingPinId(null);
    setEditingPinValue("");
  };
  const leaderboard = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = {};
    shiftLog.forEach((s) => {
      if (new Date(s.clockOut).getTime() < cutoff) return;
      if (!totals[s.employeeId]) totals[s.employeeId] = { name: s.employeeName, revenue: 0, orders: 0 };
      totals[s.employeeId].revenue += s.revenue;
      totals[s.employeeId].orders += s.orders;
    });
    return Object.values(totals).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [shiftLog]);
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
    setNewCategoryName("");
  };
  const deleteCategory = (cat) => {
    setConfirmDialog({
      message: t("confirm_deleteCategory", { name: cat }),
      onConfirm: () => {
        setCategories((prev) => prev.filter((c) => c !== cat));
        setMenu((prev) => {
          const next = { ...prev };
          delete next[cat];
          return next;
        });
        if (active === cat) setActive(categories.find((c) => c !== cat) || "");
      },
    });
  };

  const openNewItem = (category) => {
    setItemEditor({ mode: "new", category, id: null, name: "", tag: "", price: "", recipe: [] });
    setRecipeDraftIng("");
    setRecipeDraftQty("");
  };
  const openEditItem = (category, item) => {
    setItemEditor({ mode: "edit", category, id: item.id, name: item.name, tag: item.tag, price: String(item.price), recipe: item.recipe.map((r) => ({ ...r })) });
    setRecipeDraftIng("");
    setRecipeDraftQty("");
  };
  const closeItemEditor = () => setItemEditor(null);

  const addRecipeLine = () => {
    if (!recipeDraftIng || !recipeDraftQty || Number(recipeDraftQty) <= 0) {
      flashNotice("Pick an ingredient and a quantity used per serving");
      return;
    }
    setItemEditor((prev) => {
      const withoutDup = prev.recipe.filter((r) => r.ingredientId !== recipeDraftIng);
      return { ...prev, recipe: [...withoutDup, { ingredientId: recipeDraftIng, qty: Number(recipeDraftQty) }] };
    });
    setRecipeDraftIng("");
    setRecipeDraftQty("");
  };
  const removeRecipeLine = (ingredientId) => {
    setItemEditor((prev) => ({ ...prev, recipe: prev.recipe.filter((r) => r.ingredientId !== ingredientId) }));
  };

  const saveItemEditor = () => {
    const { mode, category, id, name, tag, price, recipe } = itemEditor;
    if (!name.trim() || !price || Number(price) <= 0) {
      flashNotice("Give the item a name and a valid price");
      return;
    }
    const itemData = { id: mode === "new" ? newId("item") : id, name: name.trim(), tag: tag.trim(), price: Number(price), recipe };
    setMenu((prev) => {
      const list = prev[category] || [];
      const nextList = mode === "new" ? [...list, itemData] : list.map((it) => (it.id === id ? itemData : it));
      return { ...prev, [category]: nextList };
    });
    flashNotice(mode === "new" ? t("notice_itemAdded", { name: itemData.name }) : t("notice_itemUpdated", { name: itemData.name }));
    closeItemEditor();
  };
  const deleteMenuItem = (category, item) => {
    setConfirmDialog({
      message: t("confirm_removeMenuItem", { name: item.name }),
      onConfirm: () => setMenu((prev) => ({ ...prev, [category]: prev[category].filter((it) => it.id !== item.id) })),
    });
  };

  const MAX_MENU_SCAN_BYTES = 8 * 1024 * 1024;
  const handleMenuScanFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      flashNotice(t("notice_logoInvalidType"));
      return;
    }
    if (file.size > MAX_MENU_SCAN_BYTES) {
      flashNotice(t("notice_menuScanTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("notice_menuScanFailed"));
        setMenuScanResults(data.items.map((it) => ({ ...it, include: true })));
        logActivity("menu_scanned", `${data.items.length} item(s) read`);
      } catch (e) {
        setMenuScanError(e.message || t("notice_menuScanFailed"));
      } finally {
        setMenuScanning(false);
      }
    };
    reader.onerror = () => flashNotice(t("notice_logoInvalidType"));
    reader.readAsDataURL(file);
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
          color: COLORS.paper,
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
            background: COLORS.inkSoft,
            border: "1px solid #3A404C",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #3A404C", fontFamily: isRtl ? "Tajawal, sans-serif" : "Fraunces, serif", fontSize: 14, fontWeight: 600 }}>
            {t("helpChatTitle")}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {helpChatMessages.length === 0 && (
              <>
                <div style={{ fontSize: 12.5, color: "#9CA1AC", lineHeight: 1.5 }}>{t("helpChatWelcome")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {["helpChatSuggestion1", "helpChatSuggestion2", "helpChatSuggestion3", "helpChatSuggestion4"].map((key) => (
                    <button
                      key={key}
                      onClick={() => sendHelpMessage(t(key))}
                      style={{ textAlign: isRtl ? "right" : "left", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}
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
                  background: m.role === "user" ? theme.primary : "#2E3440",
                  color: m.role === "user" ? COLORS.paper : COLORS.paper,
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
            {helpChatSending && <div style={{ fontSize: 11.5, color: "#8A8F99" }}>{t("helpChatThinking")}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid #3A404C" }}>
            <input
              type="text"
              value={helpChatInput}
              onChange={(e) => setHelpChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendHelpMessage(helpChatInput);
              }}
              placeholder={t("helpChatPlaceholder")}
              style={{ flex: 1, background: "#FFFFFF", border: "1px solid #3A404C", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
            />
            <button
              onClick={() => sendHelpMessage(helpChatInput)}
              disabled={helpChatSending || !helpChatInput.trim()}
              style={{ padding: "0 14px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 12.5, fontWeight: 600, cursor: helpChatSending ? "default" : "pointer", opacity: helpChatSending || !helpChatInput.trim() ? 0.6 : 1 }}
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
  if (!currentEmployeeLoaded || !employeesLoaded) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: COLORS.ink, minHeight: "100vh", color: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("loading")}</div>
      </div>
    );
  }

  if (!currentEmployee) {
    const selectedEmp = employees.find((e) => e.id === loginSelectedId);
    return (
      <div dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: COLORS.ink, minHeight: "100vh", color: COLORS.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{FONTS}</style>
        <style>{`
          button { transition: filter .12s ease, background .15s ease, border-color .15s ease, transform .08s ease; }
          button:not(:disabled):hover { filter: brightness(1.14); }
          button:not(:disabled):active { transform: scale(0.97); }
          input:focus { outline: none; border-color: ${theme.secondary} !important; box-shadow: 0 0 0 3px ${theme.secondary}33; }
        `}</style>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {logoUrl && <img src={logoUrl} alt={restaurantName} style={{ height: 44, width: "auto", maxWidth: 160, objectFit: "contain", margin: "0 auto 10px", display: "block" }} />}
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600 }}>{restaurantName}</div>
          </div>

          {rosterLoadFailed ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, fontFamily: "Fraunces, serif" }}>{t("offlineBadge")}</div>
              <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 18, lineHeight: 1.5 }}>{t("rosterLoadFailedHint")}</div>
              <button onClick={retryRosterLoad} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("retrySync")}</button>
            </div>
          ) : employees.length === 0 || loginAddMode ? (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, fontFamily: "Fraunces, serif", textAlign: "center" }}>{t("loginWelcome")}</div>
              <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 18, textAlign: "center" }}>{employees.length === 0 ? t("loginNoStaffYet") : t("loginSubtitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  value={loginNewName}
                  onChange={(e) => setLoginNewName(e.target.value)}
                  placeholder={t("yourNamePlaceholder")}
                  style={{ background: "#FFFFFF", border: "1px solid #3A404C", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Inter', sans-serif" }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={loginNewPin}
                  onChange={(e) => setLoginNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder={t("choosePinPlaceholder")}
                  style={{ background: "#FFFFFF", border: "1px solid #3A404C", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: "IBM Plex Mono, monospace", letterSpacing: 4, textAlign: "center" }}
                />
                <button onClick={addEmployeeFromLogin} style={{ padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("createPinAndStart")}</button>
                {employees.length > 0 && (
                  <button onClick={() => { setLoginAddMode(false); setLoginNewName(""); setLoginNewPin(""); }} style={{ padding: "10px 0", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 13, cursor: "pointer" }}>{t("loginBackToNames")}</button>
                )}
              </div>
            </div>
          ) : selectedEmp ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{selectedEmp.name}</div>
              <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 20 }}>{t("enterPin")}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: loginError ? 6 : 22 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${theme.secondary}`, background: i < loginPin.length ? theme.secondary : "transparent" }} />
                ))}
              </div>
              {loginError && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 16 }}>{t("pinIncorrect")}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    onClick={() => { setLoginError(false); setLoginPin((p) => (p.length < 4 ? p + d : p)); }}
                    style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: COLORS.inkSoft, color: COLORS.paper, fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
                  >
                    {d}
                  </button>
                ))}
                <button onClick={() => { setLoginSelectedId(null); setLoginPin(""); setLoginError(false); }} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 12, cursor: "pointer" }}>{t("loginBackToNames")}</button>
                <button
                  onClick={() => { setLoginError(false); setLoginPin((p) => (p.length < 4 ? p + "0" : p)); }}
                  style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: COLORS.inkSoft, color: COLORS.paper, fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
                >
                  0
                </button>
                <button onClick={() => setLoginPin((p) => p.slice(0, -1))} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 16, cursor: "pointer" }}>&larr;</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, fontFamily: "Fraunces, serif", textAlign: "center" }}>{t("loginWelcome")}</div>
              <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 18, textAlign: "center" }}>{t("loginSubtitle")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => { setLoginSelectedId(emp.id); setLoginPin(""); setLoginError(false); }}
                    style={{ padding: "16px 8px", borderRadius: 10, border: "1px solid #3A404C", background: COLORS.inkSoft, color: COLORS.paper, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                      {initials(emp.name)}
                    </div>
                    <span style={{ fontSize: 12 }}>{emp.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setLoginAddMode(true)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1px dashed #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 12.5, cursor: "pointer" }}>{t("loginAddYourself")}</button>
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: 28, fontSize: 10, letterSpacing: 0.6, color: "#4A4F5A" }}>G&amp;B</div>
        </div>
        {hasFeature("helpChat") && helpChatWidget}
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: COLORS.ink, minHeight: "100vh", color: COLORS.paper }}>
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
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #3A404C; border-radius: 3px; }
        .stock-input::-webkit-inner-spin-button { opacity: 1; }
        .field { background: #FFFFFF; border: 1px solid #3A404C; border-radius: 7px; padding: 9px 12px; color: #111111; font-size: 13px; font-family: ${isRtl ? "'Tajawal', sans-serif" : "'Inter', sans-serif"}; }
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
          <div style={{ display: "flex", background: COLORS.inkSoft, borderRadius: 999, padding: 3, border: "1px solid #3A404C", flexWrap: isCompact ? "nowrap" : "wrap", overflowX: isCompact ? "auto" : undefined, maxWidth: isCompact ? "100%" : undefined, WebkitOverflowScrolling: "touch" }}>
            {["order", "menu", "stock", "tables", "delivery", "receipts", "expenses", "dashboard", "customers", "shift", "staff", "settings"]
              .filter((key) => {
                if (key === "order" || key === "settings") return true;
                // "delivery" isn't itself a package feature key — the tab shows if either of its
                // two sub-features (the online-ordering link, delivery zones) is enabled, and the
                // tab's own content decides what to actually render based on which one(s) are on.
                if (key === "delivery") return hasFeature("onlineOrderingLink") || hasFeature("deliveryZones");
                return hasFeature(key);
              })
              .map((key) => {
                const locked = hasFeature("tabAccessControl") && pinGatedTabs.includes(key) && !isManager && !unlockedTabs.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleTabClick(key)}
                    className="view-pill"
                    title={locked ? t("gatedTabTooltip") : undefined}
                    style={{
                      padding: isMobile ? "7px 11px" : "7px 14px",
                      borderRadius: 999,
                      border: "none",
                      background: view === key ? theme.primary : "transparent",
                      color: view === key ? COLORS.paper : "#9CA1AC",
                      fontSize: isMobile ? 12.5 : 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {locked && "🔒 "}{t(`tab_${key}`)}
                  </button>
                );
              })}
          </div>
          <div style={{ display: "flex", background: COLORS.inkSoft, borderRadius: 999, padding: 3, border: "1px solid #3A404C" }} title={t("langToggleLabel")}>
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
                  color: lang === code ? COLORS.paper : "#9CA1AC",
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
          {syncQueue.length > 0 && (
            <button
              onClick={flushSyncQueue}
              title={syncQueue.map((task) => task.label).join(", ")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              {tCount("syncPendingPill", syncQueue.length)} &middot; {t("retrySync")}
            </button>
          )}
          {pendingOrders.length > 0 && (
            <button
              onClick={() => handleTabClick("tables")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid #C9A24A", background: "rgba(201,162,74,0.15)", color: "#E3C98A", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E3C98A", display: "inline-block" }} />
              {tCount("pendingOrdersPill", pendingOrders.length)}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 24, fontSize: isMobile ? 12 : 13, color: "#9CA1AC", flexWrap: "wrap" }}>
            <span>{t("orderingForLabel")} <b style={{ color: COLORS.paper, fontWeight: 500 }}>{tableLabel(activeTableId)}</b></span>
            {!isMobile && hasFeature("staff") && <span>{t("serverLabel")} <b style={{ color: COLORS.paper, fontWeight: 500 }}>{currentEmployee?.name}</b></span>}
            {hasFeature("shift") && <button onClick={clockOut} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 999, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("clockOut")}</button>}
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
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActive(cat)}
                  className="tab-pill"
                  style={{
                    padding: "9px 20px",
                    borderRadius: 999,
                    border: `1px solid ${active === cat ? theme.primary : "#3A404C"}`,
                    background: active === cat ? theme.primary : "transparent",
                    color: active === cat ? COLORS.paper : "#9CA1AC",
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {(menu[active] || []).map((item) => {
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
                      background: COLORS.inkSoft,
                      border: `1px solid ${out ? "#4A2E2C" : "#363C47"}`,
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
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                        {initials(item.name)}
                      </div>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: theme.secondary }}>{money(item.price)}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 500, color: COLORS.paper, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#8A8F99", marginBottom: 6 }}>{item.tag}</div>
                      <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 999, background: badge.color, color: badge.fg, fontWeight: 500, letterSpacing: 0.3 }}>{badge.text}</span>
                    </div>
                  </button>
                );
              })}
              {(menu[active] || []).length === 0 && (
                <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noItemsInCategory")}</div>
              )}
            </div>
          </div>

          <div style={{ width: isCompact ? "100%" : 360, padding: isCompact ? (isMobile ? "0 14px 16px" : "0 20px 20px") : "28px 28px 28px 0", flexShrink: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 2 }}>
              <button
                onClick={() => switchTable(null)}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === null ? theme.secondary : "#3A404C"}`, background: activeTableId === null ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === null ? theme.secondaryLight : "#9CA1AC", fontSize: 11.5, fontWeight: activeTableId === null ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap", position: "relative" }}
              >
                {t("takeawayDelivery")}
                {tableItemCount(null) > 0 && <span style={{ marginLeft: 5, fontSize: 9.5, background: theme.secondary, color: COLORS.ink, borderRadius: 999, padding: "1px 5px" }}>{tableItemCount(null)}</span>}
              </button>
              {hasFeature("tables") ? (
                tableIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => switchTable(id)}
                    style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === id ? theme.secondary : "#3A404C"}`, background: activeTableId === id ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === id ? theme.secondaryLight : "#9CA1AC", fontSize: 11.5, fontWeight: activeTableId === id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}
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
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activeTableId === "dine-in" ? theme.secondary : "#3A404C"}`, background: activeTableId === "dine-in" ? "rgba(176,141,87,0.18)" : "transparent", color: activeTableId === "dine-in" ? theme.secondaryLight : "#9CA1AC", fontSize: 11.5, fontWeight: activeTableId === "dine-in" ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {t("dineInLabel")}
                  {tableItemCount("dine-in") > 0 && <span style={{ marginLeft: 5, fontSize: 9.5, background: theme.secondary, color: COLORS.ink, borderRadius: 999, padding: "1px 5px" }}>{tableItemCount("dine-in")}</span>}
                </button>
              )}
            </div>
            <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: "4px 4px 10px 10px", clipPath: "polygon(0% 3%, 4% 0%, 8% 3%, 12% 0%, 16% 3%, 20% 0%, 24% 3%, 28% 0%, 32% 3%, 36% 0%, 40% 3%, 44% 0%, 48% 3%, 52% 0%, 56% 3%, 60% 0%, 64% 3%, 68% 0%, 72% 3%, 76% 0%, 80% 3%, 84% 0%, 88% 3%, 92% 0%, 96% 3%, 100% 0%, 100% 100%, 0% 100%)", padding: "22px 20px 20px", fontFamily: "IBM Plex Mono, monospace" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{t("ticketNumber", { n: ticketNo })}</span>
                <span style={{ fontSize: 10.5, letterSpacing: 1, padding: "3px 8px", borderRadius: 999, background: saved ? "#E3EBE3" : "#EFE4CB", color: saved ? COLORS.sage : "#8A6A2E", textTransform: "uppercase", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
                  {saved ? t("saved") : t("open")}
                </span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{tableLabel(activeTableId)} &middot; {currentEmployee?.name}</span>
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
                        <button onClick={() => setEditingNoteLineId(null)} style={{ fontSize: 11, background: theme.primary, color: COLORS.paper, border: "none", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}>{t("apply")}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {hasFeature("discounts") && isManager && (
                <div style={{ borderTop: `1.5px dashed ${COLORS.line}`, marginTop: 6, paddingTop: 12 }}>
                  {!discount && !discountOpen && (
                    <button onClick={() => setDiscountOpen(true)} style={{ fontSize: 11.5, color: theme.primary, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>{t("addDiscount")}</button>
                  )}
                  {discountOpen && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "Inter, sans-serif" }}>
                      <select value={discountDraft.type} onChange={(e) => setDiscountDraft((d) => ({ ...d, type: e.target.value }))} style={{ fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "4px 4px", background: "transparent" }}>
                        <option value="percent">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input type="number" value={discountDraft.value} onChange={(e) => setDiscountDraft((d) => ({ ...d, value: e.target.value }))} placeholder="0" style={{ width: 54, fontSize: 11.5, border: `1px solid ${COLORS.line}`, borderRadius: 5, padding: "4px 6px", background: "transparent" }} />
                      <button onClick={applyDiscount} style={{ fontSize: 11, background: theme.primary, color: COLORS.paper, border: "none", borderRadius: 5, padding: "5px 9px", cursor: "pointer" }}>{t("apply")}</button>
                      <button onClick={() => setDiscountOpen(false)} style={{ fontSize: 11, background: "none", color: COLORS.charcoalSoft, border: "none", cursor: "pointer" }}>{t("cancel")}</button>
                    </div>
                  )}
                  {discount && !discountOpen && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Inter, sans-serif" }}>
                      <span style={{ fontSize: 12 }}>{t("discountLabel", { value: discount.type === "percent" ? `${discount.value}%` : money(Number(discount.value)) })}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setDiscountOpen(true)} style={{ fontSize: 11, color: COLORS.charcoalSoft, background: "none", border: "none", cursor: "pointer" }}>{t("edit")}</button>
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
                    <button onClick={applySplit} style={{ fontSize: 11, background: theme.primary, color: COLORS.paper, border: "none", borderRadius: 5, padding: "5px 9px", cursor: "pointer" }}>{t("apply")}</button>
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
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("assignedToLabel")}</div>
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
                  {dutyRoster.filter((m) => m.role === "waiter").length > 0 && (
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

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("customerOptional")}</div>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSuggestions(true); }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                  placeholder={t("searchCustomerPlaceholder")}
                  style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: `1px solid ${theme.secondary}`, borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13, fontFamily: "Inter, sans-serif" }}
                />
                {showCustomerSuggestions && customerSearch && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: COLORS.inkSoft, border: "1px solid #3A404C", borderRadius: 8, zIndex: 20, overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,0.4)" }}>
                    {customerMatches.length === 0 ? (
                      <div style={{ padding: "10px 12px", fontSize: 12, color: "#8A8F99" }}>{t("noMatchesNewCustomer")}</div>
                    ) : (
                      customerMatches.map((c) => (
                        <button key={c.phone} onMouseDown={() => selectCustomer(c)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid #333945", padding: "9px 12px", cursor: "pointer", color: COLORS.paper }}>
                          <div style={{ fontSize: 13 }}>{c.name || t("unnamed")}</div>
                          <div style={{ fontSize: 11, color: "#9CA1AC", fontFamily: "IBM Plex Mono, monospace" }}>{c.phone}{c.address ? ` · ${c.address}` : ""}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("namePlaceholder")} className="field" />
                <input type="tel" value={customerPhone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder={t("phonePlaceholder")} className="field" />
                <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder={t("addressPlaceholder")} className="field" />
                <input type="text" value={orderEta} onChange={(e) => setOrderEta(e.target.value)} placeholder={t("etaPlaceholder")} className="field" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              {PAYMENT_METHODS.map((m) => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)} className="pay-pill" style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${paymentMethod === m.id ? theme.secondary : "#3A404C"}`, background: paymentMethod === m.id ? "#3A2E22" : "transparent", color: paymentMethod === m.id ? theme.secondaryLight : "#9CA1AC", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                  {t(`payment_${m.id}`)}
                </button>
              ))}
              <button onClick={() => { setPaymentMethod("split"); setPaidNow(true); }} className="pay-pill" style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${paymentMethod === "split" ? theme.secondary : "#3A404C"}`, background: paymentMethod === "split" ? "#3A2E22" : "transparent", color: paymentMethod === "split" ? theme.secondaryLight : "#9CA1AC", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
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
                      <span style={{ fontSize: 12.5, color: "#9CA1AC" }}>{t(`payment_${m.id}`)}</span>
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
                <button onClick={() => setPaidNow(true)} className="pay-pill" style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${paidNow ? "#3F5B45" : "#3A404C"}`, background: paidNow ? "#22301F" : "transparent", color: paidNow ? "#9FCB8E" : "#9CA1AC", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  {t("paidNowOption")}
                </button>
                <button onClick={() => setPaidNow(false)} className="pay-pill" style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${!paidNow ? "#5B4F3F" : "#3A404C"}`, background: !paidNow ? "#33301F" : "transparent", color: !paidNow ? "#E3C98A" : "#9CA1AC", fontSize: 12, fontWeight: 500, cursor: "pointer" }} title={t("payLaterHint")}>
                  {t("payLaterOption")}
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button disabled={cart.length === 0} onClick={printOrderReceipt} title={t("printReceiptTooltip")} style={{ flex: 1, padding: "13px 0", borderRadius: 8, border: `1px solid ${cart.length === 0 ? "#3A404C" : theme.secondary}`, background: "transparent", color: cart.length === 0 ? "#5A5F6A" : theme.secondaryLight, fontSize: 14, fontWeight: 500, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.5 : 1 }}>
                {t("printReceipt")}
              </button>
              <button disabled={cart.length === 0} onClick={downloadOrderReceipt} title={t("downloadReceiptTooltip")} style={{ padding: "13px 16px", borderRadius: 8, border: `1px solid ${cart.length === 0 ? "#3A404C" : "#3A404C"}`, background: "transparent", color: cart.length === 0 ? "#5A5F6A" : "#9CA1AC", fontSize: 14, fontWeight: 500, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.5 : 1 }}>
                {t("download")}
              </button>
              <button disabled={cart.length === 0} onClick={saveOrder} className="save-btn" style={{ flex: 1, padding: "13px 0", borderRadius: 8, border: "none", background: cart.length === 0 ? "#4A2C33" : paidNow ? theme.primary : "#8A6A2E", color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.6 : 1 }}>
                {paidNow ? t("saveOrder") : t("saveOrderUnpaid")}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "menu" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 900 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("menuEditorTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("menuEditorSubtitle")}</div>
          </div>

          {hasFeature("menuScan") && (
            <div style={{ background: COLORS.inkSoft, border: `1px dashed ${theme.secondary}`, borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{t("scanMenuButton")}</div>
                <div style={{ fontSize: 11.5, color: "#8A8F99" }}>{t("scanMenuHint")}</div>
              </div>
              <label style={{ fontSize: 12.5, padding: "9px 16px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", fontWeight: 500, flexShrink: 0 }}>
                {t("scanMenuButton")}
                <input type="file" accept="image/*" onChange={(e) => handleMenuScanFile(e.target.files?.[0])} style={{ display: "none" }} />
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder={t("newCategoryPlaceholder")} className="field" style={{ flex: 1 }} />
            <button onClick={addCategory} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addCategory")}</button>
          </div>

          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "Fraunces, serif" }}>{cat}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openNewItem(cat)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>{t("addItem")}</button>
                  <button onClick={() => deleteCategory(cat)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("deleteCategory")}</button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(menu[cat] || []).map((item) => (
                  <div key={item.id} style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name} <span style={{ color: theme.secondary, fontFamily: "IBM Plex Mono, monospace", fontWeight: 400 }}>{money(item.price)}</span></div>
                        <div style={{ fontSize: 12, color: "#8A8F99", marginTop: 2 }}>{item.tag}</div>
                        <div style={{ fontSize: 11.5, color: "#9CA1AC", marginTop: 6 }}>
                          {item.recipe.length === 0 ? t("noRecipeSet") : item.recipe.map((r) => `${fmtQty(r.qty)}${ingredients[r.ingredientId]?.unit || ""} ${ingredients[r.ingredientId]?.name || "?"}`).join(", ")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => openEditItem(cat, item)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("edit")}</button>
                        <button onClick={() => deleteMenuItem(cat, item)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("delete")}</button>
                      </div>
                    </div>
                  </div>
                ))}
                {(menu[cat] || []).length === 0 && <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("noItemsYet")}</div>}
              </div>
            </div>
          ))}

          {itemEditor && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
              <div style={{ background: COLORS.inkSoft, border: "1px solid #3A404C", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto" }}>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>
                  {itemEditor.mode === "new" ? t("addItemToCategory", { category: itemEditor.category }) : t("editItemTitle", { name: itemEditor.name })}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <input type="text" value={itemEditor.name} onChange={(e) => setItemEditor((p) => ({ ...p, name: e.target.value }))} placeholder={t("dishNamePlaceholder")} className="field" />
                  <input type="text" value={itemEditor.tag} onChange={(e) => setItemEditor((p) => ({ ...p, tag: e.target.value }))} placeholder={t("shortDescriptionPlaceholder")} className="field" />
                  <input type="number" value={itemEditor.price} onChange={(e) => setItemEditor((p) => ({ ...p, price: e.target.value }))} placeholder={t("pricePlaceholder")} className="field" />
                </div>

                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("recipeLabel")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {itemEditor.recipe.map((r) => (
                    <div key={r.ingredientId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, background: COLORS.ink, borderRadius: 6, padding: "7px 10px" }}>
                      <span>{fmtQty(r.qty)} {ingredients[r.ingredientId]?.unit} &middot; {ingredients[r.ingredientId]?.name}</span>
                      <button onClick={() => removeRecipeLine(r.ingredientId)} style={{ background: "none", border: "none", color: "#E3A79C", cursor: "pointer", fontSize: 13 }}>&times;</button>
                    </div>
                  ))}
                  {itemEditor.recipe.length === 0 && <div style={{ fontSize: 12, color: "#8A8F99" }}>{t("noIngredientsAdded")}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={recipeDraftIng} onChange={(e) => setRecipeDraftIng(e.target.value)} className="field" style={{ flex: 1 }}>
                    <option value="">{t("selectIngredient")}</option>
                    {Object.values(ingredients).sort((a, b) => a.name.localeCompare(b.name)).map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                    ))}
                  </select>
                  <input type="number" value={recipeDraftQty} onChange={(e) => setRecipeDraftQty(e.target.value)} placeholder={t("qtyPlaceholder")} className="field" style={{ width: 70 }} />
                  <button onClick={addRecipeLine} style={{ padding: "9px 12px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", fontSize: 12 }}>{t("add")}</button>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button onClick={saveItemEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{t("saveItem")}</button>
                  <button onClick={closeItemEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 13.5, cursor: "pointer" }}>{t("cancel")}</button>
                </div>
              </div>
            </div>
          )}

          {menuScanImage && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
              <div style={{ background: COLORS.inkSoft, border: "1px solid #3A404C", borderRadius: 14, padding: 24, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
                <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>{t("scanMenuModalTitle")}</div>

                <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                  <img src={menuScanImage} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #363C47", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    {menuScanning && <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("scanMenuScanning")}</div>}
                    {menuScanError && <div style={{ fontSize: 13, color: "#E3A79C" }}>{menuScanError}</div>}
                    {menuScanResults && !menuScanning && (
                      <div style={{ fontSize: 13, color: theme.secondaryLight }}>{t("scanMenuReviewTitle", { n: menuScanResults.length })}</div>
                    )}
                  </div>
                </div>

                {menuScanResults && !menuScanning && (
                  <>
                    <div style={{ fontSize: 11.5, color: "#8A8F99", marginBottom: 12 }}>{t("scanMenuReviewHint")}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                      {menuScanResults.map((it, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.ink, borderRadius: 8, padding: "8px 10px", opacity: it.include ? 1 : 0.5 }}>
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
                      <button onClick={addScannedItems} style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                        {t("scanMenuAddButton", { n: menuScanResults.filter((it) => it.include).length })}
                      </button>
                      <label style={{ flex: 1, textAlign: "center", padding: "11px 0", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 13, cursor: "pointer" }}>
                        {t("scanMenuTryAgain")}
                        <input type="file" accept="image/*" onChange={(e) => handleMenuScanFile(e.target.files?.[0])} style={{ display: "none" }} />
                      </label>
                    </>
                  ) : (
                    <button onClick={closeMenuScan} disabled={menuScanning} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 13.5, cursor: menuScanning ? "default" : "pointer", opacity: menuScanning ? 0.6 : 1 }}>
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
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("stockTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("stockSubtitle")}</div>
          </div>

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
            <input type="number" value={newIngStock} onChange={(e) => setNewIngStock(e.target.value)} placeholder={t("startingStockPlaceholder")} className="field" style={{ flex: 1, minWidth: 110 }} />
            <button onClick={addIngredient} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("add")}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#8A8F99", marginTop: -12, marginBottom: 20 }}>
            {t("unitHint")}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.values(ingredients).sort((a, b) => a.name.localeCompare(b.name)).map((ing) => {
              const out = ing.stock === 0;
              const low = ing.stock > 0 && ing.stock <= 2;
              const tagColor = out ? { bg: "#3A2A28", fg: "#E3A79C", text: t("outOfStock") } : low ? { bg: "#3A331F", fg: "#E3C98A", text: t("low") } : { bg: "#22301F", fg: "#9FCB8E", text: t("inStock") };
              return (
                <div key={ing.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                      {initials(ing.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{ing.name}</div>
                      <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: tagColor.bg, color: tagColor.fg, fontWeight: 500 }}>{tagColor.text} &middot; {fmtQty(ing.stock)} {ing.unit}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isManager && (
                      <button onClick={() => updateIngredientStock(ing.id, -1)} title={t("stockDecreaseTooltip")} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: COLORS.paper, cursor: "pointer", fontSize: 14 }}>&minus;</button>
                    )}
                    {isManager ? (
                      <input className="stock-input" type="number" value={ing.stock} onChange={(e) => setIngredientStockValue(ing.id, e.target.value)} style={{ width: 64, textAlign: "center", background: "transparent", border: "1px solid #3A404C", borderRadius: 6, color: COLORS.paper, fontFamily: "IBM Plex Mono, monospace", fontSize: 13, padding: "5px 0" }} />
                    ) : (
                      <span style={{ width: 64, textAlign: "center", color: COLORS.paper, fontFamily: "IBM Plex Mono, monospace", fontSize: 13, padding: "5px 0" }}>{fmtQty(ing.stock)}</span>
                    )}
                    <button onClick={() => updateIngredientStock(ing.id, 1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: COLORS.paper, cursor: "pointer", fontSize: 14 }}>+</button>
                    <button onClick={() => updateIngredientStock(ing.id, 10)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer", fontSize: 11.5, fontWeight: 500 }}>{t("restock10")}</button>
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
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("receiptsSubtitle")}</div>
          </div>

          {!monthsLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loadingHistory")}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                <select value={currentMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="field">
                  {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#9CA1AC" }}>
                  <span>{tCount("orderCount", monthReceipts.filter((r) => r.status === "completed").length)}</span>
                  <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{money(monthRevenue)}</span>
                </div>
              </div>
              {monthUnpaid.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -8, marginBottom: 18, fontSize: 12.5, color: "#F0D9A0" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#F0D9A0", display: "inline-block" }} />
                  {t("unpaidSummary", { n: monthUnpaid.length, amount: money(monthUnpaidTotal) })}
                </div>
              )}

              {loadingMonth ? (
                <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loadingMonth", { month: monthLabel(currentMonth) })}</div>
              ) : monthReceipts.length === 0 ? (
                <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noSavedOrdersForMonth", { month: monthLabel(currentMonth) })}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {monthReceipts.map((r) => {
                    const cancelled = r.status === "cancelled";
                    const refunded = r.status === "refunded";
                    const voided = cancelled || refunded;
                    const unpaid = !voided && r.paid === false;
                    const editing = editingReceiptId === r.id;
                    return (
                      <div key={r.id} style={{ background: COLORS.inkSoft, border: `1px solid ${voided ? "#4A2E2C" : unpaid ? "#5B4F3F" : "#363C47"}`, borderRadius: 10, padding: "14px 18px", opacity: voided ? 0.7 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontSize: 13, fontFamily: "IBM Plex Mono, monospace" }}>
                            {t("ticketHash", { n: r.ticketNo })} &middot; {new Date(r.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            {r.table && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2A2E3A", color: "#9CB0E3" }}>{r.table}</span>}
                            {r.servedBy?.name && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2A3A2E", color: "#9CE3B0" }}>{t("servedByLabel", { name: r.servedBy.name })}</span>}
                            {r.assignedTo?.name && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3" }}>{t("assignedToBadge", { role: r.assignedTo.role === "delivery" ? t("roleDelivery") : t("roleWaiter"), name: r.assignedTo.name })}</span>}
                            {r.paymentMethod && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2E3440", color: "#9CA1AC" }}>{t(`payment_${r.paymentMethod}`)}</span>}
                            {cancelled && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#33301F", color: "#E3C98A" }}>{t("cancelledBadge")}</span>}
                            {refunded && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#3A2A28", color: "#E3A79C" }}>{t("refundedBadge")}</span>}
                            {unpaid && <span title={t("unpaidOrderTooltip")} style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#5B4F3F", color: "#F0D9A0", fontWeight: 700 }}>{t("unpaidBadge")}</span>}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: voided ? "#8A8F99" : theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace", textDecoration: voided ? "line-through" : "none" }}>{money(r.total)}</span>
                        </div>
                        {r.splitCount > 1 && (
                          <div style={{ fontSize: 11, color: theme.secondaryLight, marginBottom: 6 }}>{t("splitLabel", { n: r.splitCount })} &middot; {t("eachPays", { amount: money(r.total / r.splitCount) })}</div>
                        )}
                        {r.paymentMethod === "split" && Array.isArray(r.splitPayments) && (
                          <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>
                            {r.splitPayments.map((sp, i) => (
                              <span key={sp.method}>
                                {t(`payment_${sp.method}`)} {money(sp.amount)}{i < r.splitPayments.length - 1 ? " + " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.customer && (r.customer.name || r.customer.phone) && (
                          <div style={{ fontSize: 11.5, color: "#9CA1AC", marginBottom: 8 }}>
                            {r.customer.name}{r.customer.name && r.customer.phone ? " · " : ""}{r.customer.phone}{r.customer.address ? ` · ${r.customer.address}` : ""}
                          </div>
                        )}

                        {!voided && r.customer?.phone && hasFeature("whatsappUpdates") && (
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 10.5, color: "#8A8F99" }}>{t("statusColon")}</span>
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
                                    border: `1px solid ${isCurrent ? theme.secondary : "#3A404C"}`,
                                    background: isCurrent ? "rgba(176,141,87,0.18)" : "transparent",
                                    color: isCurrent ? theme.secondaryLight : "#9CA1AC",
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
                          <div style={{ fontSize: 12, color: "#8A8F99", marginBottom: voided ? 0 : 10 }}>
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
                                  <button onClick={() => changeEditQty(index, -1, r.items[index]?.qty)} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid #3A404C", background: "transparent", color: COLORS.paper, cursor: "pointer" }}>−</button>
                                  <span style={{ fontFamily: "IBM Plex Mono, monospace", minWidth: 14, textAlign: "center" }}>{it.qty}</span>
                                  <button onClick={() => changeEditQty(index, 1, r.items[index]?.qty)} style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid #3A404C", background: "transparent", color: COLORS.paper, cursor: "pointer" }}>+</button>
                                </div>
                              </div>
                            ))}
                            <textarea
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder={t("editReasonPlaceholder")}
                              className="field"
                              rows={2}
                              style={{ width: "100%", resize: "vertical", fontSize: 12, marginTop: 4 }}
                            />
                            <div style={{ fontSize: 10.5, color: "#8A8F99", marginTop: 3 }}>{t("editReasonLabel")}</div>
                          </div>
                        )}

                        {!voided && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {editing ? (
                              <>
                                <button onClick={() => saveEditReceipt(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "none", background: theme.primary, color: COLORS.paper, cursor: "pointer", fontWeight: 500 }}>{t("saveChanges")}</button>
                                <button onClick={cancelEditReceipt} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("cancelEdit")}</button>
                              </>
                            ) : (
                              <>
                                {unpaid && (
                                  <button onClick={() => markReceiptPaid(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "none", background: "#8A6A2E", color: COLORS.paper, cursor: "pointer", fontWeight: 600 }}>{t("markOrderPaid")}</button>
                                )}
                                <button onClick={() => startEditReceipt(r)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("edit")}</button>
                                <button onClick={() => cancelReceipt(r)} title={t("cancelOrderTooltip")} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #C9A24A", background: "transparent", color: "#E3C98A", cursor: "pointer" }}>{t("cancelOrder")}</button>
                                <button onClick={() => refundReceipt(r)} title={t("refundOrderTooltip")} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("refundOrder")}</button>
                              </>
                            )}
                          </div>
                        )}

                        {!voided && isManager && hasFeature("teamTracking") && dutyRoster.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10.5, color: "#8A8F99" }}>{t("reassignLabel")}</span>
                            <select
                              value={r.assignedTo?.id || ""}
                              onChange={(e) => assignReceiptTo(r, dutyRoster.find((m) => m.id === e.target.value) || null)}
                              className="field"
                              style={{ fontSize: 11.5, padding: "4px 6px" }}
                            >
                              <option value="">{t("assignedToNone")}</option>
                              {dutyRoster.filter((m) => m.role === "waiter").length > 0 && (
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
                                  <div key={i} style={{ fontSize: 11, background: "#20242C", border: "1px solid #363C47", borderRadius: 8, padding: "8px 10px" }}>
                                    <div style={{ color: "#9CA1AC", marginBottom: 3 }}>
                                      {t("editHistoryEntry", {
                                        name: h.editedBy?.name || t("editHistoryUnknownEditor"),
                                        time: new Date(h.timestamp).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
                                      })}
                                    </div>
                                    <div style={{ color: "#7C8A6E", fontStyle: "italic", marginBottom: h.changes?.length ? 4 : 0 }}>
                                      {h.reason || t("editHistoryNoReason")}
                                    </div>
                                    {(h.changes || []).map((c, ci) => (
                                      <div key={ci} style={{ color: "#8A8F99", fontFamily: "IBM Plex Mono, monospace", fontSize: 10.5 }}>
                                        {t("editHistoryChange", { item: c.name, from: c.from, to: c.to })}
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
              <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("expensesSubtitle")}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSupplierManager(true)} style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>{t("manageSuppliers")}</button>
              <button onClick={openNewExpense} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addExpense")}</button>
            </div>
          </div>

          <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                <select value={currentExpenseMonth} onChange={(e) => setSelectedExpenseMonth(e.target.value)} className="field">
                  {availableExpenseMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("totalExpensesLabel")}</div>
                  <div style={{ fontSize: 22, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(expenseTotalThisMonth)}</div>
                </div>
                <div style={{ background: COLORS.inkSoft, border: `1px solid ${outstandingTotal > 0 ? "#C9A24A" : "#363C47"}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("outstandingPayables")}</div>
                  <div style={{ fontSize: 22, fontFamily: "IBM Plex Mono, monospace", color: outstandingTotal > 0 ? "#E3C98A" : theme.secondaryLight }}>{money(outstandingTotal)}</div>
                </div>
                <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 8 }}>{t("byCategory")}</div>
                  {expenseByCategory.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: "#8A8F99" }}>—</div>
                  ) : (
                    expenseByCategory.map((c) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                        <span style={{ color: "#9CA1AC" }}>{t(`category_${c.id}`)}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(c.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {loadingExpenseMonth ? (
                <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loadingExpenses")}</div>
              ) : monthExpenses.length === 0 ? (
                <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noExpensesForMonth", { month: monthLabel(currentExpenseMonth) })}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {monthExpenses.map((e) => (
                    <div key={e.id} style={{ background: COLORS.inkSoft, border: `1px solid ${e.status === "unpaid" ? "#C9A24A" : "#363C47"}`, borderRadius: 10, padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                            {e.supplierName || t("noSupplierOption")}
                            <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#2E3440", color: "#9CA1AC" }}>{t(`category_${e.category}`)}</span>
                            {e.status === "unpaid" && <span style={{ marginLeft: 6, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "#33301F", color: "#E3C98A" }}>{t("statusUnpaid")}</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#8A8F99", marginTop: 3 }}>
                            {new Date(e.date).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {e.paymentMethod && ` · ${t(`payment_${e.paymentMethod}`)}`}
                            {e.recordedBy?.name && ` · ${t("recordedByLabel", { name: e.recordedBy.name })}`}
                          </div>
                          {e.note && <div style={{ fontSize: 11.5, color: "#8A8F99", marginTop: 3, fontStyle: "italic" }}>{e.note}</div>}
                        </div>
                        <div style={{ fontSize: 15, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight, flexShrink: 0 }}>{money(e.amount)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {e.status === "unpaid" && (
                          <button onClick={() => markExpensePaid(currentExpenseMonth, e)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}>{t("markAsPaid")}</button>
                        )}
                        <button onClick={() => openEditExpense(currentExpenseMonth, e)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("edit")}</button>
                        <button onClick={() => deleteExpense(currentExpenseMonth, e)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("deleteExpense")}</button>
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
          <div style={{ background: COLORS.inkSoft, border: "1px solid #3A404C", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>{t("manageSuppliers")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder={t("supplierName")} className="field" />
              <select value={newSupplierCategory} onChange={(e) => setNewSupplierCategory(e.target.value)} className="field">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category_${c}`)}</option>)}
              </select>
              <input type="tel" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder={t("supplierPhone")} className="field" />
              <button onClick={addSupplierRecord} style={{ padding: "9px 0", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addSupplier")}</button>
            </div>
            {!suppliersLoaded ? (
              <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("loading")}</div>
            ) : suppliers.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("noSuppliersYet")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {suppliers.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.ink, borderRadius: 8, padding: "8px 12px" }}>
                    <div>
                      <div style={{ fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 10.5, color: "#8A8F99" }}>{t(`category_${s.category}`)}{s.phone ? ` · ${s.phone}` : ""}</div>
                    </div>
                    <button onClick={() => removeSupplierRecord(s)} style={{ fontSize: 11, color: "#E3A79C", background: "none", border: "none", cursor: "pointer" }}>{t("removeSupplier")}</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowSupplierManager(false)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: "#9CA1AC", fontSize: 12.5, cursor: "pointer", marginTop: 16 }}>{t("close")}</button>
          </div>
        </div>
      )}

      {expenseEditor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }} onClick={closeExpenseEditor}>
          <div style={{ background: COLORS.inkSoft, border: "1px solid #3A404C", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "Fraunces, serif", marginBottom: 16 }}>
              {expenseEditor.mode === "new" ? t("addExpense") : t("editExpense")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("expenseAmount")}</div>
                <input type="number" value={expenseEditor.amount} onChange={(e) => setExpenseEditor((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("expenseDate")}</div>
                <input type="date" value={expenseEditor.date} onChange={(e) => setExpenseEditor((p) => ({ ...p, date: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("expenseCategory")}</div>
                <select value={expenseEditor.category} onChange={(e) => setExpenseEditor((p) => ({ ...p, category: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category_${c}`)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("expenseSupplier")}</div>
                <select value={expenseEditor.supplierId} onChange={(e) => setExpenseEditor((p) => ({ ...p, supplierId: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }}>
                  <option value="">{t("noSupplierOption")}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("paymentStatus")}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["paid", "unpaid"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setExpenseEditor((p) => ({ ...p, status: s }))}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: `1px solid ${expenseEditor.status === s ? theme.secondary : "#3A404C"}`, background: expenseEditor.status === s ? "rgba(176,141,87,0.18)" : "transparent", color: expenseEditor.status === s ? theme.secondaryLight : "#9CA1AC", fontSize: 12.5, cursor: "pointer" }}
                    >
                      {s === "paid" ? t("statusPaid") : t("statusUnpaid")}
                    </button>
                  ))}
                </div>
              </div>
              {expenseEditor.status === "paid" && (
                <div>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("paymentStatus")} — {t("statusPaid")}</div>
                  <select value={expenseEditor.paymentMethod} onChange={(e) => setExpenseEditor((p) => ({ ...p, paymentMethod: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }}>
                    {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{t(`payment_${m.id}`)}</option>)}
                  </select>
                </div>
              )}
              {expenseEditor.status === "unpaid" && (
                <div>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("dueDate")}</div>
                  <input type="date" value={expenseEditor.dueDate} onChange={(e) => setExpenseEditor((p) => ({ ...p, dueDate: e.target.value }))} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 4 }}>{t("expenseNote")}</div>
                <input type="text" value={expenseEditor.note} onChange={(e) => setExpenseEditor((p) => ({ ...p, note: e.target.value }))} placeholder={t("expenseNotePlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveExpenseEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{t("saveChanges")}</button>
              <button onClick={closeExpenseEditor} style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 13.5, cursor: "pointer" }}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {view === "dashboard" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 1000 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("dashboardTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("dashboardSubtitle")}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: t("todayRevenue"), value: money(todayRevenue) },
              { label: t("monthRevenue"), value: money(dashboardMonthRevenue) },
              { label: t("monthOrders"), value: String(dashboardMonthOrders) },
              { label: t("avgOrderValueLabel"), value: money(avgOrderValue) },
              { label: t("netProfitLabel"), value: money(netProfit), accent: netProfit >= 0 ? "#9FCB8E" : "#E3A79C", hint: t("netProfitHint") },
            ].map((card, i) => (
              <div key={i} style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10.5, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{card.label}</div>
                <div style={{ fontSize: 19, fontFamily: "IBM Plex Mono, monospace", color: card.accent || theme.secondaryLight }}>{card.value}</div>
                {card.hint && <div style={{ fontSize: 9.5, color: "#6B6F78", marginTop: 4 }}>{card.hint}</div>}
              </div>
            ))}
          </div>

          <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("revenueTrendTitle")}</div>
            {dailyRevenue.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("noSalesYetDashboard")}</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: dailyRevenue.length > 20 ? 2 : 4, height: 110 }}>
                {dailyRevenue.map((d) => (
                  <div key={d.day} title={`${t("expenseDate")} ${d.day}: ${money(d.total)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ background: d.total > 0 ? theme.secondary : "#2E3440", borderRadius: "3px 3px 0 0", height: `${Math.max(2, (d.total / maxDailyRevenue) * 100)}%`, transition: "height .2s ease" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("topSellersTitle")}</div>
              {topSellers.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("noSalesYetDashboard")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topSellers.map((s, i) => (
                    <div key={s.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span>{i + 1}. {s.name}</span>
                        <span style={{ color: "#8A8F99" }}>{t("unitsSold", { n: s.qty })}</span>
                      </div>
                      <div style={{ background: "#2E3440", borderRadius: 999, height: 6, overflow: "hidden" }}>
                        <div style={{ background: theme.primary, width: `${(s.qty / maxTopSellerQty) * 100}%`, height: "100%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("paymentMixTitle")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dashboardByMethod.map((m) => (
                  <div key={m.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span>{t(`payment_${m.id}`)}</span>
                      <span style={{ fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(m.total)}</span>
                    </div>
                    <div style={{ background: "#2E3440", borderRadius: 999, height: 6, overflow: "hidden" }}>
                      <div style={{ background: theme.secondary, width: `${(m.total / maxMethodTotal) * 100}%`, height: "100%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("orderSourceTitle")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: t("sourceDineIn"), count: sourceCounts.dineIn },
                { label: t("sourceTakeaway"), count: sourceCounts.takeaway },
                { label: t("sourceOnline"), count: sourceCounts.online },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{s.label}</span>
                    <span style={{ color: "#8A8F99" }}>{tCount("orderCount", s.count)}</span>
                  </div>
                  <div style={{ background: "#2E3440", borderRadius: 999, height: 6, overflow: "hidden" }}>
                    <div style={{ background: theme.primary, width: `${(s.count / maxSourceCount) * 100}%`, height: "100%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "customers" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 780 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("customersTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("customersSubtitle")}</div>
          </div>
          {!customersLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
          ) : Object.keys(customers).length === 0 ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noCustomersSaved")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.values(customers).sort((a, b) => (b.lastOrder || "").localeCompare(a.lastOrder || "")).map((c) => (
                <div key={c.phone} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{c.name || t("unnamedCustomer")}</div>
                    <div style={{ fontSize: 12, color: "#9CA1AC", fontFamily: "IBM Plex Mono, monospace" }}>{c.phone}</div>
                    {c.address && <div style={{ fontSize: 12, color: "#8A8F99", marginTop: 3 }}>{c.address}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace" }}>{tCount("orderCount", c.orderCount)}</div>
                    <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 3 }}>{t("lastOrderDate", { date: c.lastOrder ? new Date(c.lastOrder).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" }) : "—" })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "shift" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 620 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("yourShift")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{shiftLoaded && shiftStart ? t("clockedInSince", { time: new Date(shiftStart).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }) : t("loading")}</div>
          </div>
          {shiftLoaded && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                <div style={{ background: COLORS.inkSoft, border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("hoursWorked")}</div>
                  <div style={{ fontSize: 20, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{hoursWorkedSoFar || "—"}</div>
                </div>
                <div style={{ background: COLORS.inkSoft, border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("yourOrders")}</div>
                  <div style={{ fontSize: 20, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{myShiftCompleted.length}</div>
                </div>
                <div style={{ background: COLORS.inkSoft, border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("yourRevenue")}</div>
                  <div style={{ fontSize: 20, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(myShiftRevenue)}</div>
                </div>
              </div>
              <button onClick={clockOut} style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 28 }}>{t("clockOut")}</button>

              <div style={{ fontSize: 12, color: "#8A8F99", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("registerTotals")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("ordersCompleted")}</div>
                  <div style={{ fontSize: 24, fontFamily: "IBM Plex Mono, monospace" }}>{shiftCompleted.length}</div>
                </div>
                <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("netSales")}</div>
                  <div style={{ fontSize: 24, fontFamily: "IBM Plex Mono, monospace", color: theme.secondaryLight }}>{money(shiftGross - shiftRefundsTotal)}</div>
                </div>
              </div>
              <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 10 }}>{t("byPaymentMethod")}</div>
                {shiftByMethod.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{t(`payment_${m.id}`)} &middot; {tCount("orderCount", m.count)}</span>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(m.total)}</span>
                  </div>
                ))}
                {shiftRefunded.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px dashed #3A404C", color: "#E3A79C" }}>
                    <span>{t("refundedCount", { n: shiftRefunded.length })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftRefundsTotal)}</span>
                  </div>
                )}
                {shiftCancelled.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: shiftRefunded.length > 0 ? 6 : 8, color: "#E3C98A" }}>
                    <span>{t("cancelledCountNote", { n: shiftCancelled.length })}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>—</span>
                  </div>
                )}
                {shiftDiscountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px dashed #3A404C" }}>
                    <span>{t("discountsGiven")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftDiscountTotal)}</span>
                  </div>
                )}
              </div>

              <div style={{ background: shiftUnpaid.length > 0 ? "#2A2717" : COLORS.inkSoft, border: `1px solid ${shiftUnpaid.length > 0 ? "#5B4F3F" : "#363C47"}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 10 }}>{t("unpaidThisShiftLabel")}</div>
                {shiftUnpaid.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("noUnpaidThisShift")}</div>
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

              {isManager && (
                <div style={{ background: COLORS.inkSoft, border: `1px solid ${theme.secondary}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t("cashReconciliationTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "#9CA1AC", marginBottom: 14 }}>{t("cashReconciliationSubtitle")}</div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 8 }}>
                    <span title={t("openingFloatHint")}>{t("openingFloatLabel")}</span>
                    <input
                      type="number"
                      value={openingFloat}
                      onChange={(e) => updateOpeningFloat(e.target.value)}
                      className="field"
                      style={{ width: 100, textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{t("cashSalesLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(shiftCashSalesTotal)}</span>
                  </div>
                  {shiftCashRefundsTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#E3A79C" }}>
                      <span>{t("cashRefundsLabel")}</span><span style={{ fontFamily: "IBM Plex Mono, monospace" }}>-{money(shiftCashRefundsTotal)}</span>
                    </div>
                  )}

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #3A404C" }}>
                    <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("cashExpensesLabel")}</div>
                    {shiftCashExpenses.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#8A8F99" }}>{t("noCashExpensesThisShift")}</div>
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

              {hasFeature("teamTracking") && isManager && teamPerformance.some((p) => p.orders > 0) && (
                <div style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#9CA1AC", marginBottom: 10 }}>{t("teamPerformanceTitle")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {teamPerformance.filter((p) => p.orders > 0).sort((a, b) => b.revenue - a.revenue).map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          {p.name}
                          <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3", fontWeight: 600 }}>
                            {p.role === "delivery" ? t("roleDelivery") : t("roleWaiter")}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA1AC" }}>
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
                <button onClick={downloadShiftReport} title={t("downloadReportTooltip")} style={{ padding: "13px 16px", borderRadius: 8, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>{t("download")}</button>
              </div>
            </>
          )}
        </div>
      )}

      {view === "tables" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 900 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("tablesTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("tablesSubtitle")}</div>
          </div>

          {!tablesLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <div style={{ fontSize: 11, color: "#9CA1AC", textTransform: "uppercase", letterSpacing: 0.5 }}>{t("numberOfTablesLabel")}</div>
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
                {(() => {
                  const pendingTakeaway = pendingOrdersForTable(null);
                  const takeawayOccupied = tableItemCount(null) > 0;
                  return (
                    <div style={{ background: COLORS.inkSoft, border: `1px solid ${pendingTakeaway.length > 0 ? "#C9A24A" : activeTableId === null ? theme.secondary : "#363C47"}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, fontFamily: "Fraunces, serif", padding: "3px 0" }}>{t("takeawayDelivery")}</div>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: takeawayOccupied ? "#3A2A28" : "#22301F", color: takeawayOccupied ? "#E3A79C" : "#9FCB8E", fontWeight: 500, flexShrink: 0 }}>
                          {takeawayOccupied ? t("tableOccupied") : t("tableAvailable")}
                        </span>
                      </div>
                      {pendingTakeaway.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#E3C98A", marginBottom: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E3C98A", display: "inline-block" }} />
                          {t("newOrderBadge")}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {pendingTakeaway.length > 0 ? (
                          <button
                            onClick={() => setReviewTableId(null)}
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #C9A24A", background: "rgba(201,162,74,0.15)", color: "#E3C98A", cursor: "pointer", fontWeight: 600 }}
                          >
                            {t("reviewOrder")}
                          </button>
                        ) : (
                          <button
                            onClick={() => { switchTable(null); setView("order"); }}
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}
                          >
                            {t("openTicket")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {tableIds.map((id) => {
                  const checkoutReq = checkoutRequestForTable(id);
                  const occupied = tableItemCount(id) > 0 || !!checkoutReq;
                  const isActive = activeTableId === id;
                  const pendingHere = pendingOrdersForTable(id);
                  return (
                    <div key={id} style={{ background: COLORS.inkSoft, border: `1px solid ${pendingHere.length > 0 ? "#C9A24A" : checkoutReq ? "#8EB8D6" : isActive ? theme.secondary : "#363C47"}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <input
                          type="text"
                          value={tableNames[id] || ""}
                          onChange={(e) => updateTableName(id, e.target.value)}
                          placeholder={t("tableNumbered", { n: id })}
                          style={{ background: "#FFFFFF", border: "1px solid #3A404C", borderRadius: 5, color: "#111111", fontSize: 14, fontWeight: 500, padding: "3px 6px", width: "70%", fontFamily: "Fraunces, serif" }}
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
                            style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}
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
            <div style={{ fontSize: 13, color: "#9CA1AC", marginBottom: 14 }}>{t("storeLinkSubtitle")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 12, fontFamily: "IBM Plex Mono, monospace", color: "#9CA1AC", wordBreak: "break-all" }}>{storeOrderUrl()}</div>
              <button onClick={copyStoreLink} style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                {storeLinkCopied ? t("linkCopied") : t("copyLink")}
              </button>
            </div>
            <div style={{ fontSize: 11, color: COLORS.red, marginTop: 8 }}>{t("storeLinkNote")}</div>
          </div>
          )}

          {hasFeature("deliveryZones") && (
          <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("deliveryZonesTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("deliveryZonesSubtitle")}</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <input type="text" value={newZoneLabel} onChange={(e) => setNewZoneLabel(e.target.value)} placeholder={t("zoneLabelPlaceholder")} className="field" style={{ flex: 2, minWidth: 160 }} />
            <input type="number" min={0} step="0.01" value={newZoneFee} onChange={(e) => setNewZoneFee(e.target.value)} placeholder={t("zoneFee")} className="field" style={{ flex: 1, minWidth: 100 }} />
            <button onClick={addDeliveryZone} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addZone")}</button>
          </div>

          {!deliveryZonesLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
          ) : deliveryZones.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noZonesYet")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deliveryZones.map((zone) => (
                <div key={zone.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap", gap: 8 }}>
                  {editingZoneId === zone.id ? (
                    <>
                      <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 200 }}>
                        <input type="text" value={editingZoneLabel} onChange={(e) => setEditingZoneLabel(e.target.value)} className="field" style={{ flex: 2 }} />
                        <input type="number" min={0} step="0.01" value={editingZoneFee} onChange={(e) => setEditingZoneFee(e.target.value)} className="field" style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={saveEditZone} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", background: theme.primary, color: COLORS.paper, cursor: "pointer" }}>{t("apply")}</button>
                        <button onClick={() => setEditingZoneId(null)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("cancel")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5 }}>
                        {zone.label} <span style={{ color: theme.secondaryLight, fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>{money(zone.fee)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEditZone(zone)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("editZone")}</button>
                        <button onClick={() => removeDeliveryZone(zone)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: "#E3A79C", cursor: "pointer" }}>{t("removeZone")}</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          </>
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
              <button onClick={() => setQrTableId(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("close")}</button>
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
                    <button onClick={() => confirmPendingOrder(order)} style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t("confirmOrder")}</button>
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
                <div style={{ display: "flex", gap: 6 }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayTableModal((p) => ({ ...p, paymentMethod: m.id }))}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${payTableModal.paymentMethod === m.id ? theme.secondary : "#DCD5C4"}`, background: payTableModal.paymentMethod === m.id ? "rgba(176,141,87,0.18)" : "transparent", color: payTableModal.paymentMethod === m.id ? "#8A6A2E" : COLORS.charcoal, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
                    >
                      {t(`payment_${m.id}`)}
                    </button>
                  ))}
                  <button
                    onClick={() => setPayTableModal((p) => ({ ...p, paymentMethod: "split" }))}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${payTableModal.paymentMethod === "split" ? theme.secondary : "#DCD5C4"}`, background: payTableModal.paymentMethod === "split" ? "rgba(176,141,87,0.18)" : "transparent", color: payTableModal.paymentMethod === "split" ? "#8A6A2E" : COLORS.charcoal, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
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
                <button onClick={confirmTablePayment} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("confirmPaymentButton")}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {view === "staff" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 780 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("staffTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("staffSubtitle")}</div>
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
            <button onClick={addStaffMember} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addEmployee")}</button>
          </div>

          {!employeesLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {employees.map((emp) => (
                <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: `1px solid ${currentEmployee?.id === emp.id ? theme.secondary : "#363C47"}`, borderRadius: 10, padding: "12px 16px", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#3A2A2D", color: theme.secondaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
                      {initials(emp.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        {emp.name}
                        <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: (emp.role || "manager") !== "staff" ? "rgba(176,141,87,0.18)" : "#2E3440", color: (emp.role || "manager") !== "staff" ? theme.secondaryLight : "#9CA1AC", fontWeight: 600 }}>
                          {(emp.role || "manager") !== "staff" ? t("roleManager") : t("roleStaff")}
                        </span>
                      </div>
                      {currentEmployee?.id === emp.id && <div style={{ fontSize: 10.5, color: theme.secondaryLight }}>{t("currentlyClockedIn")}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {isManager && (
                      <button onClick={() => toggleEmployeeRole(emp)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>
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
                          <button onClick={() => saveEditedPin(emp.id)} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", background: theme.primary, color: COLORS.paper, cursor: "pointer" }}>{t("apply")}</button>
                        </>
                      ) : (
                        <button onClick={() => { setEditingPinId(emp.id); setEditingPinValue(emp.pin); }} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", cursor: "pointer" }}>{t("editPin")}</button>
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

          <div style={{ fontSize: 12, color: "#8A8F99", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("leaderboardTitle")}</div>
          {!shiftLogLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99", marginBottom: 28 }}>{t("loading")}</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8A8F99", marginBottom: 28 }}>{t("noLeaderboardData")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
              {leaderboard.map((entry, i) => (
                <div key={entry.name + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#8A8F99", fontFamily: "IBM Plex Mono, monospace", width: 16 }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5 }}>{entry.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA1AC" }}>
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
                <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 12 }}>{t("teamRosterSubtitle")}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <input type="text" value={newDutyName} onChange={(e) => setNewDutyName(e.target.value)} placeholder={t("newTeamMemberPlaceholder")} className="field" style={{ flex: 1, minWidth: 140 }} />
                  <select value={newDutyRole} onChange={(e) => setNewDutyRole(e.target.value)} className="field" style={{ width: 140 }}>
                    <option value="waiter">{t("roleWaiter")}</option>
                    <option value="delivery">{t("roleDelivery")}</option>
                  </select>
                  <button onClick={addDutyMember} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{t("addTeamMember")}</button>
                </div>

                {!dutyRosterLoaded ? (
                  <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
                ) : dutyRoster.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noTeamMembersYet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dutyRoster.map((m) => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "10px 16px", flexWrap: "wrap", gap: 8 }}>
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
                <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 12 }}>{t("teamPerformanceSubtitle")}</div>
                {teamPerformance.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noTeamMembersYet")}</div>
                ) : teamPerformance.every((p) => p.orders === 0) ? (
                  <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noTeamPerformanceYet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {teamPerformance.filter((p) => p.orders > 0).sort((a, b) => b.revenue - a.revenue).map((p) => (
                      <div key={p.id} style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                            {p.name}
                            <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 999, background: "#2A2E3A", color: "#B0A8E3", fontWeight: 600 }}>
                              {p.role === "delivery" ? t("roleDelivery") : t("roleWaiter")}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#9CA1AC" }}>
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
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#9CA1AC", fontFamily: "IBM Plex Mono, monospace" }}>
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

          <div style={{ fontSize: 12, color: "#8A8F99", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{t("shiftHistoryTitle")}</div>
          {!shiftLogLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
          ) : recentShiftLog.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("noShiftHistory")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentShiftLog.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 8, padding: "10px 14px", flexWrap: "wrap", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{s.employeeName}</div>
                    <div style={{ fontSize: 11, color: "#8A8F99" }}>{new Date(s.clockIn).toLocaleString(isRtl ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} &ndash; {new Date(s.clockOut).toLocaleString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA1AC" }}>
                    {t("shiftHistoryLine", { orders: s.orders, revenue: money(s.revenue), hours: formatDuration(new Date(s.clockOut) - new Date(s.clockIn)) })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <button onClick={finishClockOut} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("done")}</button>
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
            <button onClick={dismissRenewalNotice} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("renewalNoticeDismiss")}</button>
          </div>
        </div>
      )}

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
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {t("confirmAction")}
              </button>
            </div>
          </div>
        </div>
      )}

      {tabPinPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 95, padding: 20 }} onClick={() => setTabPinPrompt(null)}>
          <div style={{ background: COLORS.ink, border: "1px solid #3A404C", borderRadius: 14, padding: 28, width: "100%", maxWidth: 320, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 6, color: COLORS.paper }}>{t("enterManagerPinTitle")}</div>
            <div style={{ fontSize: 12.5, color: "#9CA1AC", marginBottom: 20 }}>{t("enterManagerPinHint", { tab: t(`tab_${tabPinPrompt}`) })}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: tabPinError ? 6 : 22 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${theme.secondary}`, background: i < tabPinInput.length ? theme.secondary : "transparent" }} />
              ))}
            </div>
            {tabPinError && <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 16 }}>{t("managerPinIncorrect")}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => { setTabPinError(false); setTabPinInput((p) => (p.length < 4 ? p + d : p)); }}
                  style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: COLORS.inkSoft, color: COLORS.paper, fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setTabPinPrompt(null)} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 12, cursor: "pointer" }}>{t("cancel")}</button>
              <button
                onClick={() => { setTabPinError(false); setTabPinInput((p) => (p.length < 4 ? p + "0" : p)); }}
                style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: COLORS.inkSoft, color: COLORS.paper, fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" }}
              >
                0
              </button>
              <button onClick={() => setTabPinInput((p) => p.slice(0, -1))} style={{ padding: "16px 0", borderRadius: 10, border: "1px solid #3A404C", background: "transparent", color: "#9CA1AC", fontSize: 16, cursor: "pointer" }}>&larr;</button>
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
                style={{ display: "block", textAlign: "center", padding: "11px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}
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

      {view === "settings" && (
        <div style={{ padding: isMobile ? "16px 14px" : isTablet ? "20px 20px" : "28px 32px", maxWidth: 620 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t("settingsTitle")}</div>
            <div style={{ fontSize: 13, color: "#9CA1AC" }}>{t("settingsSubtitle")}</div>
          </div>

          {!brandingLoaded ? (
            <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("restaurantNameLabel")}</div>
                <input type="text" value={restaurantName} onChange={(e) => updateRestaurantName(e.target.value)} onFocus={handleNameFocus} onBlur={handleNameBlur} placeholder={t("restaurantNamePlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("logoLabel")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, background: COLORS.inkSoft, border: "1px solid #363C47", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
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
                {!logoUrl && <div style={{ fontSize: 11.5, color: "#8A8F99", marginTop: 8 }}>{t("noLogoUploaded")}</div>}
              </div>

              {hasFeature("googleMapsDirections") && (
              <div>
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("locationLabel")}</div>
                <input type="text" value={mapsLink} onChange={(e) => updateMapsLink(e.target.value)} placeholder={t("locationPlaceholder")} className="field" style={{ width: "100%", boxSizing: "border-box" }} />
                <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 6, lineHeight: 1.5 }}>{t("locationHint")}</div>
              </div>
              )}

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("primaryColorLabel")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="color" value={primaryColor} onChange={(e) => updatePrimaryColor(e.target.value)} style={{ width: 44, height: 36, padding: 0, border: "1px solid #3A404C", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
                    <input type="text" value={primaryColor} onChange={(e) => updatePrimaryColor(e.target.value)} className="field" style={{ width: 100, fontFamily: "IBM Plex Mono, monospace" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 6 }}>{t("primaryColorHint")}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("secondaryColorLabel")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="color" value={secondaryColor} onChange={(e) => updateSecondaryColor(e.target.value)} style={{ width: 44, height: 36, padding: 0, border: "1px solid #3A404C", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
                    <input type="text" value={secondaryColor} onChange={(e) => updateSecondaryColor(e.target.value)} className="field" style={{ width: 100, fontFamily: "IBM Plex Mono, monospace" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 6 }}>{t("secondaryColorHint")}</div>
                </div>
              </div>

              {hasFeature("vatService") && (
                <div>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("taxesTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "#8A8F99", marginBottom: 10 }}>{t("taxesHint")}</div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("vatPercentLabel")}</div>
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
                        <span style={{ fontSize: 13, color: "#9CA1AC" }}>%</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6 }}>{t("servicePercentLabel")}</div>
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
                        <span style={{ fontSize: 13, color: "#9CA1AC" }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 8 }}>{t("taxesOrderNote")}</div>
                </div>
              )}

              {isManager && hasFeature("tabAccessControl") && (
                <div>
                  <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("tabAccessTitle")}</div>
                  <div style={{ fontSize: 11.5, color: "#8A8F99", marginBottom: 12 }}>{t("tabAccessHint")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, overflow: "hidden" }}>
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
                              background: gated ? theme.primary : "#3A404C",
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
                <div style={{ fontSize: 11, color: "#9CA1AC", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("previewLabel")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: 16, flexWrap: "wrap" }}>
                  {logoUrl && <img src={logoUrl} alt={restaurantName} style={{ height: 28, width: "auto", maxWidth: 120, objectFit: "contain", borderRadius: 4 }} />}
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>{restaurantName}</span>
                  <button style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 13, fontWeight: 600 }}>{t("saveOrder")}</button>
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
function CustomerMenuView({ tableId, tenantId }) {
  // A null/undefined tableId means this is the general online-ordering link (shared on social
  // media), not a specific table's QR code — the customer chooses Pickup or Delivery instead of
  // it being assumed dine-in.
  const isGeneralLink = tableId === null || tableId === undefined;
  const storage = useMemo(() => createTenantStorage(tenantId), [tenantId]);
  const [lang, setLang] = useState("en");
  const [restaurantName, setRestaurantName] = useState("Ember & Vine");
  const [logoUrl, setLogoUrl] = useState(null);
  const [primaryColor, setPrimaryColor] = useState(COLORS.burgundy);
  const [secondaryColor, setSecondaryColor] = useState(COLORS.brass);
  const [mapsLink, setMapsLink] = useState("");
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const [cart, setCart] = useState({}); // { [itemId]: { qty, note } }
  const [editingNoteItemId, setEditingNoteItemId] = useState(null);
  const [deliveryMethodChoice, setDeliveryMethodChoice] = useState(null); // "pickup" | "delivery" | null
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [zoneChoiceError, setZoneChoiceError] = useState(false);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sendError, setSendError] = useState(false);
  // Starts optimistic — see the identical reasoning in POSPrototype. navigator.onLine can wrongly
  // report offline inside embedded WebViews (like the Claude mobile app's artifact preview), and
  // here that bug is worse than cosmetic: it was hard-blocking every order submission before even
  // attempting one. The real check now happens at submit time against the actual result of trying
  // to send — see submitOrder below.
  const [isOnline, setIsOnline] = useState(true);

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
    const load = async () => {
      try {
        const [brandRes, menuRes, availRes, zonesRes, taxRes] = await Promise.all([
          getSharedWithRetry(storage, "restaurant-branding").catch(() => null),
          getSharedWithRetry(storage, "menu-config").catch(() => null),
          getSharedWithRetry(storage, "menu-availability").catch(() => null),
          isGeneralLink ? getSharedWithRetry(storage, "delivery-zones-config").catch(() => null) : Promise.resolve(null),
          getSharedWithRetry(storage, "tax-config").catch(() => null),
        ]);
        if (cancelled) return;
        if (brandRes?.value) {
          const b = JSON.parse(brandRes.value);
          setRestaurantName(b.name || "Ember & Vine");
          setLogoUrl(b.logo || null);
          setPrimaryColor(b.primary || COLORS.burgundy);
          setSecondaryColor(b.secondary || COLORS.brass);
          setMapsLink(b.mapsLink || "");
        }
        if (menuRes?.value) {
          const m = JSON.parse(menuRes.value);
          setCategories(m.categories || []);
          // Strip anything beyond name/tag/price before it ever reaches component state — recipe
          // data (ingredient IDs and quantities) rides along in the same shared record for the
          // staff app's use, but this view has no reason to hold onto it.
          const publicMenu = {};
          Object.keys(m.menu || {}).forEach((cat) => {
            publicMenu[cat] = (m.menu[cat] || []).map((item) => ({ id: item.id, name: item.name, tag: item.tag, price: item.price }));
          });
          setMenu(publicMenu);
        }
        if (availRes?.value) setAvailability(JSON.parse(availRes.value));
        if (zonesRes?.value) setDeliveryZones(JSON.parse(zonesRes.value));
        if (taxRes?.value) {
          const parsed = JSON.parse(taxRes.value);
          setVatPercent(Number(parsed.vatPercent) || 0);
          setServicePercent(Number(parsed.servicePercent) || 0);
        }
      } catch (e) {
        // fall back to whatever defaults are already set
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    // Re-poll shared menu/branding/availability while this page stays open, so a price, item, or
    // stock change shows up without the customer needing to manually refresh.
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
        flashChoiceError();
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
        id: `qr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        tableId: isGeneralLink ? null : tableId,
        items: cartLines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty, note: l.note || "" })),
        deliveryMethod: isGeneralLink ? deliveryMethodChoice : null,
        deliveryFee: isGeneralLink ? deliveryFeeAmount : 0,
        deliveryZoneLabel: isGeneralLink && deliveryMethodChoice === "delivery" ? selectedZone?.label || "" : "",
        submittedAt: new Date().toISOString(),
      };
      await storage.set("pending-orders", JSON.stringify([...list, order]), true);
      setIsOnline(true); // it just worked — whatever the flag said before, we're clearly connected
      setCart({});
      setJustSent(true);
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

  // "Request the bill" — reads the table's shared, cross-device running tab (see
  // persistTableTab in POSPrototype, which is what actually populates "table-tab:<id>" as staff
  // confirm items onto the table) so the total shown here matches what the POS terminal will
  // actually charge, VAT/service included. Only reflects items staff have already confirmed —
  // anything still sitting unreviewed in "pending-orders" isn't billable yet, so it's excluded
  // from this total; that's accurate, not a bug, but worth the note below in case a customer
  // wonders why a just-submitted order isn't reflected immediately.
  const openCheckout = async () => {
    setCheckoutOpen(true);
    setCheckoutRequested(false);
    setCheckoutLoading(true);
    try {
      const res = await storage.get(`table-tab:${tableId}`);
      const parsed = res?.value ? JSON.parse(res.value) : null;
      setCheckoutTab({ items: parsed?.items || [] });
    } catch (e) {
      setCheckoutTab({ items: [] });
    } finally {
      setCheckoutLoading(false);
    }
  };
  const checkoutItems = checkoutTab?.items || [];
  const checkoutSubtotal = checkoutItems.reduce((s, it) => s + it.price * it.qty, 0);
  const checkoutService = Math.round(checkoutSubtotal * (servicePercent / 100) * 100) / 100;
  const checkoutVat = Math.round((checkoutSubtotal + checkoutService) * (vatPercent / 100) * 100) / 100;
  const checkoutTotal = checkoutSubtotal + checkoutService + checkoutVat;

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

  return (
    <div dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ fontFamily: isRtl ? "Tajawal, Inter, sans-serif" : "Inter, sans-serif", background: COLORS.ink, minHeight: "100vh", color: COLORS.paper, paddingBottom: cartCount > 0 ? 90 : 0 }}>
      <style>{FONTS}</style>
      <style>{`
        button { transition: filter .12s ease, background .15s ease, border-color .15s ease, transform .08s ease; }
        button:not(:disabled):hover { filter: brightness(1.14); }
        button:not(:disabled):active { transform: scale(0.98); }
        select:focus, input:focus { outline: none; border-color: ${theme.secondary} !important; box-shadow: 0 0 0 3px ${theme.secondary}33; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #3A404C; border-radius: 3px; }
      `}</style>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          {logoUrl && <img src={logoUrl} alt={restaurantName} style={{ height: 40, width: "auto", maxWidth: 140, objectFit: "contain", borderRadius: 4 }} />}
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 26, fontWeight: 600 }}>{restaurantName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 14, color: theme.secondaryLight, fontWeight: 500 }}>
            {isGeneralLink ? t("onlineOrderingHeading") : t("viewingMenuFor", { table: t("tableNumbered", { n: tableId }) })}
          </div>
          <div style={{ display: "flex", background: COLORS.inkSoft, borderRadius: 999, padding: 3, border: "1px solid #3A404C" }}>
            {["en", "ar"].map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{ padding: "5px 11px", borderRadius: 999, border: "none", background: lang === code ? theme.primary : "transparent", color: lang === code ? COLORS.paper : "#9CA1AC", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }}
              >
                {code === "en" ? "EN" : "AR"}
              </button>
            ))}
          </div>
        </div>

        {isGeneralLink && buildMapsHref(mapsLink) && (
          <a
            href={buildMapsHref(mapsLink)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 14px", borderRadius: 999, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
          >
            📍 {t("getDirectionsButton")}
          </a>
        )}

        {isGeneralLink && (
          <div style={{ background: COLORS.inkSoft, border: `1px solid ${zoneChoiceError ? COLORS.red : "#3A404C"}`, borderRadius: 10, padding: 14, marginBottom: 20, marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 8 }}>{t("fulfillmentMethod")}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: deliveryMethodChoice === "delivery" ? 10 : 0 }}>
              {["pickup", "delivery"].map((mth) => (
                <button
                  key={mth}
                  onClick={() => { setDeliveryMethodChoice(mth); if (mth === "pickup") setSelectedZoneId(""); }}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${deliveryMethodChoice === mth ? theme.secondary : "#3A404C"}`, background: deliveryMethodChoice === mth ? "rgba(176,141,87,0.18)" : "transparent", color: deliveryMethodChoice === mth ? theme.secondaryLight : "#9CA1AC", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  {mth === "pickup" ? t("pickupOption") : t("deliveryOption")}
                </button>
              ))}
            </div>
            {deliveryMethodChoice === "delivery" && (
              <div>
                <div style={{ fontSize: 11.5, color: "#9CA1AC", marginBottom: 6 }}>{t("chooseDeliveryZone")}</div>
                {deliveryZones.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#8A8F99" }}>{t("noZonesYet")}</div>
                ) : (
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: "#FFFFFF", border: "1px solid #3A404C", borderRadius: 7, padding: "9px 12px", color: "#111111", fontSize: 13 }}
                  >
                    <option value="">{t("selectZonePlaceholder")}</option>
                    {deliveryZones.map((z) => (
                      <option key={z.id} value={z.id}>{z.label} — {money(z.fee)}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {zoneChoiceError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginTop: 8 }}>{t("notice_chooseZoneFirst")}</div>}
          </div>
        )}

        <div style={{ fontSize: 12.5, color: "#8A8F99", marginBottom: 6 }}>{t("customerMenuHint")}</div>
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
          <div style={{ fontSize: 13, color: "#8A8F99" }}>{t("loading")}</div>
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
                    <div key={item.id} style={{ background: COLORS.inkSoft, border: "1px solid #363C47", borderRadius: 10, padding: "13px 16px", opacity: available ? 1 : 0.6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{item.name}</div>
                          {item.tag && <div style={{ fontSize: 12, color: "#8A8F99", marginTop: 3 }}>{item.tag}</div>}
                          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13.5, color: theme.secondaryLight, marginTop: 6 }}>{money(item.price)}</div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: available ? "#22301F" : "#3A2A28", color: available ? "#9FCB8E" : "#E3A79C", fontWeight: 500 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: available ? "#9FCB8E" : "#E3A79C", display: "inline-block" }} />
                            {available ? t("availableBadge") : t("notAvailableBadge")}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {qty > 0 && (
                            <>
                              <button onClick={() => changeQty(item, -1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #3A404C", background: "transparent", color: COLORS.paper, cursor: "pointer", fontSize: 14 }}>&minus;</button>
                              <span style={{ fontFamily: "IBM Plex Mono, monospace", minWidth: 16, textAlign: "center" }}>{qty}</span>
                            </>
                          )}
                          <button
                            onClick={() => available && changeQty(item, 1)}
                            disabled={!available}
                            style={{ padding: qty > 0 ? "6px 10px" : "8px 14px", borderRadius: 6, border: "none", background: available ? theme.primary : "#4A4F5A", color: COLORS.paper, cursor: available ? "pointer" : "not-allowed", fontSize: qty > 0 ? 14 : 12, fontWeight: 500, opacity: available ? 1 : 0.7 }}
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
                              style={{ flex: 1, fontSize: 12.5, border: "1px solid #3A404C", borderRadius: 6, padding: "7px 9px", background: "#FFFFFF", color: "#111111", fontFamily: isRtl ? "Tajawal, sans-serif" : "Inter, sans-serif" }}
                            />
                            <button onClick={() => setEditingNoteItemId(null)} style={{ fontSize: 12, background: theme.primary, color: COLORS.paper, border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>{t("apply")}</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingNoteItemId(item.id)}
                            style={{ display: "block", marginTop: 8, fontSize: 12, color: note ? theme.secondaryLight : "#8A8F99", background: "none", border: "none", cursor: "pointer", padding: 0, fontStyle: note ? "italic" : "normal", textAlign: isRtl ? "right" : "left" }}
                          >
                            {note || t("addNote")}
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
                {(menu[cat] || []).length === 0 && <div style={{ fontSize: 12.5, color: "#8A8F99" }}>{t("noItemsYet")}</div>}
              </div>
            </div>
          ))
        )}
        <div style={{ textAlign: "center", marginTop: 30, fontSize: 10, letterSpacing: 0.6, color: "#4A4F5A" }}>G&amp;B</div>
      </div>

      {cartCount > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: COLORS.inkSoft, borderTop: `1px solid ${!isOnline ? COLORS.red : theme.secondary}`, padding: "14px 20px", boxShadow: "0 -8px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            {sendError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginBottom: 8 }}>{t("notice_orderSendFailed")}</div>}
            {!isOnline && !sendError && <div style={{ fontSize: 11.5, color: "#E3A79C", marginBottom: 8 }}>{t("offlineOrderingHint")}</div>}
            <div style={{ fontSize: 11.5, color: "#9CA1AC", marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("subtotal")}</span><span>{money(cartTotal)}</span></div>
              {servicePercent > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("serviceCharge")} ({servicePercent}%)</span><span>{money(serviceAmt)}</span></div>}
              {vatPercent > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("vat")} ({vatPercent}%)</span><span>{money(vatAmt)}</span></div>}
              {deliveryFeeAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("deliveryFeeLineLabel")}</span><span>{money(deliveryFeeAmount)}</span></div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "#9CA1AC" }}>{cartCount === 1 ? t("itemCount", { n: cartCount }) : t("itemCount_plural", { n: cartCount })} &middot; {t("orderTotal")}</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 17, color: theme.secondaryLight }}>{money(orderTotal)}</div>
              </div>
              <button
                onClick={submitOrder}
                disabled={sending || (isGeneralLink && !deliveryMethodChoice)}
                style={{ padding: "13px 22px", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: sending ? "default" : "pointer", opacity: sending || (isGeneralLink && !deliveryMethodChoice) ? 0.6 : 1, flexShrink: 0 }}
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
            <button onClick={() => setJustSent(false)} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("orderSentOk")}</button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }} onClick={() => setCheckoutOpen(false)}>
          <div style={{ background: COLORS.paper, color: COLORS.charcoal, borderRadius: 14, padding: 26, width: "100%", maxWidth: 380, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            {checkoutRequested ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{t("checkoutRequestedTitle")}</div>
                <div style={{ fontSize: 13, color: COLORS.charcoalSoft, marginBottom: 6, lineHeight: 1.5 }}>{t("checkoutRequestedBody")}</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, margin: "14px 0" }}>{money(checkoutTotal)}</div>
                <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 20 }}>{t(`payment_${checkoutMethod}`)}</div>
                <button onClick={() => setCheckoutOpen(false)} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{t("orderSentOk")}</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, marginBottom: 4 }}>{t("checkoutModalTitle")}</div>
                <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginBottom: 16, lineHeight: 1.4 }}>{t("checkoutModalNote")}</div>
                {checkoutLoading ? (
                  <div style={{ fontSize: 13, color: COLORS.charcoalSoft, padding: "12px 0" }}>{t("loading")}</div>
                ) : checkoutItems.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.charcoalSoft, padding: "12px 0" }}>{t("checkoutEmptyItems")}</div>
                ) : (
                  <>
                    {checkoutItems.map((it, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>{it.qty}&times; {it.name}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>{money(it.price * it.qty)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px dashed #D8D0BE", marginTop: 10, paddingTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("subtotal")}</span><span>{money(checkoutSubtotal)}</span></div>
                      {servicePercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("serviceCharge")} ({servicePercent}%)</span><span>{money(checkoutService)}</span></div>}
                      {vatPercent > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 3 }}><span>{t("vat")} ({vatPercent}%)</span><span>{money(checkoutVat)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, marginTop: 4 }}>
                        <span>{t("total")}</span><span>{money(checkoutTotal)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("paymentMethodLabel")}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setCheckoutMethod(m.id)}
                            style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: `1px solid ${checkoutMethod === m.id ? theme.secondary : "#DCD5C4"}`, background: checkoutMethod === m.id ? "rgba(176,141,87,0.18)" : "transparent", color: checkoutMethod === m.id ? "#8A6A2E" : COLORS.charcoal, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
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
                      style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 8, border: "none", background: theme.primary, color: COLORS.paper, fontSize: 14, fontWeight: 600, cursor: checkoutSubmitting ? "default" : "pointer", opacity: checkoutSubmitting ? 0.7 : 1 }}
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
export default function App({ tenantId }) {
  let tableParam = null;
  let isStoreLink = false;
  try {
    const params = new URLSearchParams(window.location.search);
    tableParam = params.get("table");
    isStoreLink = params.get("order") === "1";
  } catch (e) {
    tableParam = null;
    isStoreLink = false;
  }
  if (tableParam) return <CustomerMenuView tableId={tableParam} tenantId={tenantId} />;
  if (isStoreLink) return <CustomerMenuView tableId={null} tenantId={tenantId} />;
  return <POSPrototype tenantId={tenantId} />;
}