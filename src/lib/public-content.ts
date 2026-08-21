import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChecklistItem } from "@/lib/admin/services.functions";
import { useRealtimeInvalidate } from "@/lib/useRealtimeInvalidate";

export type { ChecklistItem, ChecklistItemType } from "@/lib/admin/services.functions";

export type PublicService = {
  id: string;
  icon: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  sort_order: number;
};
export type PublicEquipmentMedia = {
  url: string;
  path?: string;
  contentType: string;
  kind: "image" | "video" | "document";
  name: string;
  isExternalLink?: boolean;
};
export type PublicEquipment = {
  id: string;
  icon: string;
  title: string;
  description: string;
  sort_order: number;
  media: PublicEquipmentMedia[];
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
  type: "document";
  name: string;
  isExternalLink?: boolean;
};
export type PublicProjectMedia = {
  id: string;
  url: string;
  caption: string | null;
  media_type: "photo" | "video";
};

export type PublicProject = {
  id: string;
  title: string;
  location: string;
  description: string | null;
  service: string | null;
  services: string[];
  start_date: string | null;
  end_date: string | null;
  personnel: string[];
  photo_urls: string[];
  photo_positions: Record<string, { x: number; y: number; zoom: number }>;
  attachments: PublicAttachment[];
  media: PublicProjectMedia[];
  sort_order: number;
  inquiry_status: string | null;
  size: "major" | "small";
};
export type PublicSiteSettings = {
  logo_url: string | null;
  favicon_url: string | null;
  hero_banner_url: string | null;
  hero_banner_position: { x: number; y: number; zoom: number };
  hero_headline: string | null;
  hero_subtitle: string | null;
  email_cover_photo_url: string | null;
  email_cover_photo_by_type: Record<string, string>;
  contact_phones: string[];
  contact_email: string | null;
  service_area_text: string | null;
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
    // Unlike the other public queries, this drives what's marked required
    // on a real inquiry form — always refetch on mount/focus rather than
    // risk an admin's checklist edit not showing up on an already-open tab.
    staleTime: 0,
  });
}

export function usePublicEquipment() {
  return useQuery({
    queryKey: ["public-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id,icon,title,description,sort_order,media")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as PublicEquipment[];
    },
    staleTime: 60_000,
  });
}

export function usePublicGalleryPhotos() {
  useRealtimeInvalidate("gallery_photos", [["public-gallery"]]);
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
  useRealtimeInvalidate("gallery_photos", [["public-gallery-folders"]]);
  useRealtimeInvalidate("gallery_folders", [["public-gallery-folders"]]);
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

type RawGalleryPhoto = PublicProjectMedia & { sort_order: number };
type RawPublicProjectRow = Omit<PublicProject, "media"> & {
  gallery_folders:
    | { gallery_photos: RawGalleryPhoto[] }
    | { gallery_photos: RawGalleryPhoto[] }[]
    | null;
};

export function usePublicProjects() {
  useRealtimeInvalidate("projects", [["public-projects"]]);
  useRealtimeInvalidate("gallery_photos", [["public-projects"]]);
  useRealtimeInvalidate("gallery_folders", [["public-projects"]]);
  return useQuery({
    queryKey: ["public-projects"],
    // Realtime evaluates the anon SELECT policy (`is_public = true`) against
    // the row's NEW value before delivering an event — so the one moment
    // that actually needs to reach visitors, an admin flipping a project to
    // hidden, is exactly the one Realtime silently drops (the new row no
    // longer passes the policy, so it looks "invisible" to that subscriber).
    // Publishing/edits/deletes of already-visible rows all still push live;
    // this is just a safety net for that one asymmetric case so a hidden
    // project still disappears for anyone with the tab already open.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,title,location,description,service,services,start_date,end_date,personnel,photo_urls,photo_positions,attachments,sort_order,inquiry_status,size,gallery_folders(gallery_photos(id,url,caption,sort_order,media_type))",
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
      // Photos/videos live in gallery_photos, joined through the project's
      // one linked gallery_folders row — postgrest-js's cardinality
      // inference for that hop varies by version, so normalize array-or-
      // object defensively rather than assuming one shape.
      return (data as unknown as RawPublicProjectRow[]).map((row): PublicProject => {
        const { gallery_folders, ...rest } = row;
        const folder = Array.isArray(gallery_folders) ? gallery_folders[0] : gallery_folders;
        const media: PublicProjectMedia[] = [...(folder?.gallery_photos ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(({ id, url, caption, media_type }) => ({ id, url, caption, media_type }));
        return { ...rest, media };
      });
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
      return data as unknown as PublicSiteSettings;
    },
    staleTime: 60_000,
  });
}
