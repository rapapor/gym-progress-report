export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      clients: {
        Row: {
          date_of_birth: string | null;
          deleted_at: string | null;
          gender: string | null;
          id: string;
        };
        Insert: {
          date_of_birth?: string | null;
          deleted_at?: string | null;
          gender?: string | null;
          id: string;
        };
        Update: {
          date_of_birth?: string | null;
          deleted_at?: string | null;
          gender?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      report_images: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          height: number | null;
          id: string;
          is_deleted: boolean;
          report_id: string;
          size_bytes: number;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          height?: number | null;
          id?: string;
          is_deleted?: boolean;
          report_id: string;
          size_bytes: number;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          height?: number | null;
          id?: string;
          is_deleted?: boolean;
          report_id?: string;
          size_bytes?: number;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_images_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          biceps_left: number | null;
          biceps_right: number | null;
          cardio_days: number | null;
          chest: number | null;
          client_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          note: string | null;
          sequence: number;
          thigh_left: number | null;
          thigh_right: number | null;
          waist: number | null;
          week_number: number;
          weight: number | null;
          year: number;
        };
        Insert: {
          biceps_left?: number | null;
          biceps_right?: number | null;
          cardio_days?: number | null;
          chest?: number | null;
          client_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          sequence?: number;
          thigh_left?: number | null;
          thigh_right?: number | null;
          waist?: number | null;
          week_number: number;
          weight?: number | null;
          year: number;
        };
        Update: {
          biceps_left?: number | null;
          biceps_right?: number | null;
          cardio_days?: number | null;
          chest?: number | null;
          client_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          sequence?: number;
          thigh_left?: number | null;
          thigh_right?: number | null;
          waist?: number | null;
          week_number?: number;
          weight?: number | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      trainer_client: {
        Row: {
          client_id: string;
          is_active: boolean;
          started_at: string;
          trainer_id: string;
        };
        Insert: {
          client_id: string;
          is_active?: boolean;
          started_at?: string;
          trainer_id: string;
        };
        Update: {
          client_id?: string;
          is_active?: boolean;
          started_at?: string;
          trainer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trainer_client_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trainer_client_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      trainers: {
        Row: {
          bio: string | null;
          id: string;
        };
        Insert: {
          bio?: string | null;
          id: string;
        };
        Update: {
          bio?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trainers_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          role: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id: string;
          phone?: string | null;
          role: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          role?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      cleanup_old_report_images: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
