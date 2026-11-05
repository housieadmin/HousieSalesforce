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
    const token = ref?.state?.c__token || ref?.state?.token || queryToken ||
      fragmentToken || this.routeToken || this.readTokenFromPath();
    if (token && token !== 's') this.routeToken = token;

    // Experience Cloud does not consistently expose unnamespaced query
    // parameters through CurrentPageReference. Read them directly as a
    // fallback, then remove the bearer credential from the visible URL.
    if (queryToken || fragmentToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete('c__token');
      url.searchParams.delete('token');
      url.hash = '';
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
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
