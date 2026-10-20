export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      private_events: {
        Row: {
          id: string;
          invite_code: string;
          organizer_id: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          invite_code: string;
          organizer_id: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          invite_code?: string;
          organizer_id?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      private_event_replies: {
        Row: {
          id: string;
          event_id: string;
          guest_key: string;
          guest_name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          guest_key: string;
          guest_name: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          guest_key?: string;
          guest_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_replies: {
        Row: {
          answers: Json;
          comment: string;
          created_at: string;
          id: string;
          name: string;
          option_ids: Json;
          plan_id: string;
          slot_ids: Json;
          user_id: string | null;
        };
        Insert: {
          answers?: Json;
          comment?: string;
          created_at?: string;
          id?: string;
          name: string;
          option_ids?: Json;
          plan_id: string;
          slot_ids?: Json;
          user_id?: string | null;
        };
        Update: {
          answers?: Json;
          comment?: string;
          created_at?: string;
          id?: string;
          name?: string;
          option_ids?: Json;
          plan_id?: string;
          slot_ids?: Json;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_replies_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          created_at: string;
          followed_id: string;
          follower_id: string;
        };
        Insert: {
          created_at?: string;
          followed_id: string;
          follower_id: string;
        };
        Update: {
          created_at?: string;
          followed_id?: string;
          follower_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_emoji: string;
          created_at: string;
          id: string;
          is_moderator: boolean;
          name: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_emoji?: string;
          created_at?: string;
          id: string;
          is_moderator?: boolean;
          name?: string;
          updated_at?: string;
          username?: string;
        };
        Update: {
          avatar_emoji?: string;
          created_at?: string;
          id?: string;
          is_moderator?: boolean;
          name?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      public_events: {
        Row: {
          created_at: string;
          id: string;
          organizer_id: string;
          organizer_name: string;
          payload: Json;
          rejection_reason: string | null;
          sponsor_status: string;
          sponsored_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          organizer_id: string;
          organizer_name?: string;
          payload: Json;
          rejection_reason?: string | null;
          sponsor_status?: string;
          sponsored_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organizer_id?: string;
          organizer_name?: string;
          payload?: Json;
          rejection_reason?: string | null;
          sponsor_status?: string;
          sponsored_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          decided_option_id: string | null;
          decided_slot_id: string | null;
          emoji: string | null;
          event_id: string | null;
          gradient: string | null;
          id: string;
          note: string;
          options: Json;
          place: string | null;
          slots: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          decided_option_id?: string | null;
          decided_slot_id?: string | null;
          emoji?: string | null;
          event_id?: string | null;
          gradient?: string | null;
          id: string;
          note?: string;
          options?: Json;
          place?: string | null;
          slots?: Json;
          title: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          decided_option_id?: string | null;
          decided_slot_id?: string | null;
          emoji?: string | null;
          event_id?: string | null;
          gradient?: string | null;
          id?: string;
          note?: string;
          options?: Json;
          place?: string | null;
          slots?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_moderator: {
        Args: { p_user: string | null };
        Returns: boolean;
      };
      moderate_public_event: {
        Args: { p_event_id: string; p_status: string; p_reason?: string | null };
        Returns: Json;
      };
      sponsor_public_event: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      get_private_event_invite: {
        Args: { p_code: string; p_response_token: string | null };
        Returns: Json;
      };
      list_private_event_invites: {
        Args: { p_code: string };
        Returns: Json;
      };
      list_private_event_guests: {
        Args: { p_code: string; p_response_token?: string | null };
        Returns: Json;
      };
      reply_to_private_event_invite: {
        Args: {
          p_code: string;
          p_response_token: string | null;
          p_guest_name: string;
          p_status: string;
          p_interests?: string[];
        };
        Returns: Json;
      };
      delete_event: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
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
    Enums: {},
  },
} as const;
