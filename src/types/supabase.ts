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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      auto_reorder_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          product_id: string
          reorder_unit: string
          reorder_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          product_id: string
          reorder_unit: string
          reorder_value: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          product_id?: string
          reorder_unit?: string
          reorder_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reorder_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      batch_jobs: {
        Row: {
          completed_at: string | null
          country: string | null
          current_batch: number
          error_message: string | null
          job_id: string
          job_type: string
          log_lines: string[]
          started_at: string
          status: string
          total_processed: number
          total_remaining: number | null
          total_updated: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          country?: string | null
          current_batch?: number
          error_message?: string | null
          job_id: string
          job_type: string
          log_lines?: string[]
          started_at?: string
          status?: string
          total_processed?: number
          total_remaining?: number | null
          total_updated?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          country?: string | null
          current_batch?: number
          error_message?: string | null
          job_id?: string
          job_type?: string
          log_lines?: string[]
          started_at?: string
          status?: string
          total_processed?: number
          total_remaining?: number | null
          total_updated?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories_archive_20260227: {
        Row: {
          category_id: string | null
          created_at: string | null
          default_sort_position: number | null
          icon: string | null
          name: string | null
          name_translations: Json | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          default_sort_position?: number | null
          icon?: string | null
          name?: string | null
          name_translations?: Json | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          default_sort_position?: number | null
          icon?: string | null
          name?: string | null
          name_translations?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      checkoff_sequences: {
        Row: {
          created_at: string
          is_valid: boolean
          items: Json
          sequence_id: string
          store_id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_valid: boolean
          items?: Json
          sequence_id?: string
          store_id: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_valid?: boolean
          items?: Json
          sequence_id?: string
          store_id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkoff_sequences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "checkoff_sequences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "shopping_trips"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      competitor_product_prices: {
        Row: {
          observed_at: string
          observed_by: string | null
          price: number
          price_id: string
          product_id: string
          retailer: string
        }
        Insert: {
          observed_at?: string
          observed_by?: string | null
          price: number
          price_id?: string
          product_id: string
          retailer: string
        }
        Update: {
          observed_at?: string
          observed_by?: string | null
          price?: number
          price_id?: string
          product_id?: string
          retailer?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      competitor_product_stats: {
        Row: {
          competitor_product_id: string
          last_purchased_at: string
          purchase_count: number
          retailer: string
          user_id: string
        }
        Insert: {
          competitor_product_id: string
          last_purchased_at?: string
          purchase_count?: number
          retailer: string
          user_id: string
        }
        Update: {
          competitor_product_id?: string
          last_purchased_at?: string
          purchase_count?: number
          retailer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_product_stats_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      competitor_products: {
        Row: {
          aliases: string[] | null
          allergens: string | null
          animal_welfare_level: number | null
          article_number: string | null
          assortment_type: string | null
          brand: string | null
          country: string
          country_of_origin: string | null
          created_at: string
          created_by: string | null
          demand_group_code: string | null
          demand_sub_group: string | null
          ean_barcode: string | null
          ingredients: string | null
          is_bio: boolean | null
          is_gluten_free: boolean | null
          is_lactose_free: boolean | null
          is_vegan: boolean | null
          name: string
          name_normalized: string
          nutri_score: string | null
          nutrition_info: Json | null
          other_photo_url: string | null
          product_id: string
          retailer: string | null
          status: string
          thumbnail_url: string | null
          typical_shelf_life_days: number | null
          updated_at: string
          weight_or_quantity: string | null
        }
        Insert: {
          aliases?: string[] | null
          allergens?: string | null
          animal_welfare_level?: number | null
          article_number?: string | null
          assortment_type?: string | null
          brand?: string | null
          country?: string
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          demand_group_code?: string | null
          demand_sub_group?: string | null
          ean_barcode?: string | null
          ingredients?: string | null
          is_bio?: boolean | null
          is_gluten_free?: boolean | null
          is_lactose_free?: boolean | null
          is_vegan?: boolean | null
          name: string
          name_normalized: string
          nutri_score?: string | null
          nutrition_info?: Json | null
          other_photo_url?: string | null
          product_id?: string
          retailer?: string | null
          status?: string
          thumbnail_url?: string | null
          typical_shelf_life_days?: number | null
          updated_at?: string
          weight_or_quantity?: string | null
        }
        Update: {
          aliases?: string[] | null
          allergens?: string | null
          animal_welfare_level?: number | null
          article_number?: string | null
          assortment_type?: string | null
          brand?: string | null
          country?: string
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          demand_group_code?: string | null
          demand_sub_group?: string | null
          ean_barcode?: string | null
          ingredients?: string | null
          is_bio?: boolean | null
          is_gluten_free?: boolean | null
          is_lactose_free?: boolean | null
          is_vegan?: boolean | null
          name?: string
          name_normalized?: string
          nutri_score?: string | null
          nutrition_info?: Json | null
          other_photo_url?: string | null
          product_id?: string
          retailer?: string | null
          status?: string
          thumbnail_url?: string | null
          typical_shelf_life_days?: number | null
          updated_at?: string
          weight_or_quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_competitor_products_demand_group"
            columns: ["demand_group_code"]
            isOneToOne: false
            referencedRelation: "demand_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_competitor_products_demand_sub_group"
            columns: ["demand_sub_group"]
            isOneToOne: false
            referencedRelation: "demand_sub_groups"
            referencedColumns: ["code"]
          },
        ]
      }
      demand_groups: {
        Row: {
          code: string
          color: string | null
          created_at: string
          icon: string | null
          is_meta: boolean
          name: string
          name_en: string | null
          parent_group: string | null
          reviewed_at: string | null
          sort_position: number
          source: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          icon?: string | null
          is_meta?: boolean
          name: string
          name_en?: string | null
          parent_group?: string | null
          reviewed_at?: string | null
          sort_position?: number
          source?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          is_meta?: boolean
          name?: string
          name_en?: string | null
          parent_group?: string | null
          reviewed_at?: string | null
          sort_position?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_groups_parent_group_fkey"
            columns: ["parent_group"]
            isOneToOne: false
            referencedRelation: "demand_groups"
            referencedColumns: ["code"]
          },
        ]
      }
      demand_sub_groups: {
        Row: {
          code: string
          created_at: string
          demand_group_code: string
          name: string
          name_en: string | null
          sort_position: number
          source: string
        }
        Insert: {
          code: string
          created_at?: string
          demand_group_code: string
          name: string
          name_en?: string | null
          sort_position?: number
          source?: string
        }
        Update: {
          code?: string
          created_at?: string
          demand_group_code?: string
          name?: string
          name_en?: string | null
          sort_position?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_sub_groups_demand_group_code_fkey"
            columns: ["demand_group_code"]
            isOneToOne: false
            referencedRelation: "demand_groups"
            referencedColumns: ["code"]
          },
        ]
      }
      feedback: {
        Row: {
          category: string | null
          created_at: string
          feedback_id: string
          feedback_type: string
          message: string
          product_id: string | null
          rating: number | null
          status: string
          store_id: string | null
          trip_id: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          feedback_id?: string
          feedback_type: string
          message: string
          product_id?: string | null
          rating?: number | null
          status?: string
          store_id?: string | null
          trip_id?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          feedback_id?: string
          feedback_type?: string
          message?: string
          product_id?: string | null
          rating?: number | null
          status?: string
          store_id?: string | null
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "feedback_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "shopping_trips"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      flyer_page_products: {
        Row: {
          bbox: Json | null
          created_at: string
          flyer_id: string
          page_number: number
          price_in_flyer: number | null
          product_id: string
        }
        Insert: {
          bbox?: Json | null
          created_at?: string
          flyer_id: string
          page_number: number
          price_in_flyer?: number | null
          product_id: string
        }
        Update: {
          bbox?: Json | null
          created_at?: string
          flyer_id?: string
          page_number?: number
          price_in_flyer?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flyer_page_products_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["flyer_id"]
          },
          {
            foreignKeyName: "flyer_page_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      flyer_pages: {
        Row: {
          flyer_id: string
          image_url: string | null
          page_id: string
          page_number: number
        }
        Insert: {
          flyer_id: string
          image_url?: string | null
          page_id?: string
          page_number: number
        }
        Update: {
          flyer_id?: string
          image_url?: string | null
          page_id?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "flyer_pages_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["flyer_id"]
          },
        ]
      }
      flyers: {
        Row: {
          country: string
          created_at: string
          flyer_id: string
          pdf_url: string | null
          status: string
          title: string
          total_pages: number
          valid_from: string
          valid_until: string
        }
        Insert: {
          country: string
          created_at?: string
          flyer_id?: string
          pdf_url?: string | null
          status?: string
          title: string
          total_pages?: number
          valid_from: string
          valid_until: string
        }
        Update: {
          country?: string
          created_at?: string
          flyer_id?: string
          pdf_url?: string | null
          status?: string
          title?: string
          total_pages?: number
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          added_at: string
          best_before: string | null
          competitor_product_id: string | null
          consumed_at: string | null
          created_at: string
          demand_group_code: string | null
          display_name: string
          frozen_at: string | null
          id: string
          is_frozen: boolean
          opened_at: string | null
          product_id: string | null
          purchase_date: string | null
          quantity: number
          source: string
          source_receipt_id: string | null
          status: string
          thawed_at: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          best_before?: string | null
          competitor_product_id?: string | null
          consumed_at?: string | null
          created_at?: string
          demand_group_code?: string | null
          display_name: string
          frozen_at?: string | null
          id?: string
          is_frozen?: boolean
          opened_at?: string | null
          product_id?: string | null
          purchase_date?: string | null
          quantity?: number
          source?: string
          source_receipt_id?: string | null
          status?: string
          thawed_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          best_before?: string | null
          competitor_product_id?: string | null
          consumed_at?: string | null
          created_at?: string
          demand_group_code?: string | null
          display_name?: string
          frozen_at?: string | null
          id?: string
          is_frozen?: boolean
          opened_at?: string | null
          product_id?: string | null
          purchase_date?: string | null
          quantity?: number
          source?: string
          source_receipt_id?: string | null
          status?: string
          thawed_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_items_source_receipt_id_fkey"
            columns: ["source_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["receipt_id"]
          },
        ]
      }
      list_items: {
        Row: {
          added_at: string
          buy_elsewhere_retailer: string | null
          checked_at: string | null
          comment: string | null
          competitor_product_id: string | null
          custom_name: string | null
          deferred_until: string | null
          demand_group_code: string | null
          display_name: string
          is_checked: boolean
          item_id: string
          list_id: string
          product_id: string | null
          quantity: number
          sort_position: number
          updated_at: string
        }
        Insert: {
          added_at?: string
          buy_elsewhere_retailer?: string | null
          checked_at?: string | null
          comment?: string | null
          competitor_product_id?: string | null
          custom_name?: string | null
          deferred_until?: string | null
          demand_group_code?: string | null
          display_name: string
          is_checked?: boolean
          item_id?: string
          list_id: string
          product_id?: string | null
          quantity?: number
          sort_position?: number
          updated_at?: string
        }
        Update: {
          added_at?: string
          buy_elsewhere_retailer?: string | null
          checked_at?: string | null
          comment?: string | null
          competitor_product_id?: string | null
          custom_name?: string | null
          deferred_until?: string | null
          demand_group_code?: string | null
          display_name?: string
          is_checked?: boolean
          item_id?: string
          list_id?: string
          product_id?: string | null
          quantity?: number
          sort_position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "list_items_demand_group_code_fkey"
            columns: ["demand_group_code"]
            isOneToOne: false
            referencedRelation: "demand_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["list_id"]
          },
          {
            foreignKeyName: "list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      list_items_archive_20260227: {
        Row: {
          added_at: string | null
          category_id: string | null
          checked_at: string | null
          custom_name: string | null
          display_name: string | null
          is_checked: boolean | null
          item_id: string | null
          list_id: string | null
          product_id: string | null
          quantity: number | null
          sort_position: number | null
          updated_at: string | null
        }
        Insert: {
          added_at?: string | null
          category_id?: string | null
          checked_at?: string | null
          custom_name?: string | null
          display_name?: string | null
          is_checked?: boolean | null
          item_id?: string | null
          list_id?: string | null
          product_id?: string | null
          quantity?: number | null
          sort_position?: number | null
          updated_at?: string | null
        }
        Update: {
          added_at?: string | null
          category_id?: string | null
          checked_at?: string | null
          custom_name?: string | null
          display_name?: string | null
          is_checked?: boolean | null
          item_id?: string | null
          list_id?: string | null
          product_id?: string | null
          quantity?: number | null
          sort_position?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pairwise_comparisons: {
        Row: {
          a_before_b_count: number
          b_before_a_count: number
          id: string
          item_a: string
          item_b: string
          last_updated_at: string
          level: string
          scope: string | null
          store_id: string
        }
        Insert: {
          a_before_b_count?: number
          b_before_a_count?: number
          id?: string
          item_a: string
          item_b: string
          last_updated_at?: string
          level: string
          scope?: string | null
          store_id: string
        }
        Update: {
          a_before_b_count?: number
          b_before_a_count?: number
          id?: string
          item_a?: string
          item_b?: string
          last_updated_at?: string
          level?: string
          scope?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pairwise_comparisons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      photo_uploads: {
        Row: {
          created_at: string
          error_message: string | null
          extracted_data: Json | null
          pending_thumbnail_overwrites: Json | null
          photo_type: string | null
          photo_url: string
          processed_at: string | null
          products_created: number
          products_updated: number
          status: string
          upload_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          pending_thumbnail_overwrites?: Json | null
          photo_type?: string | null
          photo_url: string
          processed_at?: string | null
          products_created?: number
          products_updated?: number
          status?: string
          upload_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          pending_thumbnail_overwrites?: Json | null
          photo_type?: string | null
          photo_url?: string
          processed_at?: string | null
          products_created?: number
          products_updated?: number
          status?: string
          upload_id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_photos: {
        Row: {
          category: string
          competitor_product_id: string | null
          created_at: string
          id: string
          photo_url: string
          product_id: string | null
          sort_order: number
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          category: string
          competitor_product_id?: string | null
          created_at?: string
          id?: string
          photo_url: string
          product_id?: string | null
          sort_order?: number
          storage_bucket: string
          storage_path: string
        }
        Update: {
          category?: string
          competitor_product_id?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          product_id?: string | null
          sort_order?: number
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_photos_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_photos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          aliases: string[] | null
          allergens: string | null
          animal_welfare_level: number | null
          article_number: string | null
          assortment_type: string
          availability: string
          availability_scope: string | null
          base_price_text: string | null
          brand: string | null
          country: string | null
          created_at: string
          crowdsource_status: string | null
          demand_group_code: string | null
          demand_sub_group: string | null
          ean_barcode: string | null
          flyer_id: string | null
          flyer_page: number | null
          ingredients: string | null
          is_bio: boolean | null
          is_gluten_free: boolean | null
          is_lactose_free: boolean | null
          is_private_label: boolean | null
          is_seasonal: boolean | null
          is_vegan: boolean | null
          name: string
          name_normalized: string
          nutrition_info: Json | null
          photo_source_id: string | null
          popularity_score: number | null
          price: number | null
          price_updated_at: string | null
          product_id: string
          receipt_abbreviation: string | null
          region: string | null
          source: string
          special_end_date: string | null
          special_start_date: string | null
          status: string
          thumbnail_back_url: string | null
          thumbnail_url: string | null
          typical_shelf_life_days: number | null
          updated_at: string
          weight_or_quantity: string | null
        }
        Insert: {
          aliases?: string[] | null
          allergens?: string | null
          animal_welfare_level?: number | null
          article_number?: string | null
          assortment_type: string
          availability?: string
          availability_scope?: string | null
          base_price_text?: string | null
          brand?: string | null
          country?: string | null
          created_at?: string
          crowdsource_status?: string | null
          demand_group_code?: string | null
          demand_sub_group?: string | null
          ean_barcode?: string | null
          flyer_id?: string | null
          flyer_page?: number | null
          ingredients?: string | null
          is_bio?: boolean | null
          is_gluten_free?: boolean | null
          is_lactose_free?: boolean | null
          is_private_label?: boolean | null
          is_seasonal?: boolean | null
          is_vegan?: boolean | null
          name: string
          name_normalized: string
          nutrition_info?: Json | null
          photo_source_id?: string | null
          popularity_score?: number | null
          price?: number | null
          price_updated_at?: string | null
          product_id?: string
          receipt_abbreviation?: string | null
          region?: string | null
          source: string
          special_end_date?: string | null
          special_start_date?: string | null
          status?: string
          thumbnail_back_url?: string | null
          thumbnail_url?: string | null
          typical_shelf_life_days?: number | null
          updated_at?: string
          weight_or_quantity?: string | null
        }
        Update: {
          aliases?: string[] | null
          allergens?: string | null
          animal_welfare_level?: number | null
          article_number?: string | null
          assortment_type?: string
          availability?: string
          availability_scope?: string | null
          base_price_text?: string | null
          brand?: string | null
          country?: string | null
          created_at?: string
          crowdsource_status?: string | null
          demand_group_code?: string | null
          demand_sub_group?: string | null
          ean_barcode?: string | null
          flyer_id?: string | null
          flyer_page?: number | null
          ingredients?: string | null
          is_bio?: boolean | null
          is_gluten_free?: boolean | null
          is_lactose_free?: boolean | null
          is_private_label?: boolean | null
          is_seasonal?: boolean | null
          is_vegan?: boolean | null
          name?: string
          name_normalized?: string
          nutrition_info?: Json | null
          photo_source_id?: string | null
          popularity_score?: number | null
          price?: number | null
          price_updated_at?: string | null
          product_id?: string
          receipt_abbreviation?: string | null
          region?: string | null
          source?: string
          special_end_date?: string | null
          special_start_date?: string | null
          status?: string
          thumbnail_back_url?: string | null
          thumbnail_url?: string | null
          typical_shelf_life_days?: number | null
          updated_at?: string
          weight_or_quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_demand_sub_group"
            columns: ["demand_sub_group"]
            isOneToOne: false
            referencedRelation: "demand_sub_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_demand_group_code_fkey"
            columns: ["demand_group_code"]
            isOneToOne: false
            referencedRelation: "demand_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_flyer_id_fkey"
            columns: ["flyer_id"]
            isOneToOne: false
            referencedRelation: "flyers"
            referencedColumns: ["flyer_id"]
          },
          {
            foreignKeyName: "products_photo_source_id_fkey"
            columns: ["photo_source_id"]
            isOneToOne: false
            referencedRelation: "photo_uploads"
            referencedColumns: ["upload_id"]
          },
        ]
      }
      products_archive_20260227: {
        Row: {
          allergens: string | null
          animal_welfare_level: number | null
          article_number: string | null
          assortment_type: string | null
          availability: string | null
          availability_scope: string | null
          base_price_text: string | null
          brand: string | null
          category_id: string | null
          country: string | null
          created_at: string | null
          crowdsource_status: string | null
          demand_group: string | null
          demand_sub_group: string | null
          ean_barcode: string | null
          flyer_id: string | null
          flyer_page: number | null
          ingredients: string | null
          is_bio: boolean | null
          is_gluten_free: boolean | null
          is_lactose_free: boolean | null
          is_private_label: boolean | null
          is_seasonal: boolean | null
          is_vegan: boolean | null
          name: string | null
          name_normalized: string | null
          nutrition_info: Json | null
          photo_source_id: string | null
          popularity_score: number | null
          price: number | null
          price_updated_at: string | null
          product_id: string | null
          receipt_abbreviation: string | null
          region: string | null
          sales_volume_week: number | null
          source: string | null
          special_end_date: string | null
          special_start_date: string | null
          status: string | null
          thumbnail_back_url: string | null
          thumbnail_url: string | null
          updated_at: string | null
          weight_or_quantity: string | null
        }
        Insert: {
          allergens?: string | null
          animal_welfare_level?: number | null
          article_number?: string | null
          assortment_type?: string | null
          availability?: string | null
          availability_scope?: string | null
          base_price_text?: string | null
          brand?: string | null
          category_id?: string | null
          country?: string | null
          created_at?: string | null
          crowdsource_status?: string | null
          demand_group?: string | null
          demand_sub_group?: string | null
          ean_barcode?: string | null
          flyer_id?: string | null
          flyer_page?: number | null
          ingredients?: string | null
          is_bio?: boolean | null
          is_gluten_free?: boolean | null
          is_lactose_free?: boolean | null
          is_private_label?: boolean | null
          is_seasonal?: boolean | null
          is_vegan?: boolean | null
          name?: string | null
          name_normalized?: string | null
          nutrition_info?: Json | null
          photo_source_id?: string | null
          popularity_score?: number | null
          price?: number | null
          price_updated_at?: string | null
          product_id?: string | null
          receipt_abbreviation?: string | null
          region?: string | null
          sales_volume_week?: number | null
          source?: string | null
          special_end_date?: string | null
          special_start_date?: string | null
          status?: string | null
          thumbnail_back_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          weight_or_quantity?: string | null
        }
        Update: {
          allergens?: string | null
          animal_welfare_level?: number | null
          article_number?: string | null
          assortment_type?: string | null
          availability?: string | null
          availability_scope?: string | null
          base_price_text?: string | null
          brand?: string | null
          category_id?: string | null
          country?: string | null
          created_at?: string | null
          crowdsource_status?: string | null
          demand_group?: string | null
          demand_sub_group?: string | null
          ean_barcode?: string | null
          flyer_id?: string | null
          flyer_page?: number | null
          ingredients?: string | null
          is_bio?: boolean | null
          is_gluten_free?: boolean | null
          is_lactose_free?: boolean | null
          is_private_label?: boolean | null
          is_seasonal?: boolean | null
          is_vegan?: boolean | null
          name?: string | null
          name_normalized?: string | null
          nutrition_info?: Json | null
          photo_source_id?: string | null
          popularity_score?: number | null
          price?: number | null
          price_updated_at?: string | null
          product_id?: string | null
          receipt_abbreviation?: string | null
          region?: string | null
          sales_volume_week?: number | null
          source?: string | null
          special_end_date?: string | null
          special_start_date?: string | null
          status?: string | null
          thumbnail_back_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          weight_or_quantity?: string | null
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          article_number: string | null
          competitor_product_id: string | null
          created_at: string
          is_weight_item: boolean
          position: number
          product_id: string | null
          quantity: number
          receipt_id: string
          receipt_item_id: string
          receipt_name: string
          tax_category: string | null
          total_price: number | null
          unit_price: number | null
          weight_kg: number | null
        }
        Insert: {
          article_number?: string | null
          competitor_product_id?: string | null
          created_at?: string
          is_weight_item?: boolean
          position: number
          product_id?: string | null
          quantity?: number
          receipt_id: string
          receipt_item_id?: string
          receipt_name: string
          tax_category?: string | null
          total_price?: number | null
          unit_price?: number | null
          weight_kg?: number | null
        }
        Update: {
          article_number?: string | null
          competitor_product_id?: string | null
          created_at?: string
          is_weight_item?: boolean
          position?: number
          product_id?: string | null
          quantity?: number
          receipt_id?: string
          receipt_item_id?: string
          receipt_name?: string
          tax_category?: string | null
          total_price?: number | null
          unit_price?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["receipt_id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          currency: string
          extra_info: Json | null
          items_count: number
          payment_method: string | null
          photo_urls: string[]
          purchase_date: string | null
          purchase_time: string | null
          raw_ocr_data: Json | null
          receipt_id: string
          receipt_number: string | null
          retailer: string | null
          store_address: string | null
          store_name: string | null
          total_amount: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          extra_info?: Json | null
          items_count?: number
          payment_method?: string | null
          photo_urls?: string[]
          purchase_date?: string | null
          purchase_time?: string | null
          raw_ocr_data?: Json | null
          receipt_id?: string
          receipt_number?: string | null
          retailer?: string | null
          store_address?: string | null
          store_name?: string | null
          total_amount?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          extra_info?: Json | null
          items_count?: number
          payment_method?: string | null
          photo_urls?: string[]
          purchase_date?: string | null
          purchase_time?: string | null
          raw_ocr_data?: Json | null
          receipt_id?: string
          receipt_number?: string | null
          retailer?: string | null
          store_address?: string | null
          store_name?: string | null
          total_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          completed_at: string | null
          created_at: string
          list_id: string
          notes: string | null
          status: string
          store_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          list_id?: string
          notes?: string | null
          status?: string
          store_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          list_id?: string
          notes?: string | null
          status?: string
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      shopping_trips: {
        Row: {
          completed_at: string
          created_at: string
          duration_seconds: number
          estimated_total_price: number | null
          sorting_errors_reported: number
          started_at: string
          store_id: string | null
          total_items: number
          trip_id: string
          user_id: string
        }
        Insert: {
          completed_at: string
          created_at?: string
          duration_seconds: number
          estimated_total_price?: number | null
          sorting_errors_reported?: number
          started_at: string
          store_id?: string | null
          total_items: number
          trip_id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          estimated_total_price?: number | null
          sorting_errors_reported?: number
          started_at?: string
          store_id?: string | null
          total_items?: number
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_trips_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          external_id: string | null
          has_sorting_data: boolean
          latitude: number
          longitude: number
          name: string
          opening_hours: string | null
          postal_code: string
          region: string | null
          sorting_data_quality: number
          store_id: string
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          country: string
          created_at?: string
          external_id?: string | null
          has_sorting_data?: boolean
          latitude: number
          longitude: number
          name: string
          opening_hours?: string | null
          postal_code: string
          region?: string | null
          sorting_data_quality?: number
          store_id?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          external_id?: string | null
          has_sorting_data?: boolean
          latitude?: number
          longitude?: number
          name?: string
          opening_hours?: string | null
          postal_code?: string
          region?: string | null
          sorting_data_quality?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores_archive_20260227: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          external_id: string | null
          has_sorting_data: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          opening_hours: string | null
          postal_code: string | null
          region: string | null
          sorting_data_quality: number | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          external_id?: string | null
          has_sorting_data?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          opening_hours?: string | null
          postal_code?: string | null
          region?: string | null
          sorting_data_quality?: number | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          external_id?: string | null
          has_sorting_data?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          opening_hours?: string | null
          postal_code?: string | null
          region?: string | null
          sorting_data_quality?: number | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trip_items: {
        Row: {
          check_position: number
          checked_at: string
          comment: string | null
          custom_name: string | null
          demand_group_code: string | null
          display_name: string
          price_at_purchase: number | null
          product_id: string | null
          quantity: number
          trip_id: string
          trip_item_id: string
          was_removed: boolean
        }
        Insert: {
          check_position: number
          checked_at: string
          comment?: string | null
          custom_name?: string | null
          demand_group_code?: string | null
          display_name: string
          price_at_purchase?: number | null
          product_id?: string | null
          quantity?: number
          trip_id: string
          trip_item_id?: string
          was_removed?: boolean
        }
        Update: {
          check_position?: number
          checked_at?: string
          comment?: string | null
          custom_name?: string | null
          demand_group_code?: string | null
          display_name?: string
          price_at_purchase?: number | null
          product_id?: string | null
          quantity?: number
          trip_id?: string
          trip_item_id?: string
          was_removed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trip_items_demand_group_code_fkey"
            columns: ["demand_group_code"]
            isOneToOne: false
            referencedRelation: "demand_groups"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trip_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "trip_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "shopping_trips"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          default_store_id: string | null
          enable_inventory: boolean
          exclude_gluten: boolean
          exclude_lactose: boolean
          exclude_nuts: boolean
          gps_enabled: boolean
          prefer_animal_welfare: boolean
          prefer_bio: boolean
          prefer_brand: boolean
          prefer_cheapest: boolean
          prefer_vegan: boolean
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_store_id?: string | null
          enable_inventory?: boolean
          exclude_gluten?: boolean
          exclude_lactose?: boolean
          exclude_nuts?: boolean
          gps_enabled?: boolean
          prefer_animal_welfare?: boolean
          prefer_bio?: boolean
          prefer_brand?: boolean
          prefer_cheapest?: boolean
          prefer_vegan?: boolean
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_store_id?: string | null
          enable_inventory?: boolean
          exclude_gluten?: boolean
          exclude_lactose?: boolean
          exclude_nuts?: boolean
          gps_enabled?: boolean
          prefer_animal_welfare?: boolean
          prefer_bio?: boolean
          prefer_brand?: boolean
          prefer_cheapest?: boolean
          prefer_vegan?: boolean
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_store_id_fkey"
            columns: ["default_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_article_number: { Args: { raw: string }; Returns: string }
      search_retailer_products: {
        Args: {
          p_country: string
          p_limit?: number
          p_query?: string
          p_retailer: string
          p_user_id: string
        }
        Returns: {
          brand: string
          country: string
          created_at: string
          demand_group_code: string
          ean_barcode: string
          global_purchase_count: number
          latest_price: number
          name: string
          name_normalized: string
          product_id: string
          status: string
          thumbnail_url: string
          updated_at: string
          user_purchase_count: number
          weight_or_quantity: string
        }[]
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
