import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MyProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export function useMyProfile() {
  const { user } = useAuth();

  return useQuery<MyProfile | null>({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, email, full_name, first_name, last_name, phone, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MyProfile) ?? null;
    },
  });
}

export type UpdateMyProfileInput = {
  first_name: string;
  last_name: string;
  phone: string;
};

export function useUpdateMyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMyProfileInput) => {
      if (!user?.id) throw new Error("not_authenticated");

      const first_name = input.first_name.trim();
      const last_name = input.last_name.trim();
      const phone = input.phone.trim();
      const full_name = [first_name, last_name].filter(Boolean).join(" ") || null;

      const { error } = await (supabase as any).from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? null,
          first_name: first_name || null,
          last_name: last_name || null,
          phone: phone || null,
          full_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;

      // Keep auth user_metadata in sync so greetings/menus update instantly.
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: first_name || null,
          last_name: last_name || null,
          full_name,
          phone: phone || null,
        },
      });
      if (authError) throw authError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["portal-team"] });
    },
  });
}
