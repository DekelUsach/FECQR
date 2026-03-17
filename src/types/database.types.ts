export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alumnos: {
        Row: {
          created_at: string | null
          id: string
          materia_id: string | null
          nombre: string
          dni: string | null
          telefono: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          materia_id?: string | null
          nombre: string
          dni?: string | null
          telefono?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          materia_id?: string | null
          nombre?: string
          dni?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alumnos_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencias: {
        Row: {
          alumno_id: string | null
          estado: string | null
          hora_escaneo: string | null
          id: string
          sesion_id: string | null
          validador_token: string | null
        }
        Insert: {
          alumno_id?: string | null
          estado?: string | null
          hora_escaneo?: string | null
          id?: string
          sesion_id?: string | null
          validador_token?: string | null
        }
        Update: {
          alumno_id?: string | null
          estado?: string | null
          hora_escaneo?: string | null
          id?: string
          sesion_id?: string | null
          validador_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencias_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      materias: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          profesor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          profesor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          profesor_id?: string | null
        }
        Relationships: []
      }
      sesiones: {
        Row: {
          created_at: string | null
          estado: string | null
          fecha: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          materia_id: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string | null
          fecha?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          materia_id?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string | null
          fecha?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          materia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
