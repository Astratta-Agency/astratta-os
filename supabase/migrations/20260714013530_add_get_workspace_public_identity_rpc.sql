-- Public (anon) lookup of workspace branding for the lead-capture form.
-- SECURITY DEFINER so it bypasses RLS, but only exposes name/logo/colors.
CREATE OR REPLACE FUNCTION public.get_workspace_public_identity(p_slug text)
RETURNS TABLE (name text, logo_url text, primary_color text, secondary_color text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.name, w.logo_url, w.primary_color, w.secondary_color
  FROM public.workspaces w
  WHERE w.slug = p_slug;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_public_identity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_public_identity(text) TO anon, authenticated;
