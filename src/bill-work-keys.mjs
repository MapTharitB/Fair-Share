// These prefixes identify existing per-bill sessionStorage records.
export const HISTORY_KEY = 'fairshare.bill-history.v2:';

export const billHistoryKey = id => HISTORY_KEY + id;
export const receiptDraftKey = id => 'fairshare.approved-parser.v3:' + id;
export const mainScrollKey = id => 'fairshare.main-scroll.v2:' + id;
export const billUiKey = id => 'fairshare.ui.v2:' + id;
