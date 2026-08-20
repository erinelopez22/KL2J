export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      board_members: {
        Row: {
          board_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          board_id: string;
          created_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          board_id?: string;
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      boards: {
        Row: {
          background: string;
          created_at: string;
          id: string;
          owner_id: string;
          starred: boolean;
          title: string;
          visibility: string;
        };
        Insert: {
          background?: string;
          created_at?: string;
          id?: string;
          owner_id: string;
          starred?: boolean;
          title: string;
          visibility?: string;
        };
        Update: {
          background?: string;
          created_at?: string;
          id?: string;
          owner_id?: string;
          starred?: boolean;
          title?: string;
          visibility?: string;
        };
        Relationships: [];
      };
      card_labels: {
        Row: {
          card_id: string;
          label_id: string;
        };
        Insert: {
          card_id: string;
          label_id: string;
        };
        Update: {
          card_id?: string;
          label_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_labels_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_labels_label_id_fkey";
            columns: ["label_id"];
            isOneToOne: false;
            referencedRelation: "labels";
            referencedColumns: ["id"];
          },
        ];
      };
      card_members: {
        Row: {
          card_id: string;
          user_id: string;
        };
        Insert: {
          card_id: string;
          user_id: string;
        };
        Update: {
          card_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_members_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      cards: {
        Row: {
          archived: boolean;
          board_id: string;
          cover_color: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          list_id: string;
          position: number;
          title: string;
        };
        Insert: {
          archived?: boolean;
          board_id: string;
          cover_color?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          list_id: string;
          position?: number;
          title: string;
        };
        Update: {
          archived?: boolean;
          board_id?: string;
          cover_color?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          list_id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cards_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_items: {
        Row: {
          card_id: string;
          content: string;
          created_at: string;
          id: string;
          is_done: boolean;
          position: number;
        };
        Insert: {
          card_id: string;
          content: string;
          created_at?: string;
          id?: string;
          is_done?: boolean;
          position?: number;
        };
        Update: {
          card_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          is_done?: boolean;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_items_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          body: string;
          card_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          card_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          card_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
        ];
      };
      confidential_documents: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          sort_order: number;
          storage_path: string;
          title: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          storage_path: string;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          storage_path?: string;
          title?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          sort_order: number;
          storage_path: string | null;
          title: string;
          url: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          storage_path?: string | null;
          title: string;
          url: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          storage_path?: string | null;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      email_contacts: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string | null;
          source: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          name?: string | null;
          source?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string | null;
          source?: string;
        };
        Relationships: [];
      };
      gallery_folders: {
        Row: {
          created_at: string;
          date_end: string | null;
          date_start: string | null;
          description: string | null;
          id: string;
          location: string | null;
          name: string;
          project_id: string | null;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          date_end?: string | null;
          date_start?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          project_id?: string | null;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          date_end?: string | null;
          date_start?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          project_id?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_folders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      gallery_photos: {
        Row: {
          caption: string | null;
          created_at: string;
          folder_id: string | null;
          id: string;
          media_type: string;
          origin: string;
          sort_order: number;
          storage_path: string | null;
          url: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          folder_id?: string | null;
          id?: string;
          media_type?: string;
          origin?: string;
          sort_order?: number;
          storage_path?: string | null;
          url: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          folder_id?: string | null;
          id?: string;
          media_type?: string;
          origin?: string;
          sort_order?: number;
          storage_path?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_photos_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "gallery_folders";
            referencedColumns: ["id"];
          },
        ];
      };
      google_business_connection: {
        Row: {
          access_token: string | null;
          account_name: string | null;
          connected_at: string | null;
          id: number;
          location_name: string | null;
          location_title: string | null;
          pending_state: string | null;
          pending_state_created_at: string | null;
          refresh_token: string | null;
          scope: string | null;
          token_expiry: string | null;
          updated_at: string;
        };
        Insert: {
          access_token?: string | null;
          account_name?: string | null;
          connected_at?: string | null;
          id?: number;
          location_name?: string | null;
          location_title?: string | null;
          pending_state?: string | null;
          pending_state_created_at?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          token_expiry?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string | null;
          account_name?: string | null;
          connected_at?: string | null;
          id?: number;
          location_name?: string | null;
          location_title?: string | null;
          pending_state?: string | null;
          pending_state_created_at?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          token_expiry?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      inquiries: {
        Row: {
          attachments: Json;
          channel: string | null;
          checklist_responses: Json;
          contact: string;
          created_at: string;
          email: string | null;
          email_error: string | null;
          email_sent: boolean;
          id: string;
          inquiry_code: string | null;
          message: string | null;
          name: string;
          phone: string | null;
          service: string | null;
          services: string[];
          status: string;
        };
        Insert: {
          attachments?: Json;
          channel?: string | null;
          checklist_responses?: Json;
          contact: string;
          created_at?: string;
          email?: string | null;
          email_error?: string | null;
          email_sent?: boolean;
          id?: string;
          inquiry_code?: string | null;
          message?: string | null;
          name: string;
          phone?: string | null;
          service?: string | null;
          services?: string[];
          status?: string;
        };
        Update: {
          attachments?: Json;
          channel?: string | null;
          checklist_responses?: Json;
          contact?: string;
          created_at?: string;
          email?: string | null;
          email_error?: string | null;
          email_sent?: boolean;
          id?: string;
          inquiry_code?: string | null;
          message?: string | null;
          name?: string;
          phone?: string | null;
          service?: string | null;
          services?: string[];
          status?: string;
        };
        Relationships: [];
      };
      inquiry_comments: {
        Row: {
          attachments: Json;
          author_name: string | null;
          author_type: string;
          created_at: string;
          id: string;
          inquiry_id: string;
          is_read: boolean;
          message: string | null;
        };
        Insert: {
          attachments?: Json;
          author_name?: string | null;
          author_type: string;
          created_at?: string;
          id?: string;
          inquiry_id: string;
          is_read?: boolean;
          message?: string | null;
        };
        Update: {
          attachments?: Json;
          author_name?: string | null;
          author_type?: string;
          created_at?: string;
          id?: string;
          inquiry_id?: string;
          is_read?: boolean;
          message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_comments_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      labels: {
        Row: {
          board_id: string;
          color: string;
          created_at: string;
          id: string;
          name: string | null;
        };
        Insert: {
          board_id: string;
          color: string;
          created_at?: string;
          id?: string;
          name?: string | null;
        };
        Update: {
          board_id?: string;
          color?: string;
          created_at?: string;
          id?: string;
          name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "labels_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          archived: boolean;
          board_id: string;
          created_at: string;
          id: string;
          position: number;
          title: string;
        };
        Insert: {
          archived?: boolean;
          board_id: string;
          created_at?: string;
          id?: string;
          position?: number;
          title: string;
        };
        Update: {
          archived?: boolean;
          board_id?: string;
          created_at?: string;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_companies: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string;
          name: string;
          sort_order: number;
          storage_path: string | null;
          website_url: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_url: string;
          name: string;
          sort_order?: number;
          storage_path?: string | null;
          website_url?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string;
          name?: string;
          sort_order?: number;
          storage_path?: string | null;
          website_url?: string | null;
        };
        Relationships: [];
      };
      post_recipients: {
        Row: {
          created_at: string;
          email: string;
          error: string | null;
          id: string;
          inquiry_id: string | null;
          name: string | null;
          post_id: string;
          sent_at: string | null;
          source: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          error?: string | null;
          id?: string;
          inquiry_id?: string | null;
          name?: string | null;
          post_id: string;
          sent_at?: string | null;
          source: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          error?: string | null;
          id?: string;
          inquiry_id?: string | null;
          name?: string | null;
          post_id?: string;
          sent_at?: string | null;
          source?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_recipients_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_recipients_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          attachments: Json;
          body_html: string;
          created_at: string;
          created_by: string | null;
          failed_count: number;
          id: string;
          project_ids: string[];
          recipient_mode: string;
          sent_at: string | null;
          sent_count: number;
          status: string;
          subject: string;
          title: string;
          total_count: number;
          type: string;
          updated_at: string;
        };
        Insert: {
          attachments?: Json;
          body_html: string;
          created_at?: string;
          created_by?: string | null;
          failed_count?: number;
          id?: string;
          project_ids?: string[];
          recipient_mode?: string;
          sent_at?: string | null;
          sent_count?: number;
          status?: string;
          subject: string;
          title: string;
          total_count?: number;
          type: string;
          updated_at?: string;
        };
        Update: {
          attachments?: Json;
          body_html?: string;
          created_at?: string;
          created_by?: string | null;
          failed_count?: number;
          id?: string;
          project_ids?: string[];
          recipient_mode?: string;
          sent_at?: string | null;
          sent_count?: number;
          status?: string;
          subject?: string;
          title?: string;
          total_count?: number;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          attachments: Json;
          confidential_attachments: Json;
          cover_photo_url: string | null;
          created_at: string;
          description: string | null;
          end_date: string | null;
          id: string;
          inquiry_id: string | null;
          inquiry_status: string | null;
          is_public: boolean;
          location: string;
          personnel: string[];
          photo_urls: string[];
          photo_positions: Json;
          service: string | null;
          services: string[];
          size: string;
          sort_order: number;
          start_date: string | null;
          title: string;
        };
        Insert: {
          attachments?: Json;
          confidential_attachments?: Json;
          cover_photo_url?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          inquiry_id?: string | null;
          inquiry_status?: string | null;
          is_public?: boolean;
          location: string;
          personnel?: string[];
          photo_urls?: string[];
          photo_positions?: Json;
          service?: string | null;
          services?: string[];
          size?: string;
          sort_order?: number;
          start_date?: string | null;
          title: string;
        };
        Update: {
          attachments?: Json;
          confidential_attachments?: Json;
          cover_photo_url?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          inquiry_id?: string | null;
          inquiry_status?: string | null;
          is_public?: boolean;
          location?: string;
          personnel?: string[];
          photo_urls?: string[];
          photo_positions?: Json;
          service?: string | null;
          services?: string[];
          size?: string;
          sort_order?: number;
          start_date?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          rating: number;
          review_text: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          rating: number;
          review_text?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          rating?: number;
          review_text?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      equipment: {
        Row: {
          active: boolean;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          media: Json;
          sort_order: number;
          title: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description: string;
          icon?: string;
          id?: string;
          media?: Json;
          sort_order?: number;
          title: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          media?: Json;
          sort_order?: number;
          title?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          checklist: Json;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          sort_order: number;
          title: string;
        };
        Insert: {
          active?: boolean;
          checklist?: Json;
          created_at?: string;
          description: string;
          icon?: string;
          id?: string;
          sort_order?: number;
          title: string;
        };
        Update: {
          active?: boolean;
          checklist?: Json;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          sort_order?: number;
          title?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          favicon_url: string | null;
          hero_banner_position: Json;
          hero_banner_url: string | null;
          hero_headline: string | null;
          hero_subtitle: string | null;
          id: number;
          logo_url: string | null;
          updated_at: string;
        };
        Insert: {
          favicon_url?: string | null;
          hero_banner_position?: Json;
          hero_banner_url?: string | null;
          hero_headline?: string | null;
          hero_subtitle?: string | null;
          id?: number;
          logo_url?: string | null;
          updated_at?: string;
        };
        Update: {
          favicon_url?: string | null;
          hero_banner_position?: Json;
          hero_banner_url?: string | null;
          hero_headline?: string | null;
          hero_subtitle?: string | null;
          id?: number;
          logo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_board_member: {
        Args: { _board_id: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "super_admin" | "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const;
