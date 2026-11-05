import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import resolve from '@salesforce/apex/HousieRouteController.resolve';

export default class HousieApp extends LightningElement {
  context;
  error;
  loading = true;
  pageRef;
  @wire(CurrentPageReference)
  setPageRef(ref) {
    this.pageRef = ref;
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('c__token') || params.get('token');
    const token = ref?.state?.c__token || ref?.state?.token || queryToken || this.readTokenFromPath();

    // Experience Cloud does not consistently expose unnamespaced query
    // parameters through CurrentPageReference. Read them directly as a
    // fallback, then remove the bearer credential from the visible URL.
    if (queryToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete('c__token');
      url.searchParams.delete('token');
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
    return parts.length ? parts[parts.length - 1] : null;
  }
}
