import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import resolve from '@salesforce/apex/HousieRouteController.resolve';

export default class HousieApp extends LightningElement {
  context;
  error;
  loading = true;
  pageRef;
  routeToken;

  @wire(CurrentPageReference)
  setPageRef(ref) {
    this.pageRef = ref;
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('c__token') || params.get('token');
    const fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const fragmentToken = fragmentParams.get('c__token') || fragmentParams.get('token');
    const currentHistoryState = window.history.state;
    const historyState = currentHistoryState && typeof currentHistoryState === 'object'
      ? currentHistoryState
      : {};
    const historyToken = historyState.housieAccountToken;

    // Experience Cloud can omit query parameters from CurrentPageReference and
    // can invoke this wire setter repeatedly after the URL is cleaned. Prefer
    // explicit invitation tokens, then the current history entry's private
    // state, before falling back to router state or the path.
    const candidates = [
      queryToken,
      fragmentToken,
      historyToken,
      ref?.state?.c__token,
      ref?.state?.token,
      this.routeToken,
      this.readTokenFromPath()
    ];
    const token = candidates.find(value =>
      typeof value === 'string' && value.length > 0 && value !== 's'
    ) || null;

    if (token) {
      this.routeToken = token;

      // Keep the bearer credential only in this browser history entry so a
      // same-tab reload can restore account context without exposing it in the
      // URL or persisting it in localStorage. Preserve Salesforce router state.
      const nextHistoryState = {
        ...historyState,
        housieAccountToken: token
      };
      const url = new URL(window.location.href);
      url.searchParams.delete('c__token');
      url.searchParams.delete('token');
      if (fragmentToken) url.hash = '';
      if (historyState.housieAccountToken !== token || queryToken || fragmentToken) {
        window.history.replaceState(
          nextHistoryState,
          '',
          url.pathname + url.search + url.hash
        );
      }
    }

    this.loading = true;
    resolve({ token }).then(result => {
      this.context = result;
      this.error = undefined;
    }).catch(e => {
      this.error = e?.body?.message || e.message || 'Unable to resolve account context.';
    }).finally(() => { this.loading = false; });
  }

  readTokenFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const siteIndex = parts.lastIndexOf('s');
    return siteIndex >= 0 && parts.length > siteIndex + 1 ? parts[siteIndex + 1] : null;
  }
}
