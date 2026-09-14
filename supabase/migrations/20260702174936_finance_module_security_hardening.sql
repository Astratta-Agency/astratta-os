-- Trigger-only functions should not be directly RPC-callable (matches hardening pattern from 2026-06-30)
revoke execute on function public.apply_payment_to_invoice() from public, anon, authenticated;
revoke execute on function public.recalc_invoice_totals() from public, anon, authenticated;
revoke execute on function public.recalc_invoice_totals_on_tax_change() from public, anon, authenticated;
revoke execute on function public.set_invoice_number() from public, anon, authenticated;
revoke execute on function public.tl_on_invoice_status_change() from public, anon, authenticated;
