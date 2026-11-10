export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      book_catalog: {
        Row: {
          author: string
          author_norm: string
          cover_url: string
          created_at: string
          dedupe_key: string
          description: string
          edition_key: string | null
          genre: string
          id: string
          isbn_norm: string | null
          language_code: string | null
          last_validated_at: string
          published_year: number | null
          publisher: string | null
          series_number: number | null
          series_title: string | null
          series_title_norm: string | null
          source: string
          source_id: string | null
          source_url: string | null
          title: string
          title_norm: string
          updated_at: string
          work_key: string | null
        }
        Insert: {
          author?: string
          author_norm?: string
          cover_url?: string
          created_at?: string
          dedupe_key: string
          description?: string
          edition_key?: string | null
          genre?: string
          id?: string
          isbn_norm?: string | null
          language_code?: string | null
          last_validated_at?: string
          published_year?: number | null
          publisher?: string | null
          series_number?: number | null
          series_title?: string | null
          series_title_norm?: string | null
          source: string
          source_id?: string | null
          source_url?: string | null
          title: string
          title_norm: string
          updated_at?: string
          work_key?: string | null
        }
        Update: {
          author?: string
          author_norm?: string
          cover_url?: string
          created_at?: string
          dedupe_key?: string
          description?: string
          edition_key?: string | null
          genre?: string
          id?: string
          isbn_norm?: string | null
          language_code?: string | null
          last_validated_at?: string
          published_year?: number | null
          publisher?: string | null
          series_number?: number | null
          series_title?: string | null
          series_title_norm?: string | null
          source?: string
          source_id?: string | null
          source_url?: string | null
          title?: string
          title_norm?: string
          updated_at?: string
          work_key?: string | null
        }
        Relationships: []
      }
      book_notes: {
        Row: {
          body: string
          book_id: string
          created_at: string
          id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          body: string
          book_id: string
          created_at?: string
          id?: string
          rating?: number | null
          user_id: string
        }
        Update: {
          body?: string
          book_id?: string
          created_at?: string
          id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          current_book_data: Json | null
          current_book_id: string | null
          display_name: string | null
          dragon_xp: number
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          preferred_lang: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          current_book_data?: Json | null
          current_book_id?: string | null
          display_name?: string | null
          dragon_xp?: number
          email?: string | null
          id: string
          lat?: number | null
          lng?: number | null
          preferred_lang?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          current_book_data?: Json | null
          current_book_id?: string | null
          display_name?: string | null
          dragon_xp?: number
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          preferred_lang?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      search_cache: {
        Row: {
          fetched_at: string
          query_norm: string
          result_keys: string[]
        }
        Insert: {
          fetched_at?: string
          query_norm: string
          result_keys?: string[]
        }
        Update: {
          fetched_at?: string
          query_norm?: string
          result_keys?: string[]
        }
        Relationships: []
      }
      user_books: {
        Row: {
          book_data: Json | null
          book_id: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          book_data?: Json | null
          book_id: string
          created_at?: string
          id?: string
          status: string
          user_id: string
        }
        Update: {
          book_data?: Json | null
          book_id?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rate_limit_hit: {
        Args: { _bucket: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
