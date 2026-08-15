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
export type PublicPhoto = {
  id: string;
  url: string;
  caption: string | null;
  sort_order: number;
  media_type: "photo" | "video";
};
export type PublicDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string;
  sort_order: number;
};
export type PublicAttachment = {
  url: string;
  path: string;
  type: "image" | "video" | "document";
  name: string;
  isExternalLink?: boolean;
};

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
  inquiry_status: string | null;
};
export type PublicSiteSettings = {
  logo_url: string | null;
  favicon_url: string | null;
  hero_banner_url: string | null;
};

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
        .select("id,url,caption,sort_order,media_type")
        .order("sort_order");
      if (error) throw error;
      return data as PublicPhoto[];
    },
    staleTime: 60_000,
  });
}

export type PublicGalleryFolder = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  date_start: string | null;
  date_end: string | null;
  sort_order: number;
  items: PublicPhoto[];
};

const UNSORTED_FOLDER_ID = "__unsorted__";

export function usePublicGalleryFolders() {
  return useQuery({
    queryKey: ["public-gallery-folders"],
    queryFn: async () => {
      const [foldersRes, photosRes] = await Promise.all([
        supabase
          .from("gallery_folders")
          .select("id,name,description,location,date_start,date_end,sort_order")
          .order("sort_order"),
        supabase
          .from("gallery_photos")
          .select("id,url,caption,sort_order,media_type,folder_id")
          .order("sort_order"),
      ]);
      if (foldersRes.error) throw foldersRes.error;
      if (photosRes.error) throw photosRes.error;

      const byFolder = new Map<string, PublicPhoto[]>();
      const unsorted: PublicPhoto[] = [];
      for (const p of photosRes.data) {
        const item: PublicPhoto = {
          id: p.id,
          url: p.url,
          caption: p.caption,
          sort_order: p.sort_order,
          media_type: p.media_type as "photo" | "video",
        };
        if (p.folder_id) {
          if (!byFolder.has(p.folder_id)) byFolder.set(p.folder_id, []);
          byFolder.get(p.folder_id)!.push(item);
        } else {
          unsorted.push(item);
        }
      }

      const folders: PublicGalleryFolder[] = foldersRes.data.map((f) => ({
        ...f,
        items: byFolder.get(f.id) ?? [],
      }));
      if (unsorted.length > 0) {
        folders.push({
          id: UNSORTED_FOLDER_ID,
          name: "Unsorted",
          description: null,
          location: null,
          date_start: null,
          date_end: null,
          sort_order: Number.MAX_SAFE_INTEGER,
          items: unsorted,
        });
      }
      return folders;
    },
    staleTime: 60_000,
  });
}

export type PublicPartnerCompany = {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
};

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
          "id,title,location,description,service,start_date,end_date,personnel,cover_photo_url,attachments,sort_order,inquiry_status",
        )
        // Admins are also allowed to read every project via a separate RLS
        // policy (so /admin/projects can show drafts) — that policy applies
        // regardless of which query issues the request, so an admin viewing
        // the public site in the same logged-in browser would otherwise see
        // non-public projects too. Filter explicitly so this query always
        // reflects what a real, logged-out visitor sees.
        .eq("is_public", true)
        .order("sort_order", { ascending: false });
      if (error) throw error;
      return data as PublicProject[];
    },
    staleTime: 60_000,
  });
}

export type PublicReview = {
  id: string;
  name: string;
  rating: number;
  review_text: string | null;
  created_at: string;
};

export function usePublicReviews() {
  return useQuery({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,name,rating,review_text,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PublicReview[];
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
