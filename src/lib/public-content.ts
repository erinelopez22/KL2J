import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChecklistItem } from "@/lib/admin/services.functions";

export type { ChecklistItem, ChecklistItemType } from "@/lib/admin/services.functions";

export type PublicService = {
  id: string;
  icon: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  sort_order: number;
};
export type PublicPhoto = { id: string; url: string; caption: string | null; sort_order: number };
export type PublicDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string;
  sort_order: number;
};
export type PublicAttachment = { url: string; path: string; type: "image" | "video" | "document"; name: string };

export type PublicProject = {
  id: string;
  title: string;
  location: string;
  description: string | null;
  service: string | null;
  start_date: string | null;
  end_date: string | null;
  personnel: string[];
  cover_photo_url: string | null;
  attachments: PublicAttachment[];
  sort_order: number;
};
export type PublicSiteSettings = { logo_url: string | null; favicon_url: string | null; hero_banner_url: string | null };

export function usePublicServices() {
  return useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,icon,title,description,checklist,sort_order")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as PublicService[];
    },
    staleTime: 60_000,
  });
}

export function usePublicGalleryPhotos() {
  return useQuery({
    queryKey: ["public-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("id,url,caption,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as PublicPhoto[];
    },
    staleTime: 60_000,
  });
}

export type PublicPartnerCompany = { id: string; name: string; logo_url: string; website_url: string | null };

export function usePublicPartnerCompanies() {
  return useQuery({
    queryKey: ["public-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_companies")
        .select("id,name,logo_url,website_url")
        .order("sort_order");
      if (error) throw error;
      return data as PublicPartnerCompany[];
    },
    staleTime: 60_000,
  });
}

export function usePublicDocuments() {
  return useQuery({
    queryKey: ["public-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,title,description,category,url,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as PublicDocument[];
    },
    staleTime: 60_000,
  });
}

export function usePublicProjects() {
  return useQuery({
    queryKey: ["public-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,title,location,description,service,start_date,end_date,personnel,cover_photo_url,attachments,sort_order",
        )
        .order("sort_order", { ascending: false });
      if (error) throw error;
      return data as PublicProject[];
    },
    staleTime: 60_000,
  });
}

export function usePublicSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as PublicSiteSettings;
    },
    staleTime: 60_000,
  });
}
