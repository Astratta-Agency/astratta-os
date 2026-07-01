import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ImageIcon, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateWorkspace, useWorkspaceDetail } from "@/hooks/useWorkspaceSettings";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color HEX inválido").optional().or(z.literal(""));

const schema = z.object({
  name: z.string().trim().min(1, "Requerido").max(120),
  website: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  logo_url: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  primary_color: hex,
  secondary_color: hex,
});

type FormValues = z.infer<typeof schema>;

interface Props {
  workspaceId: string | undefined;
  isOwner: boolean;
}

export function WorkspaceBrandingCard({ workspaceId, isOwner }: Props) {
  const { data: ws, isLoading } = useWorkspaceDetail(workspaceId);
  const update = useUpdateWorkspace(workspaceId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      website: "",
      location: "",
      logo_url: "",
      primary_color: "#5140f2",
      secondary_color: "#ff7503",
    },
  });

  useEffect(() => {
    if (ws) {
      form.reset({
        name: ws.name ?? "",
        website: ws.website ?? "",
        location: ws.location ?? "",
        logo_url: ws.logo_url ?? "",
        primary_color: ws.primary_color ?? "#5140f2",
        secondary_color: ws.secondary_color ?? "#ff7503",
      });
    }
  }, [ws]);

  const logoUrl = form.watch("logo_url");
  const isDirty = form.formState.isDirty;

  const onSubmit = async (v: FormValues) => {
    try {
      await update.mutateAsync({
        name: v.name,
        website: v.website || null,
        location: v.location || null,
        logo_url: v.logo_url || null,
        primary_color: v.primary_color || null,
        secondary_color: v.secondary_color || null,
      });
      toast.success("Workspace actualizado");
      form.reset(v);
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  const errs = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidad del workspace</CardTitle>
        <CardDescription>Nombre, contacto, ubicación y branding visual.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Nombre</Label>
              <Input id="ws-name" disabled={!isOwner} {...form.register("name")} />
              {errs.name && <p className="text-xs text-destructive">{errs.name.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ws-website">Website</Label>
                <Input id="ws-website" placeholder="https://…" disabled={!isOwner} {...form.register("website")} />
                {errs.website && <p className="text-xs text-destructive">{errs.website.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ws-location">Ubicación</Label>
                <Input id="ws-location" disabled={!isOwner} {...form.register("location")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-logo">Logo URL</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-full w-full object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <Input id="ws-logo" placeholder="https://…" disabled={!isOwner} {...form.register("logo_url")} />
              </div>
              {errs.logo_url && <p className="text-xs text-destructive">{errs.logo_url.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Color primario</Label>
                <Input type="color" disabled={!isOwner} {...form.register("primary_color")} />
              </div>
              <div className="space-y-1.5">
                <Label>Color secundario</Label>
                <Input type="color" disabled={!isOwner} {...form.register("secondary_color")} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!isOwner || !isDirty || update.isPending}>
                {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
