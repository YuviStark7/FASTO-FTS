
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "acceptance_targets": {
                  Row: {
                    "label_en": string,"label_it": string,"project_target": number,"release_target": number,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "label_en": string,"label_it": string,"project_target": number,"release_target": number,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "label_en"?: string,"label_it"?: string,"project_target"?: number,"release_target"?: number,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"alerts": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"org_id": string,"payload": NonNullable<Json>,"read_at": string | null,"user_id": string,"watchlist_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"org_id": string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"user_id": string,"watchlist_id"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"org_id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"user_id"?: string,"watchlist_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_watchlist_id_fkey"
      columns: ["watchlist_id"]
isOneToOne: false
      referencedRelation: "watchlists"
      referencedColumns: ["id"]
    }
                  ]
                },"app_config": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"at": string,"id": number,"new_row": Json | null,"old_row": Json | null,"row_pk": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_pk"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_pk"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"barriers": {
                  Row: {
                    "category_id": number,"csi_snapshot_id": number | null,"example_mention_ids": (number)[],"grade": Database["public"]['Enums']["grade"],"id": number,"is_demo": boolean,"label_en": string,"label_it": string,"mention_count": number,"share": number | null,"territory_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"csi_snapshot_id"?: number | null,"example_mention_ids"?: (number)[],"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"label_en": string,"label_it": string,"mention_count": number,"share"?: number | null,"territory_id"?: number | null
                  }
                  Update: {
                    "category_id"?: number,"csi_snapshot_id"?: number | null,"example_mention_ids"?: (number)[],"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"label_en"?: string,"label_it"?: string,"mention_count"?: number,"share"?: number | null,"territory_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "barriers_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barriers_csi_snapshot_id_fkey"
      columns: ["csi_snapshot_id"]
isOneToOne: false
      referencedRelation: "csi_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "barriers_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"brief_citations": {
                  Row: {
                    "brief_version_id": number,"id": number,"observation_id": number | null,"sentence_path": string,"snapshot_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_version_id": number,"id"?: never,"observation_id"?: number | null,"sentence_path": string,"snapshot_ref"?: string | null
                  }
                  Update: {
                    "brief_version_id"?: number,"id"?: never,"observation_id"?: number | null,"sentence_path"?: string,"snapshot_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "brief_citations_brief_version_id_fkey"
      columns: ["brief_version_id"]
isOneToOne: false
      referencedRelation: "brief_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brief_citations_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    }
                  ]
                },"brief_versions": {
                  Row: {
                    "brief_id": number,"citation_check_passed": boolean,"content": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": number,"locale": string,"model": string,"prompt_version": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_id": number,"citation_check_passed"?: boolean,"content": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: never,"locale"?: string,"model": string,"prompt_version": string,"version": number
                  }
                  Update: {
                    "brief_id"?: number,"citation_check_passed"?: boolean,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: never,"locale"?: string,"model"?: string,"prompt_version"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "brief_versions_brief_id_fkey"
      columns: ["brief_id"]
isOneToOne: false
      referencedRelation: "briefs"
      referencedColumns: ["id"]
    }
                  ]
                },"briefs": {
                  Row: {
                    "category_id": number,"created_at": string,"created_by": string | null,"current_version_id": number | null,"id": number,"published_at": string | null,"published_by": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["brief_status"],"territory_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: number | null,"id"?: never,"published_at"?: string | null,"published_by"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["brief_status"],"territory_id": number
                  }
                  Update: {
                    "category_id"?: number,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: number | null,"id"?: never,"published_at"?: string | null,"published_by"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["brief_status"],"territory_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "briefs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "briefs_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "brief_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "briefs_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "codes": NonNullable<Json>,"color": string,"icon": string,"id": number,"is_added": boolean,"name_en": string,"name_it": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codes"?: NonNullable<Json>,"color": string,"icon": string,"id"?: never,"is_added"?: boolean,"name_en": string,"name_it": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "codes"?: NonNullable<Json>,"color"?: string,"icon"?: string,"id"?: never,"is_added"?: boolean,"name_en"?: string,"name_it"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"cells": {
                  Row: {
                    "category_id": number,"coverage_pct": number,"csi_snapshot_id": number | null,"geo_estimate_id": number | null,"grade_mix": NonNullable<Json>,"is_demo": boolean,"missing_inputs": (string)[],"mos": number | null,"mos_is_partial": boolean | null,"mos_snapshot_id": number | null,"status": Database["public"]['Enums']["cell_status"],"territory_id": number,"trend_snapshot_id": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"coverage_pct"?: number,"csi_snapshot_id"?: number | null,"geo_estimate_id"?: number | null,"grade_mix"?: NonNullable<Json>,"is_demo"?: boolean,"missing_inputs"?: (string)[],"mos"?: number | null,"mos_is_partial"?: boolean | null,"mos_snapshot_id"?: number | null,"status"?: Database["public"]['Enums']["cell_status"],"territory_id": number,"trend_snapshot_id"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: number,"coverage_pct"?: number,"csi_snapshot_id"?: number | null,"geo_estimate_id"?: number | null,"grade_mix"?: NonNullable<Json>,"is_demo"?: boolean,"missing_inputs"?: (string)[],"mos"?: number | null,"mos_is_partial"?: boolean | null,"mos_snapshot_id"?: number | null,"status"?: Database["public"]['Enums']["cell_status"],"territory_id"?: number,"trend_snapshot_id"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cells_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cells_csi_snapshot_id_fkey"
      columns: ["csi_snapshot_id"]
isOneToOne: false
      referencedRelation: "csi_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cells_geo_estimate_id_fkey"
      columns: ["geo_estimate_id"]
isOneToOne: false
      referencedRelation: "geo_estimates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cells_mos_snapshot_id_fkey"
      columns: ["mos_snapshot_id"]
isOneToOne: false
      referencedRelation: "mos_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cells_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cells_trend_snapshot_id_fkey"
      columns: ["trend_snapshot_id"]
isOneToOne: false
      referencedRelation: "trend_snapshots"
      referencedColumns: ["id"]
    }
                  ]
                },"competitors": {
                  Row: {
                    "created_at": string,"id": number,"is_demo": boolean,"kind": string | null,"name": string,"source_id": number,"territory_id": number | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"is_demo"?: boolean,"kind"?: string | null,"name": string,"source_id": number,"territory_id"?: number | null,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"is_demo"?: boolean,"kind"?: string | null,"name"?: string,"source_id"?: number,"territory_id"?: number | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "competitors_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competitors_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": number,"locale": string,"org_id": string,"title": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"locale"?: string,"org_id": string,"title"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"locale"?: string,"org_id"?: string,"title"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"csi_snapshots": {
                  Row: {
                    "category_id": number,"computed_at": string,"csi": number | null,"desirability": number | null,"grade": Database["public"]['Enums']["grade"],"id": number,"is_demo": boolean,"is_published": boolean,"languages": (string)[],"liking": number | null,"method_version_id": string,"n_mentions": number,"perceived_value": number | null,"period_end": string,"period_start": string,"purchase_intent": number | null,"representativeness_note": string,"source_ids": (number)[],"territory_id": number,"trust": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"computed_at"?: string,"csi"?: number | null,"desirability"?: number | null,"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"is_published": boolean,"languages"?: (string)[],"liking"?: number | null,"method_version_id": string,"n_mentions": number,"perceived_value"?: number | null,"period_end": string,"period_start": string,"purchase_intent"?: number | null,"representativeness_note": string,"source_ids"?: (number)[],"territory_id": number,"trust"?: number | null
                  }
                  Update: {
                    "category_id"?: number,"computed_at"?: string,"csi"?: number | null,"desirability"?: number | null,"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"is_published"?: boolean,"languages"?: (string)[],"liking"?: number | null,"method_version_id"?: string,"n_mentions"?: number,"perceived_value"?: number | null,"period_end"?: string,"period_start"?: string,"purchase_intent"?: number | null,"representativeness_note"?: string,"source_ids"?: (number)[],"territory_id"?: number,"trust"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "csi_snapshots_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "csi_snapshots_method_version_id_fkey"
      columns: ["method_version_id"]
isOneToOne: false
      referencedRelation: "method_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "csi_snapshots_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"exports": {
                  Row: {
                    "brief_version_id": number | null,"created_at": string,"format": string,"id": number,"org_id": string,"storage_path": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brief_version_id"?: number | null,"created_at"?: string,"format": string,"id"?: never,"org_id": string,"storage_path"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "brief_version_id"?: number | null,"created_at"?: string,"format"?: string,"id"?: never,"org_id"?: string,"storage_path"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exports_brief_version_id_fkey"
      columns: ["brief_version_id"]
isOneToOne: false
      referencedRelation: "brief_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exports_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": number,"org_id": string,"rating": Database["public"]['Enums']["feedback_rating"],"target_id": number,"target_type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"id"?: never,"org_id": string,"rating": Database["public"]['Enums']["feedback_rating"],"target_id": number,"target_type": string,"user_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"id"?: never,"org_id"?: string,"rating"?: Database["public"]['Enums']["feedback_rating"],"target_id"?: number,"target_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"geo_estimates": {
                  Row: {
                    "category_id": number,"computed_at": string,"factors": NonNullable<Json>,"grade": Database["public"]['Enums']["grade"],"high": number,"id": number,"input_observation_ids": (number)[],"is_demo": boolean,"low": number,"method_version_id": string,"period_year": number,"territory_id": number,"unit": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"computed_at"?: string,"factors": NonNullable<Json>,"grade"?: Database["public"]['Enums']["grade"],"high": number,"id"?: never,"input_observation_ids"?: (number)[],"is_demo"?: boolean,"low": number,"method_version_id": string,"period_year": number,"territory_id": number,"unit"?: string,"value": number
                  }
                  Update: {
                    "category_id"?: number,"computed_at"?: string,"factors"?: NonNullable<Json>,"grade"?: Database["public"]['Enums']["grade"],"high"?: number,"id"?: never,"input_observation_ids"?: (number)[],"is_demo"?: boolean,"low"?: number,"method_version_id"?: string,"period_year"?: number,"territory_id"?: number,"unit"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "geo_estimates_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "geo_estimates_method_version_id_fkey"
      columns: ["method_version_id"]
isOneToOne: false
      referencedRelation: "method_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "geo_estimates_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"indicators": {
                  Row: {
                    "description": string | null,"id": number,"is_nominal": boolean,"measure": string,"name_en": string,"name_it": string,"scope": string,"slug": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"id"?: never,"is_nominal"?: boolean,"measure": string,"name_en": string,"name_it": string,"scope"?: string,"slug": string,"unit": string
                  }
                  Update: {
                    "description"?: string | null,"id"?: never,"is_nominal"?: boolean,"measure"?: string,"name_en"?: string,"name_it"?: string,"scope"?: string,"slug"?: string,"unit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"levers": {
                  Row: {
                    "category_id": number,"csi_snapshot_id": number | null,"example_mention_ids": (number)[],"grade": Database["public"]['Enums']["grade"],"id": number,"is_demo": boolean,"label_en": string,"label_it": string,"mention_count": number,"share": number | null,"territory_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"csi_snapshot_id"?: number | null,"example_mention_ids"?: (number)[],"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"label_en": string,"label_it": string,"mention_count": number,"share"?: number | null,"territory_id"?: number | null
                  }
                  Update: {
                    "category_id"?: number,"csi_snapshot_id"?: number | null,"example_mention_ids"?: (number)[],"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"label_en"?: string,"label_it"?: string,"mention_count"?: number,"share"?: number | null,"territory_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "levers_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "levers_csi_snapshot_id_fkey"
      columns: ["csi_snapshot_id"]
isOneToOne: false
      referencedRelation: "csi_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "levers_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"org_id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"role"?: Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"mention_scores": {
                  Row: {
                    "barriers": (string)[],"desirability": number,"levers": (string)[],"liking": number,"mention_id": number,"model": string,"perceived_value": number,"prompt_version": string,"purchase_intent": number,"scored_at": string,"trust": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barriers"?: (string)[],"desirability": number,"levers"?: (string)[],"liking": number,"mention_id": number,"model": string,"perceived_value": number,"prompt_version": string,"purchase_intent": number,"scored_at"?: string,"trust": number
                  }
                  Update: {
                    "barriers"?: (string)[],"desirability"?: number,"levers"?: (string)[],"liking"?: number,"mention_id"?: number,"model"?: string,"perceived_value"?: number,"prompt_version"?: string,"purchase_intent"?: number,"scored_at"?: string,"trust"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mention_scores_mention_id_fkey"
      columns: ["mention_id"]
isOneToOne: true
      referencedRelation: "mentions"
      referencedColumns: ["id"]
    }
                  ]
                },"mentions": {
                  Row: {
                    "category_id": number | null,"content_hash": string,"created_at": string,"embedding": string | null,"excerpt": string,"id": number,"is_demo": boolean,"language": string,"published_on": string | null,"run_id": number | null,"source_id": number,"territory_id": number | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: number | null,"content_hash": string,"created_at"?: string,"embedding"?: string | null,"excerpt": string,"id"?: never,"is_demo"?: boolean,"language": string,"published_on"?: string | null,"run_id"?: number | null,"source_id": number,"territory_id"?: number | null,"url"?: string | null
                  }
                  Update: {
                    "category_id"?: number | null,"content_hash"?: string,"created_at"?: string,"embedding"?: string | null,"excerpt"?: string,"id"?: never,"is_demo"?: boolean,"language"?: string,"published_on"?: string | null,"run_id"?: number | null,"source_id"?: number,"territory_id"?: number | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentions_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "source_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentions_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentions_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": NonNullable<Json>,"conversation_id": number,"created_at": string,"id": number,"org_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"conversation_id": number,"created_at"?: string,"id"?: never,"org_id": string,"role": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"conversation_id"?: number,"created_at"?: string,"id"?: never,"org_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"method_versions": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"is_current": boolean,"module": string,"params": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id": string,"is_current"?: boolean,"module": string,"params"?: NonNullable<Json>,"version": number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"is_current"?: boolean,"module"?: string,"params"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"mos_snapshots": {
                  Row: {
                    "category_id": number,"components": NonNullable<Json>,"computed_at": string,"coverage_pct": number,"id": number,"input_snapshot_ids": NonNullable<Json>,"is_demo": boolean,"is_partial": boolean,"method_version_id": string,"mos": number | null,"rank": number | null,"territory_id": number,"weight_set_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"components": NonNullable<Json>,"computed_at"?: string,"coverage_pct": number,"id"?: never,"input_snapshot_ids"?: NonNullable<Json>,"is_demo"?: boolean,"is_partial": boolean,"method_version_id": string,"mos"?: number | null,"rank"?: number | null,"territory_id": number,"weight_set_id"?: number | null
                  }
                  Update: {
                    "category_id"?: number,"components"?: NonNullable<Json>,"computed_at"?: string,"coverage_pct"?: number,"id"?: never,"input_snapshot_ids"?: NonNullable<Json>,"is_demo"?: boolean,"is_partial"?: boolean,"method_version_id"?: string,"mos"?: number | null,"rank"?: number | null,"territory_id"?: number,"weight_set_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mos_snapshots_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mos_snapshots_method_version_id_fkey"
      columns: ["method_version_id"]
isOneToOne: false
      referencedRelation: "method_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mos_snapshots_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mos_snapshots_weight_set_fk"
      columns: ["weight_set_id"]
isOneToOne: false
      referencedRelation: "weight_sets"
      referencedColumns: ["id"]
    }
                  ]
                },"observations": {
                  Row: {
                    "category_id": number | null,"created_at": string,"grade": Database["public"]['Enums']["grade"],"high": number | null,"id": number,"indicator_id": number,"is_demo": boolean,"low": number | null,"method_version_id": string,"period_end": string,"period_start": string,"run_id": number | null,"series_key": string,"source_id": number,"source_ref": string | null,"status_flag": string | null,"territory_id": number,"unit": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: number | null,"created_at"?: string,"grade": Database["public"]['Enums']["grade"],"high"?: number | null,"id"?: never,"indicator_id": number,"is_demo"?: boolean,"low"?: number | null,"method_version_id": string,"period_end": string,"period_start": string,"run_id"?: number | null,"series_key"?: string,"source_id": number,"source_ref"?: string | null,"status_flag"?: string | null,"territory_id": number,"unit": string,"value": number
                  }
                  Update: {
                    "category_id"?: number | null,"created_at"?: string,"grade"?: Database["public"]['Enums']["grade"],"high"?: number | null,"id"?: never,"indicator_id"?: number,"is_demo"?: boolean,"low"?: number | null,"method_version_id"?: string,"period_end"?: string,"period_start"?: string,"run_id"?: number | null,"series_key"?: string,"source_id"?: number,"source_ref"?: string | null,"status_flag"?: string | null,"territory_id"?: number,"unit"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "observations_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_indicator_id_fkey"
      columns: ["indicator_id"]
isOneToOne: false
      referencedRelation: "indicators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_method_version_id_fkey"
      columns: ["method_version_id"]
isOneToOne: false
      referencedRelation: "method_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "source_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "attributes": NonNullable<Json>,"category_id": number,"channel": string | null,"competitor_id": number | null,"currency": string | null,"external_id": string | null,"grade": Database["public"]['Enums']["grade"],"id": number,"is_demo": boolean,"observed_on": string,"pack_size": number | null,"pack_unit": string | null,"price": number | null,"product_name": string,"run_id": number | null,"source_id": number,"territory_id": number | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attributes"?: NonNullable<Json>,"category_id": number,"channel"?: string | null,"competitor_id"?: number | null,"currency"?: string | null,"external_id"?: string | null,"grade": Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"observed_on": string,"pack_size"?: number | null,"pack_unit"?: string | null,"price"?: number | null,"product_name": string,"run_id"?: number | null,"source_id": number,"territory_id"?: number | null,"url"?: string | null
                  }
                  Update: {
                    "attributes"?: NonNullable<Json>,"category_id"?: number,"channel"?: string | null,"competitor_id"?: number | null,"currency"?: string | null,"external_id"?: string | null,"grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_demo"?: boolean,"observed_on"?: string,"pack_size"?: number | null,"pack_unit"?: string | null,"price"?: number | null,"product_name"?: string,"run_id"?: number | null,"source_id"?: number,"territory_id"?: number | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_competitor_id_fkey"
      columns: ["competitor_id"]
isOneToOne: false
      referencedRelation: "competitors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "source_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"is_personal": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_personal"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_personal"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_passports": {
                  Row: {
                    "attributes": NonNullable<Json>,"capacity": string | null,"category_id": number,"certifications": (string)[],"created_at": string,"created_by": string | null,"format": string | null,"id": number,"name": string,"org_id": string,"price_band": string | null,"story": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attributes"?: NonNullable<Json>,"capacity"?: string | null,"category_id": number,"certifications"?: (string)[],"created_at"?: string,"created_by"?: string | null,"format"?: string | null,"id"?: never,"name": string,"org_id": string,"price_band"?: string | null,"story"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attributes"?: NonNullable<Json>,"capacity"?: string | null,"category_id"?: number,"certifications"?: (string)[],"created_at"?: string,"created_by"?: string | null,"format"?: string | null,"id"?: never,"name"?: string,"org_id"?: string,"price_band"?: string | null,"story"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_passports_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_passports_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"locale": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string
                  }
                  Relationships: [
                    
                  ]
                },"raw_files": {
                  Row: {
                    "bytes": number,"content_type": string | null,"fetched_at": string,"id": number,"run_id": number,"sha256": string,"storage_path": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"content_type"?: string | null,"fetched_at"?: string,"id"?: never,"run_id": number,"sha256": string,"storage_path": string,"url"?: string | null
                  }
                  Update: {
                    "bytes"?: number,"content_type"?: string | null,"fetched_at"?: string,"id"?: never,"run_id"?: number,"sha256"?: string,"storage_path"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "raw_files_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "source_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"source_runs": {
                  Row: {
                    "errors": NonNullable<Json>,"finished_at": string | null,"id": number,"params": NonNullable<Json>,"requested_at": string,"requested_by": string | null,"rows_fetched": number | null,"rows_inserted": number | null,"rows_rejected": number | null,"source_id": number,"started_at": string | null,"status": Database["public"]['Enums']["run_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "errors"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: never,"params"?: NonNullable<Json>,"requested_at"?: string,"requested_by"?: string | null,"rows_fetched"?: number | null,"rows_inserted"?: number | null,"rows_rejected"?: number | null,"source_id": number,"started_at"?: string | null,"status"?: Database["public"]['Enums']["run_status"]
                  }
                  Update: {
                    "errors"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: never,"params"?: NonNullable<Json>,"requested_at"?: string,"requested_by"?: string | null,"rows_fetched"?: number | null,"rows_inserted"?: number | null,"rows_rejected"?: number | null,"source_id"?: number,"started_at"?: string | null,"status"?: Database["public"]['Enums']["run_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_runs_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    }
                  ]
                },"sources": {
                  Row: {
                    "cadence": string | null,"default_grade": Database["public"]['Enums']["grade"],"id": number,"is_active": boolean,"licence": string | null,"licence_url": string | null,"name": string,"notes": string | null,"slug": string,"terms_verified_at": string | null,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cadence"?: string | null,"default_grade": Database["public"]['Enums']["grade"],"id"?: never,"is_active"?: boolean,"licence"?: string | null,"licence_url"?: string | null,"name": string,"notes"?: string | null,"slug": string,"terms_verified_at"?: string | null,"url": string
                  }
                  Update: {
                    "cadence"?: string | null,"default_grade"?: Database["public"]['Enums']["grade"],"id"?: never,"is_active"?: boolean,"licence"?: string | null,"licence_url"?: string | null,"name"?: string,"notes"?: string | null,"slug"?: string,"terms_verified_at"?: string | null,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"taxonomy_mappings": {
                  Row: {
                    "confidence": number | null,"created_at": string,"id": number,"kind": string,"proposed_by": string,"raw_label": string,"reviewed_at": string | null,"reviewed_by": string | null,"source_id": number,"status": Database["public"]['Enums']["review_status"],"target_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence"?: number | null,"created_at"?: string,"id"?: never,"kind": string,"proposed_by"?: string,"raw_label": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source_id": number,"status"?: Database["public"]['Enums']["review_status"],"target_id"?: number | null
                  }
                  Update: {
                    "confidence"?: number | null,"created_at"?: string,"id"?: never,"kind"?: string,"proposed_by"?: string,"raw_label"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source_id"?: number,"status"?: Database["public"]['Enums']["review_status"],"target_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "taxonomy_mappings_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "sources"
      referencedColumns: ["id"]
    }
                  ]
                },"territories": {
                  Row: {
                    "centroid": unknown,"country_code": string,"geom": unknown,"id": number,"is_pilot": boolean,"lau_code": string | null,"level": Database["public"]['Enums']["territory_level"],"name_en": string,"name_it": string,"nuts_code": string | null,"parent_id": number | null,"slug": string,"sort_order": number,"stat_codes": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "centroid"?: unknown,"country_code": string,"geom"?: unknown,"id"?: never,"is_pilot"?: boolean,"lau_code"?: string | null,"level": Database["public"]['Enums']["territory_level"],"name_en": string,"name_it": string,"nuts_code"?: string | null,"parent_id"?: number | null,"slug": string,"sort_order"?: number,"stat_codes"?: NonNullable<Json>
                  }
                  Update: {
                    "centroid"?: unknown,"country_code"?: string,"geom"?: unknown,"id"?: never,"is_pilot"?: boolean,"lau_code"?: string | null,"level"?: Database["public"]['Enums']["territory_level"],"name_en"?: string,"name_it"?: string,"nuts_code"?: string | null,"parent_id"?: number | null,"slug"?: string,"sort_order"?: number,"stat_codes"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "territories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"trend_snapshots": {
                  Row: {
                    "category_id": number,"computed_at": string,"first_year": number | null,"grade": Database["public"]['Enums']["grade"] | null,"id": number,"input_observation_ids": (number)[],"is_demo": boolean,"last_year": number | null,"method_version_id": string,"nominal_value_cagr": number | null,"real_value_cagr": number | null,"reason": string,"scope": string,"series": NonNullable<Json>,"status": Database["public"]['Enums']["cell_status"],"territory_id": number,"volume_cagr": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"computed_at"?: string,"first_year"?: number | null,"grade"?: Database["public"]['Enums']["grade"] | null,"id"?: never,"input_observation_ids"?: (number)[],"is_demo"?: boolean,"last_year"?: number | null,"method_version_id": string,"nominal_value_cagr"?: number | null,"real_value_cagr"?: number | null,"reason": string,"scope"?: string,"series"?: NonNullable<Json>,"status": Database["public"]['Enums']["cell_status"],"territory_id": number,"volume_cagr"?: number | null
                  }
                  Update: {
                    "category_id"?: number,"computed_at"?: string,"first_year"?: number | null,"grade"?: Database["public"]['Enums']["grade"] | null,"id"?: never,"input_observation_ids"?: (number)[],"is_demo"?: boolean,"last_year"?: number | null,"method_version_id"?: string,"nominal_value_cagr"?: number | null,"real_value_cagr"?: number | null,"reason"?: string,"scope"?: string,"series"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["cell_status"],"territory_id"?: number,"volume_cagr"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trend_snapshots_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trend_snapshots_method_version_id_fkey"
      columns: ["method_version_id"]
isOneToOne: false
      referencedRelation: "method_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trend_snapshots_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"usage": {
                  Row: {
                    "cost_usd": number,"created_at": string,"id": number,"input_tokens": number,"kind": string,"model": string | null,"module": string,"org_id": string | null,"output_tokens": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_usd"?: number,"created_at"?: string,"id"?: never,"input_tokens"?: number,"kind": string,"model"?: string | null,"module": string,"org_id"?: string | null,"output_tokens"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "cost_usd"?: number,"created_at"?: string,"id"?: never,"input_tokens"?: number,"kind"?: string,"model"?: string | null,"module"?: string,"org_id"?: string | null,"output_tokens"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"watchlists": {
                  Row: {
                    "category_id": number,"created_at": string,"id": number,"org_id": string,"territory_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"created_at"?: string,"id"?: never,"org_id": string,"territory_id": number,"user_id": string
                  }
                  Update: {
                    "category_id"?: number,"created_at"?: string,"id"?: never,"org_id"?: string,"territory_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "watchlists_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlists_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watchlists_territory_id_fkey"
      columns: ["territory_id"]
isOneToOne: false
      referencedRelation: "territories"
      referencedColumns: ["id"]
    }
                  ]
                },"weight_sets": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": number,"is_default": boolean,"name": string,"org_id": string | null,"updated_at": string,"weights": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"is_default"?: boolean,"name": string,"org_id"?: string | null,"updated_at"?: string,"weights": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: never,"is_default"?: boolean,"name"?: string,"org_id"?: string | null,"updated_at"?: string,"weights"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "weight_sets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ai_quota_check":
{ Args: { "p_kind": string,"p_user": string }; Returns: string
                           }
          }
          Enums: {
            "app_role": "admin"|"analyst"|"member"|"viewer","brief_status": "draft"|"reviewed"|"published","cell_status": "expanding"|"consolidated"|"threatened"|"insufficient_data","feedback_rating": "right"|"partly_right"|"wrong","grade": "A"|"B"|"C","review_status": "pending"|"approved"|"rejected","run_status": "queued"|"running"|"succeeded"|"partial"|"failed","territory_level": "city"|"region"|"country"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["admin", "analyst", "member", "viewer"],"brief_status": ["draft", "reviewed", "published"],"cell_status": ["expanding", "consolidated", "threatened", "insufficient_data"],"feedback_rating": ["right", "partly_right", "wrong"],"grade": ["A", "B", "C"],"review_status": ["pending", "approved", "rejected"],"run_status": ["queued", "running", "succeeded", "partial", "failed"],"territory_level": ["city", "region", "country"]
          }
        }
} as const
